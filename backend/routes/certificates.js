const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { authenticate, requireAdmin } = require('../lib/auth');
const { asyncHandler, str } = require('../lib/http');
const fs = require('fs');
const path = require('path');
const { renderCertificate } = require('../lib/certificateHtml');
const { buildAssessment, parseSummary } = require('../lib/assessment');
const { notifyUsers } = require('../lib/notify');
const { requireHuman } = require('../lib/humanCheck');
const router = express.Router();
const canManage = (role) => ['ADMIN', 'TRAINER'].includes(role);
const code = (prefix='NTS') => `${prefix}-${crypto.randomBytes(7).toString('hex').toUpperCase()}`;
const safeJson = (v) => { try { return JSON.stringify(v ?? null); } catch { return null; } };
const safeAsset = (v) => { const value=str(v,2000); return /^(https?:\/\/|\/uploads\/)/i.test(value) ? value : null; };
const cleanRows=(v)=>Array.isArray(v)?v.map(r=>({label:str(r.label,120),score:Number(r.score),max:Number(r.max)||100,type:str(r.type,30)})).filter(r=>r.label&&Number.isFinite(r.score)&&r.score>=0).slice(0,12):[];
const hexColor = (v,fallback) => /^#[0-9a-f]{6}$/i.test(str(v,20)) ? str(v,20) : fallback;
const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function ownsModule(user, moduleId) {
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'TRAINER') return false;
  const [l,a,q] = await Promise.all([
    prisma.lesson.findFirst({where:{moduleId,trainerId:user.id},select:{id:true}}),
    prisma.assignment.findFirst({where:{moduleId,trainerId:user.id},select:{id:true}}),
    prisma.quiz.findFirst({where:{moduleId,trainerId:user.id},select:{id:true}}),
  ]);
  return !!(l||a||q);
}
async function audit(certificateId, actorId, action, details) {
  return prisma.certificateAuditLog.create({data:{certificateId,actorId,action,details:safeJson(details)}});
}

// Public QR verification exposes only the minimum information needed to verify a credential.
router.get('/verify/:code', requireHuman, asyncHandler(async(req,res)=>{
  const [course, internship] = await Promise.all([
    prisma.certificate.findUnique({where:{code:req.params.code},include:{student:{select:{fullName:true}},module:{select:{name:true,trade:{select:{name:true}}}}}}),
    prisma.internshipCertificate.findUnique({where:{code:req.params.code}}),
  ]);
  const c = course || internship;
  if (!c) return res.status(404).json({valid:false,error:'Certificate not found'});
  const active = c.status === 'ACTIVE';
  const internshipStudent=internship?await prisma.user.findUnique({where:{id:internship.studentId},select:{fullName:true}}):null;
  return res.json({valid:active,status:c.status,code:c.code,student:course?course.student.fullName:internshipStudent?.fullName,program:course?course.module.name:c.internshipTitle,trade:course?course.module.trade.name:undefined,company:internship?.company,issuedAt:c.issuedAt,message:active?'Certificate is valid':'This certificate is not active'});
}));

router.use(authenticate);

// Admin-managed templates and verified signatories. Only explicitly authorized signatures can be placed.
router.get('/templates', asyncHandler(async(req,res)=>res.json(await prisma.certificateTemplate.findMany({where:req.user.role==='ADMIN'?{}:{isActive:true},orderBy:[{isDefault:'desc'},{createdAt:'desc'}]}))));
router.post('/templates', requireAdmin, asyncHandler(async(req,res)=>{
  const name=str(req.body.name,120); if(!name)return res.status(400).json({error:'Template name is required'});
  if(req.body.isDefault) await prisma.certificateTemplate.updateMany({data:{isDefault:false}});
  const row=await prisma.certificateTemplate.create({data:{name,institution:str(req.body.institution,180)||null,logoUrl:safeAsset(req.body.logoUrl),stampUrl:safeAsset(req.body.stampUrl),backgroundUrl:safeAsset(req.body.backgroundUrl),primaryColor:hexColor(req.body.primaryColor,'#163b65'),secondaryColor:hexColor(req.body.secondaryColor,'#c7a34b'),layoutJson:safeJson(req.body.layout||{}),isDefault:!!req.body.isDefault,createdById:req.user.id}});
  res.status(201).json(row);
}));
router.patch('/templates/:id', requireAdmin, asyncHandler(async(req,res)=>{
  const current=await prisma.certificateTemplate.findUnique({where:{id:req.params.id}}); if(!current)return res.status(404).json({error:'Template not found'});
  if(req.body.isDefault) await prisma.certificateTemplate.updateMany({data:{isDefault:false}});
  const data={}; for(const k of ['name','institution','logoUrl','stampUrl','backgroundUrl','primaryColor','secondaryColor']) if(req.body[k]!==undefined)data[k]=['logoUrl','stampUrl','backgroundUrl'].includes(k)?safeAsset(req.body[k]):['primaryColor','secondaryColor'].includes(k)?hexColor(req.body[k],k==='primaryColor'?'#163b65':'#c7a34b'):str(req.body[k],2000);
  if(req.body.layout!==undefined)data.layoutJson=safeJson(req.body.layout);
  for(const k of ['isDefault','isActive'])if(req.body[k]!==undefined)data[k]=!!req.body[k];
  res.json(await prisma.certificateTemplate.update({where:{id:current.id},data}));
}));
router.get('/signatories', requireAdmin, asyncHandler(async(req,res)=>res.json(await prisma.certificateSignatory.findMany({orderBy:{createdAt:'desc'}}))));
router.post('/signatories', requireAdmin, asyncHandler(async(req,res)=>{
  const fullName=str(req.body.fullName,150),title=str(req.body.title,120); if(!fullName||!title)return res.status(400).json({error:'Name and title are required'});
  res.status(201).json(await prisma.certificateSignatory.create({data:{fullName,title,signatureUrl:safeAsset(req.body.signatureUrl),institution:str(req.body.institution,180)||null,isAuthorized:!!req.body.isAuthorized,createdById:req.user.id}}));
}));
router.patch('/signatories/:id', requireAdmin, asyncHandler(async(req,res)=>{
  const data={}; for(const k of ['fullName','title','signatureUrl','institution'])if(req.body[k]!==undefined)data[k]=k==='signatureUrl'?safeAsset(req.body[k]):str(req.body[k],2000);
  for(const k of ['isAuthorized','isActive'])if(req.body[k]!==undefined)data[k]=!!req.body[k];
  res.json(await prisma.certificateSignatory.update({where:{id:req.params.id},data}));
}));

// Optional per-course qualification quiz gate. It is disabled unless an admin turns it on.
router.get('/policies', requireAdmin, asyncHandler(async(req,res)=>res.json(await prisma.certificatePolicy.findMany({orderBy:{moduleId:'asc'}}))));
router.put('/policies/:moduleId', requireAdmin, asyncHandler(async(req,res)=>{
  const moduleId=Number(req.params.moduleId), minimumScore=Number(req.body.minimumScore??70), maxAttempts=Number(req.body.maxAttempts??3);
  if(!Number.isInteger(moduleId)||minimumScore<0||minimumScore>100||!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>20)return res.status(400).json({error:'Invalid policy values'});
  if(req.body.requireQuiz && !req.body.quizId)return res.status(400).json({error:'Choose a quiz when the quiz gate is enabled'});
  if(req.body.requireQuiz){const quiz=await prisma.quiz.findUnique({where:{id:str(req.body.quizId,100)},select:{id:true,moduleId:true}});if(!quiz||quiz.moduleId!==moduleId)return res.status(400).json({error:'The selected quiz must belong to this module'});}
  const rv=!!req.body.requireVideo&&!!req.body.videoLessonId;res.json(await prisma.certificatePolicy.upsert({where:{moduleId},create:{moduleId,requireQuiz:!!req.body.requireQuiz,requireVideo:rv,videoLessonId:rv?str(req.body.videoLessonId,100):null,quizId:str(req.body.quizId,100)||null,minimumScore,maxAttempts,updatedById:req.user.id},update:{requireQuiz:!!req.body.requireQuiz,requireVideo:rv,videoLessonId:rv?str(req.body.videoLessonId,100):null,quizId:str(req.body.quizId,100)||null,minimumScore,maxAttempts,updatedById:req.user.id}}));
}));

router.get('/marks-preview',asyncHandler(async(req,res)=>{
  if(!canManage(req.user.role))return res.status(403).json({error:'Trainer or Admin access required'});
  const studentId=str(req.query.studentId,100),moduleId=Number(req.query.moduleId);
  const [sys,sigs,templates]=await Promise.all([buildAssessment(studentId,moduleId),authorizedSignatures(),prisma.certificateTemplate.findMany({where:{isActive:true},select:{id:true,name:true,isDefault:true},orderBy:{isDefault:'desc'}})]);
  res.json({...sys,signatories:sigs,templates});
}));
router.put('/settings',requireAdmin,asyncHandler(async(req,res)=>{
  const n=Number(req.body.freeLimit);if(!Number.isInteger(n)||n<0||n>50)return res.status(400).json({error:'Free certificate limit must be 0-50'});
  await prisma.siteSetting.upsert({where:{key:'cert.freeLimit'},update:{value:String(n)},create:{key:'cert.freeLimit',value:String(n)}});
  if(typeof req.body.instructions==='string')await prisma.siteSetting.upsert({where:{key:'pro.instructions'},update:{value:str(req.body.instructions,1500)},create:{key:'pro.instructions',value:str(req.body.instructions,1500)}});
  res.json({freeLimit:n});
}));
// Admin uploads the certificate a student received after finishing an internship (scan/PDF/image) - no application needed.
router.post('/internship/upload',requireAdmin,asyncHandler(async(req,res)=>{
  const studentId=str(req.body.studentId,100),internshipTitle=str(req.body.internshipTitle,180),company=str(req.body.company,180),fileUrl=safeAsset(req.body.sourceFileUrl);
  const student=await prisma.user.findUnique({where:{id:studentId},select:{id:true,avatar:true}});
  if(!student||!internshipTitle||!company)return res.status(400).json({error:'Student, internship title and company are required'});
  if(!fileUrl)return res.status(400).json({error:'Upload the certificate file first'});
  const score=req.body.finalScore===''||req.body.finalScore==null?null:Number(req.body.finalScore);if(score!==null&&(!Number.isFinite(score)||score<0||score>100))return res.status(400).json({error:'Final score must be 0-100'});
  const cert=await prisma.internshipCertificate.create({data:{studentId,applicationId:`UPLOAD-${crypto.randomBytes(8).toString('hex')}`,code:code('NTS-INT'),internshipTitle,company,finalScore:score,assessmentSummary:safeJson([]),studentPhotoUrl:safeAsset(student.avatar),startDate:req.body.startDate?new Date(req.body.startDate):null,endDate:req.body.endDate?new Date(req.body.endDate):null,sourceFileUrl:fileUrl,signaturesJson:safeJson(await authorizedSignatures())}});
  await audit(cert.id,req.user.id,'UPLOADED',{internshipTitle,company});
  notifyUsers([studentId],{type:'INFO',title:'Internship certificate added',body:`${internshipTitle} · ${company}`,link:'/certificates'});
  res.status(201).json(cert);
}));

router.post('/import', requireAdmin, asyncHandler(async(req,res)=>{
  const courseItems=Array.isArray(req.body.certificates)?req.body.certificates:[];const internshipItems=Array.isArray(req.body.internshipCertificates)?req.body.internshipCertificates:[];if(courseItems.length+internshipItems.length>500)return res.status(400).json({error:'Provide up to 500 certificate records per batch'});
  const results=[];
  for(const item of courseItems){
    const email=str(item.email,254).toLowerCase(),moduleId=Number(item.moduleId);
    const student=await prisma.user.findUnique({where:{email},select:{id:true}});
    if(!student||!Number.isInteger(moduleId)){results.push({email,success:false,error:'Student or module not found'});continue;}
    const score=item.finalScore==null?null:Number(item.finalScore);if(score!==null&&(!Number.isFinite(score)||score<0||score>100)){results.push({email,success:false,error:'Final score must be 0-100'});continue;}
    const existing=await prisma.certificate.findUnique({where:{studentId_moduleId:{studentId:student.id,moduleId}}});
    if(existing){results.push({email,success:false,error:'Certificate already exists'});continue;}
    const cert=await prisma.certificate.create({data:{studentId:student.id,moduleId,code:str(item.code,80)||code(),status:'ACTIVE',finalScore:score,assessmentSummary:safeJson(item.assessmentSummary||[]),studentPhotoUrl:safeAsset(item.studentPhotoUrl),templateName:str(item.templateName,120)||'Imported Certificate',templateId:str(item.templateId,100)||null,sourceFileUrl:safeAsset(item.sourceFileUrl)}});
    await audit(cert.id,req.user.id,'IMPORTED',{source:'admin bulk import'});results.push({email,success:true,id:cert.id,code:cert.code});
  }
  for(const item of internshipItems){const email=str(item.email,254).toLowerCase();const student=await prisma.user.findUnique({where:{email},select:{id:true}});const internshipTitle=str(item.internshipTitle,180),company=str(item.company,180);if(!student||!internshipTitle||!company){results.push({email,success:false,error:'Student, internship title and company are required'});continue;}const applicationId=str(item.applicationId,100)||`LEGACY-${crypto.randomBytes(8).toString('hex')}`;const existing=await prisma.internshipCertificate.findUnique({where:{applicationId}});if(existing){results.push({email,success:false,error:'Internship certificate already exists'});continue;}const score=item.finalScore==null?null:Number(item.finalScore);if(score!==null&&(!Number.isFinite(score)||score<0||score>100)){results.push({email,success:false,error:'Final score must be 0-100'});continue;}const cert=await prisma.internshipCertificate.create({data:{studentId:student.id,applicationId,code:str(item.code,80)||code('NTS-INT'),internshipTitle,company,finalScore:score,assessmentSummary:safeJson(item.assessmentSummary||[]),studentPhotoUrl:safeAsset(item.studentPhotoUrl),templateId:str(item.templateId,100)||null,sourceFileUrl:safeAsset(item.sourceFileUrl)}});await audit(cert.id,req.user.id,'IMPORTED',{source:'admin internship certificate import'});results.push({email,success:true,id:cert.id,code:cert.code});}
  res.status(201).json({processed:results.length,successful:results.filter(x=>x.success).length,results});
}));

router.get('/all', requireAdmin, asyncHandler(async(req,res)=>{
  const [courses,internshipRows]=await Promise.all([
    prisma.certificate.findMany({include:{student:{select:{id:true,fullName:true,email:true}},module:{select:{name:true}}},orderBy:{issuedAt:'desc'}}),
    prisma.internshipCertificate.findMany({orderBy:{issuedAt:'desc'}}),
  ]);
  const students=await prisma.user.findMany({where:{id:{in:internshipRows.map(r=>r.studentId)}},select:{id:true,fullName:true,email:true}});const studentMap=new Map(students.map(s=>[s.id,s]));
  res.json({courses,internships:internshipRows.map(r=>({...r,student:studentMap.get(r.studentId)||null}))});
}));

router.get('/mine', asyncHandler(async(req,res)=>{
  const [courses,internships]=await Promise.all([
    prisma.certificate.findMany({where:{studentId:req.user.id},include:{module:{include:{trade:true}}},orderBy:{issuedAt:'desc'}}),
    prisma.internshipCertificate.findMany({where:{studentId:req.user.id},orderBy:{issuedAt:'desc'}}),
  ]); res.json({courses,internships});
}));
router.get('/requests', asyncHandler(async(req,res)=>{
  if(!canManage(req.user.role)&&!['STUDENT','GUEST'].includes(req.user.role))return res.status(403).json({error:'Not allowed'});
  const where=canManage(req.user.role)?{}:{studentId:req.user.id};
  const [courses,internshipRows]=await Promise.all([
    prisma.certificateRequest.findMany({where,include:{student:{select:{id:true,fullName:true,email:true,avatar:true}},module:{include:{trade:true}}},orderBy:{createdAt:'desc'}}),
    prisma.internshipCertificateRequest.findMany({where,orderBy:{createdAt:'desc'}}),
  ]);
  const [students,applications,courseCertificates,internshipCertificates]=await Promise.all([
    prisma.user.findMany({where:{id:{in:internshipRows.map(r=>r.studentId)}},select:{id:true,fullName:true,email:true}}),
    prisma.internshipApplication.findMany({where:{id:{in:internshipRows.map(r=>r.applicationId)}},include:{internship:{select:{title:true,company:true}}}}),
    prisma.certificate.findMany({where:{OR:courses.map(r=>({studentId:r.studentId,moduleId:r.moduleId}))}}),
    prisma.internshipCertificate.findMany({where:{applicationId:{in:internshipRows.map(r=>r.applicationId)}}}),
  ]);
  const studentMap=new Map(students.map(s=>[s.id,s])),appMap=new Map(applications.map(a=>[a.id,a]));
  const courseCertMap=new Map(courseCertificates.map(c=>[`${c.studentId}:${c.moduleId}`,c])),internCertMap=new Map(internshipCertificates.map(c=>[c.applicationId,c]));
  const coursesWithCert=courses.map(r=>({...r,certificate:courseCertMap.get(`${r.studentId}:${r.moduleId}`)||null}));
  const internships=internshipRows.map(r=>({...r,student:studentMap.get(r.studentId)||null,application:appMap.get(r.applicationId)||null,certificate:internCertMap.get(r.applicationId)||null}));
  res.json({courses:coursesWithCert,internships});
}));
async function freeLimit(){const row=await prisma.siteSetting.findUnique({where:{key:'cert.freeLimit'}});const n=Number(row?.value);return Number.isInteger(n)&&n>=0?n:3;}
async function proGate(userId){const [u,used,limit]=await Promise.all([prisma.user.findUnique({where:{id:userId},select:{isPro:true}}),prisma.certificate.count({where:{studentId:userId,status:'ACTIVE'}}),freeLimit()]);return {blocked:!u?.isPro&&used>=limit,used,limit,isPro:!!u?.isPro};}
router.get('/plan',asyncHandler(async(req,res)=>{const g=await proGate(req.user.id);const [ins,pending]=await Promise.all([prisma.siteSetting.findUnique({where:{key:'pro.instructions'}}),prisma.proRequest.findFirst({where:{studentId:req.user.id,status:'PENDING'}})]);res.json({...g,pendingRequest:!!pending,instructions:ins?.value||'Pay the NTS Pro fee by mobile money to the number shown by the school office, then send the payment reference here. An administrator will activate your Pro plan.'});}));
router.post('/requests/course', asyncHandler(async(req,res)=>{
  if(req.user.role!=='STUDENT')return res.status(403).json({error:'Only students can request course certificates'});
  const moduleId=Number(req.body.moduleId); if(!Number.isInteger(moduleId)||moduleId<1)return res.status(400).json({error:'Valid module is required'});
  const enrollment=await prisma.courseEnrollment.findUnique({where:{userId_moduleId:{userId:req.user.id,moduleId}}});
  if(!enrollment||enrollment.progress<100||enrollment.status!=='COMPLETED')return res.status(400).json({error:'Complete the module before requesting a certificate'});
  const policy=await prisma.certificatePolicy.findUnique({where:{moduleId}});
  if(policy?.requireQuiz){
    const passed=await prisma.quizAttempt.findFirst({where:{quizId:policy.quizId,studentId:req.user.id,score:{gte:policy.minimumScore}},orderBy:{createdAt:'desc'}});
    if(!passed){const attempts=await prisma.quizAttempt.count({where:{quizId:policy.quizId,studentId:req.user.id}});if(attempts>=policy.maxAttempts)return res.status(403).json({error:'Maximum certificate quiz attempts reached'});return res.status(403).json({error:`Pass the required quiz with at least ${policy.minimumScore}% before requesting this certificate`});}
  }
  if(policy?.requireVideo&&policy.videoLessonId){const view=await prisma.lessonView.findUnique({where:{lessonId_studentId:{lessonId:policy.videoLessonId,studentId:req.user.id}}});if(!view?.completedAt)return res.status(403).json({error:'Watch the required course video to the end first, then answer its questions.'});}
  const existing=await prisma.certificate.findUnique({where:{studentId_moduleId:{studentId:req.user.id,moduleId}}});
  if(existing?.status==='ACTIVE')return res.status(409).json({error:'An active certificate already exists'});
  const gate=await proGate(req.user.id);
  if(gate.blocked)return res.status(402).json({error:`You have used your ${gate.limit} free course certificates. Upgrade to NTS Pro to get more.`,code:'PRO_REQUIRED',limit:gate.limit,used:gate.used});
  const row=await prisma.certificateRequest.upsert({where:{studentId_moduleId:{studentId:req.user.id,moduleId}},create:{studentId:req.user.id,moduleId},update:{status:'PENDING',note:null,reviewedById:null,reviewedAt:null}});
  res.status(201).json(row);
}));
router.post('/requests/internship', asyncHandler(async(req,res)=>{
  if(req.user.role!=='STUDENT')return res.status(403).json({error:'Only students can request internship certificates'});
  const application=await prisma.internshipApplication.findUnique({where:{id:str(req.body.applicationId,100)},include:{internship:true}});
  if(!application||application.studentId!==req.user.id)return res.status(404).json({error:'Internship application not found'});
  if(application.status!=='COMPLETED')return res.status(400).json({error:'Internship must be marked COMPLETED by an authorized reviewer first'});
  const existing=await prisma.internshipCertificate.findUnique({where:{applicationId:application.id}});
  if(existing?.status==='ACTIVE')return res.status(409).json({error:'An active internship certificate already exists'});
  const row=await prisma.internshipCertificateRequest.upsert({where:{applicationId:application.id},create:{studentId:req.user.id,applicationId:application.id},update:{status:'PENDING',note:null,reviewedById:null,reviewedAt:null}});
  res.status(201).json(row);
}));
router.patch('/requests/:type/:id/review', asyncHandler(async(req,res)=>{
  if(!canManage(req.user.role))return res.status(403).json({error:'Trainer or Admin access required'});
  const status=String(req.body.status||'').toUpperCase(); if(!['APPROVED','REJECTED'].includes(status))return res.status(400).json({error:'Status must be APPROVED or REJECTED'});
  const type=req.params.type;
  if(type==='course'){
    const row=await prisma.certificateRequest.findUnique({where:{id:req.params.id}}); if(!row)return res.status(404).json({error:'Request not found'});
    if(!(await ownsModule(req.user,row.moduleId)))return res.status(403).json({error:'You do not manage this module'});
    if(row.status!=='PENDING')return res.status(409).json({error:'Request already reviewed'});
    const updated=await prisma.certificateRequest.update({where:{id:row.id},data:{status,note:str(req.body.note,2000)||null,reviewedById:req.user.id,reviewedAt:new Date()}});await audit(`REQUEST:${row.id}`,req.user.id,`REQUEST_${status}`,{moduleId:row.moduleId,note:updated.note});return res.json(updated);
  }
  if(type==='internship'){
    if(req.user.role!=='ADMIN')return res.status(403).json({error:'Only Admin can review internship certificate requests'});
    const row=await prisma.internshipCertificateRequest.findUnique({where:{id:req.params.id}}); if(!row)return res.status(404).json({error:'Request not found'});
    if(row.status!=='PENDING')return res.status(409).json({error:'Request already reviewed'});
    const updated=await prisma.internshipCertificateRequest.update({where:{id:row.id},data:{status,note:str(req.body.note,2000)||null,reviewedById:req.user.id,reviewedAt:new Date()}});await audit(`REQUEST:${row.id}`,req.user.id,`INTERNSHIP_REQUEST_${status}`,{applicationId:row.applicationId,note:updated.note});return res.json(updated);
  }
  res.status(400).json({error:'Unknown request type'});
}));

// With no explicit choice the (up to two) newest authorized signatories sign. Admin authorizes them in Certificate Settings.
async function authorizedSignatures(ids) {
  const select={id:true,fullName:true,title:true,signatureUrl:true,institution:true};
  if(Array.isArray(ids)&&ids.length)return prisma.certificateSignatory.findMany({where:{id:{in:ids},isAuthorized:true,isActive:true},select});
  return prisma.certificateSignatory.findMany({where:{isAuthorized:true,isActive:true},select,orderBy:{createdAt:'asc'},take:2});
}
const NO_SIGNATORY='No authorized signatory yet. Admin: open Certificate Settings, add a signatory and press Authorize.';
router.post('/issue/course', asyncHandler(async(req,res)=>{
  if(!canManage(req.user.role))return res.status(403).json({error:'Trainer or Admin access required'});
  const studentId=str(req.body.studentId,100),moduleId=Number(req.body.moduleId); if(!studentId||!Number.isInteger(moduleId))return res.status(400).json({error:'Student and module are required'});
  if(!(await ownsModule(req.user,moduleId)))return res.status(403).json({error:'You do not manage this module'});
  const [enrollment,request,template,signatures]=await Promise.all([
    prisma.courseEnrollment.findUnique({where:{userId_moduleId:{userId:studentId,moduleId}}}),
    prisma.certificateRequest.findUnique({where:{studentId_moduleId:{studentId,moduleId}}}),
    req.body.templateId?prisma.certificateTemplate.findUnique({where:{id:req.body.templateId}}):prisma.certificateTemplate.findFirst({where:{isDefault:true,isActive:true}}),
    authorizedSignatures(req.body.signatoryIds),
  ]);
  if(!enrollment||enrollment.progress<100||enrollment.status!=='COMPLETED')return res.status(400).json({error:'Student has not completed this module'});
  if(!request||request.status!=='APPROVED')return res.status(403).json({error:'Certificate request must be approved first'});
  if(!signatures.length)return res.status(403).json({error:NO_SIGNATORY});
  if(req.body.signatoryIds?.length && signatures.length!==req.body.signatoryIds.length)return res.status(400).json({error:'One or more signatures are not authorized'});
  const sys=await buildAssessment(studentId,moduleId);
  const given=cleanRows(req.body.assessmentRows);
  const rows=given.length?given:sys.rows;
  const finalScore=req.body.finalScore===''||req.body.finalScore==null?sys.finalScore:Number(req.body.finalScore); if(finalScore!==null&&(!Number.isFinite(finalScore)||finalScore<0||finalScore>100))return res.status(400).json({error:'Final score must be 0-100'});
  const existing=await prisma.certificate.findUnique({where:{studentId_moduleId:{studentId,moduleId}}});
  if(existing?.status==='ACTIVE')return res.status(409).json({error:'Active certificate already exists'});
  const owner=await prisma.user.findUnique({where:{id:studentId},select:{avatar:true}});
  const data={code:code(),status:'ACTIVE',finalScore,assessmentSummary:safeJson(rows),studentPhotoUrl:safeAsset(req.body.studentPhotoUrl)||safeAsset(owner?.avatar),templateName:template?.name||'NTS Standard',templateId:template?.id||null,sourceFileUrl:safeAsset(req.body.sourceFileUrl),signaturesJson:safeJson(signatures)};
  const cert=existing?await prisma.certificate.update({where:{id:existing.id},data:{...data,revokedAt:null,revokedReason:null}}):await prisma.certificate.create({data:{studentId,moduleId,...data}});
  await audit(cert.id,req.user.id,existing?'REISSUED':'ISSUED',{templateId:template?.id,signatories:signatures.map(s=>s.id)});
  notifyUsers([studentId],{type:'INFO',title:'Your certificate is ready',body:'Open Certificates to download it.',link:'/certificates'});
  res.status(201).json(cert);
}));
router.post('/issue/internship', requireAdmin, asyncHandler(async(req,res)=>{
  const request=await prisma.internshipCertificateRequest.findUnique({where:{id:str(req.body.requestId,100)}});
  if(!request||request.status!=='APPROVED')return res.status(403).json({error:'Approved internship certificate request required'});
  const app=await prisma.internshipApplication.findUnique({where:{id:request.applicationId},include:{internship:true}});
  if(!app||app.status!=='COMPLETED')return res.status(400).json({error:'Internship must be completed'});
  const [signatures,template]=await Promise.all([authorizedSignatures(req.body.signatoryIds),req.body.templateId?prisma.certificateTemplate.findUnique({where:{id:req.body.templateId}}):prisma.certificateTemplate.findFirst({where:{isDefault:true,isActive:true}})]);
  if(!signatures.length)return res.status(403).json({error:NO_SIGNATORY});
  if(req.body.signatoryIds?.length&&signatures.length!==req.body.signatoryIds.length)return res.status(400).json({error:'One or more signatures are not authorized'});
  const internshipScore=req.body.finalScore===''||req.body.finalScore==null?null:Number(req.body.finalScore);if(internshipScore!==null&&(!Number.isFinite(internshipScore)||internshipScore<0||internshipScore>100))return res.status(400).json({error:'Final score must be 0-100'});
  const cert=await prisma.internshipCertificate.upsert({where:{applicationId:app.id},create:{studentId:app.studentId,applicationId:app.id,code:code('NTS-INT'),internshipTitle:app.internship.title,company:app.internship.company,studentPhotoUrl:safeAsset(req.body.studentPhotoUrl),finalScore:internshipScore,assessmentSummary:safeJson(cleanRows(req.body.assessmentRows)),startDate:app.appliedAt,endDate:new Date(),signaturesJson:safeJson(signatures),templateId:template?.id||null,sourceFileUrl:safeAsset(req.body.sourceFileUrl)},update:{code:code('NTS-INT'),status:'ACTIVE',revokedAt:null,revokedReason:null,internshipTitle:app.internship.title,company:app.internship.company,templateId:template?.id||null,finalScore:internshipScore,assessmentSummary:safeJson(cleanRows(req.body.assessmentRows)),startDate:app.appliedAt,endDate:new Date(),signaturesJson:safeJson(signatures),studentPhotoUrl:safeAsset(req.body.studentPhotoUrl),sourceFileUrl:safeAsset(req.body.sourceFileUrl)}});
  await audit(cert.id,req.user.id,'INTERNSHIP_ISSUED',{applicationId:app.id}); res.status(201).json(cert);
}));
router.patch('/:type/:id/status', requireAdmin, asyncHandler(async(req,res)=>{
  const status=String(req.body.status||'').toUpperCase(); if(!['ACTIVE','SUSPENDED','REVOKED'].includes(status))return res.status(400).json({error:'Invalid status'});
  const isInternship=req.params.type==='internship'; if(!isInternship&&req.params.type!=='course')return res.status(400).json({error:'Unknown certificate type'});
  const model=isInternship?prisma.internshipCertificate:prisma.certificate;
  const cert=await model.findUnique({where:{id:req.params.id}}); if(!cert)return res.status(404).json({error:'Certificate not found'});
  const updated=await model.update({where:{id:cert.id},data:{status,revokedAt:status==='REVOKED'?new Date():null,revokedReason:status==='REVOKED'?str(req.body.reason,2000)||'Revoked by administrator':null}});
  await audit(cert.id,req.user.id,status,{reason:str(req.body.reason,2000)||null}); res.json(updated);
}));
router.get('/:type/:id/audit', requireAdmin, asyncHandler(async(req,res)=>res.json(await prisma.certificateAuditLog.findMany({where:{certificateId:req.params.id},orderBy:{createdAt:'desc'}}))));

// Certificate page: download as PDF / PNG or print. Local images are embedded so the download always has them.
function inlineImage(url){
  if(!url)return null;
  try{
    const m=String(url).match(/\/uploads\/([^?#]+)/);
    if(m){const file=path.join(__dirname,'..','uploads',path.basename(decodeURIComponent(m[1])));if(fs.existsSync(file)&&fs.statSync(file).size<4*1024*1024){const ext=path.extname(file).slice(1).toLowerCase().replace('jpg','jpeg');if(['png','jpeg','webp','gif'].includes(ext))return `data:image/${ext};base64,${fs.readFileSync(file).toString('base64')}`;}}
  }catch{}
  return url;
}
router.get('/:type/:id/print', asyncHandler(async(req,res)=>{
  const isInternship=req.params.type==='internship'; const model=isInternship?prisma.internshipCertificate:prisma.certificate;
  if(!isInternship&&req.params.type!=='course')return res.status(400).send('Unknown certificate type');
  const cert=await model.findUnique({where:{id:req.params.id},...(isInternship?{}:{include:{student:true,module:{include:{trade:true}}}})});
  if(!cert)return res.status(404).send('Certificate not found');
  if(req.user.role!=='ADMIN'&&cert.studentId!==req.user.id){
    if(isInternship||req.user.role!=='TRAINER'||!await ownsModule(req.user,cert.moduleId)){
      // a parent may open it only when the trainer/admin shared certificates with them
      let allowed=false;
      if(req.user.role==='PARENT'){const link=await prisma.parentStudent.findUnique({where:{parentId_studentId:{parentId:req.user.id,studentId:cert.studentId}}});const share=await prisma.parentShare.findUnique({where:{studentId_kind:{studentId:cert.studentId,kind:'CERTIFICATES'}}});allowed=!!(link&&link.status==='APPROVED'&&share);}
      if(!allowed)return res.status(403).send('Not authorized');
    }
  }
  if(cert.status!=='ACTIVE')return res.status(410).send('This certificate is not active');
  const student=isInternship?await prisma.user.findUnique({where:{id:cert.studentId},select:{id:true,fullName:true,avatar:true}}):cert.student;
  const template=cert.templateId?await prisma.certificateTemplate.findUnique({where:{id:cert.templateId}}):await prisma.certificateTemplate.findFirst({where:{isDefault:true,isActive:true}});
  const sigs=(()=>{try{return JSON.parse(cert.signaturesJson||'[]')}catch{return []}})().map(x=>({...x,signatureUrl:inlineImage(x.signatureUrl)}));
  const api=process.env.PUBLIC_API_URL||`${req.protocol}://${req.get('host')}/api`;
  const rows=parseSummary(cert.assessmentSummary);
  // old certificates stored a single "Final assessment" line; show the real marks from the system instead
  const live=(!isInternship&&(!rows.length||(rows.length===1&&/final assessment/i.test(rows[0].label))))?(await buildAssessment(cert.studentId,cert.moduleId)).rows:rows;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.send(renderCertificate({
    code:cert.code,isInternship,studentName:student?.fullName,photo:inlineImage(cert.studentPhotoUrl||student?.avatar),
    program:isInternship?cert.internshipTitle:cert.module.name,
    subtitle:isInternship?cert.company:[cert.module.trade?.name,`Level ${cert.module.level+2}`].filter(Boolean).join(' · '),
    institution:template?.institution||'NTS Professional Learning',logo:inlineImage(template?.logoUrl),stamp:inlineImage(template?.stampUrl),
    primary:template?.primaryColor,accent:template?.secondaryColor,finalScore:cert.finalScore!=null?Math.round(cert.finalScore):null,rows:live,signatures:sigs,
    issuedAt:cert.issuedAt,period:isInternship&&cert.startDate?`${new Date(cert.startDate).toLocaleDateString('en-GB')} – ${cert.endDate?new Date(cert.endDate).toLocaleDateString('en-GB'):''}`:'',
    verifyUrl:`${(process.env.FRONTEND_URL||'http://localhost:3000').split(',')[0].trim().replace(/\/$/,'')}/verify/${cert.code}`,
  }));
}));

// ---------- V6: automatic certificate (video watched + quiz passed => certificate) ----------
const autoIssueOn = async () => { const r = await prisma.siteSetting.findUnique({ where: { key: 'cert.autoIssue' } }); return !r || r.value !== 'false'; };
router.get('/auto-issue', requireAdmin, asyncHandler(async (req, res) => res.json({ enabled: await autoIssueOn() })));
router.put('/auto-issue', requireAdmin, asyncHandler(async (req, res) => {
  const v = req.body.enabled === false || req.body.enabled === 'false' ? 'false' : 'true';
  await prisma.siteSetting.upsert({ where: { key: 'cert.autoIssue' }, update: { value: v }, create: { key: 'cert.autoIssue', value: v } });
  res.json({ enabled: v === 'true' });
}));
async function autoIssueCourse(studentId, moduleId) {
  try {
    if (!(await autoIssueOn())) return { issued: false, reason: 'AUTO_OFF' };
    const [enrollment, existing, policy, template, signatures] = await Promise.all([
      prisma.courseEnrollment.findUnique({ where: { userId_moduleId: { userId: studentId, moduleId } } }),
      prisma.certificate.findUnique({ where: { studentId_moduleId: { studentId, moduleId } } }),
      prisma.certificatePolicy.findUnique({ where: { moduleId } }),
      prisma.certificateTemplate.findFirst({ where: { isDefault: true, isActive: true } }),
      authorizedSignatures(),
    ]);
    if (!enrollment || enrollment.progress < 100) return { issued: false, reason: 'NOT_COMPLETE' };
    if (existing?.status === 'ACTIVE') return { issued: false, reason: 'EXISTS', certificate: existing };
    if (existing && existing.status !== 'ACTIVE') return { issued: false, reason: 'REVOKED' }; // never override an admin decision
    if (policy?.requireQuiz && policy.quizId) {
      const ok = await prisma.quizAttempt.findFirst({ where: { quizId: policy.quizId, studentId, score: { gte: policy.minimumScore } } });
      if (!ok) return { issued: false, reason: 'POLICY_QUIZ' };
    }
    if (policy?.requireVideo && policy.videoLessonId) {
      const v = await prisma.lessonView.findUnique({ where: { lessonId_studentId: { lessonId: policy.videoLessonId, studentId } } });
      if (!v?.completedAt) return { issued: false, reason: 'POLICY_VIDEO' };
    }
    const gate = await proGate(studentId);
    if (gate.blocked) {
      await prisma.certificateRequest.upsert({ where: { studentId_moduleId: { studentId, moduleId } }, create: { studentId, moduleId, note: 'Free certificate limit reached' }, update: {} });
      notifyUsers([studentId], { type: 'INFO', title: 'Module completed', body: `You finished this module. You used your ${gate.limit} free certificates; upgrade to NTS Pro to receive more.`, link: '/certificates' });
      return { issued: false, reason: 'PRO_REQUIRED' };
    }
    // keep a PENDING request for the staff when there is no signatory yet; they can issue it later
    if (!signatures.length) {
      await prisma.certificateRequest.upsert({ where: { studentId_moduleId: { studentId, moduleId } }, create: { studentId, moduleId, note: 'Waiting for an authorized signatory' }, update: {} });
      return { issued: false, reason: 'NO_SIGNATORY' };
    }
    const sys = await buildAssessment(studentId, moduleId);
    const owner = await prisma.user.findUnique({ where: { id: studentId }, select: { avatar: true } });
    const data = { code: code(), status: 'ACTIVE', finalScore: sys.finalScore, assessmentSummary: safeJson(sys.rows), studentPhotoUrl: safeAsset(owner?.avatar), templateName: template?.name || 'NTS Standard', templateId: template?.id || null, signaturesJson: safeJson(signatures) };
    const cert = await prisma.certificate.create({ data: { studentId, moduleId, ...data } });
    await prisma.certificateRequest.upsert({ where: { studentId_moduleId: { studentId, moduleId } }, create: { studentId, moduleId, status: 'APPROVED', note: 'Auto-approved: video watched and quiz passed', reviewedAt: new Date() }, update: { status: 'APPROVED', note: 'Auto-approved: video watched and quiz passed', reviewedAt: new Date() } });
    await audit(cert.id, 'SYSTEM', 'AUTO_ISSUED', { moduleId });
    notifyUsers([studentId], { type: 'INFO', title: '🎓 Your certificate is ready', body: 'You finished the module. Open Certificates to download it.', link: '/certificates' });
    return { issued: true, certificate: cert };
  } catch (e) { console.warn('auto certificate skipped:', e.message); return { issued: false, reason: 'ERROR' }; }
}
router.autoIssueCourse = autoIssueCourse;
module.exports = router;
