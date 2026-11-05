const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { authenticate } = require('../lib/auth');
const { asyncHandler, str } = require('../lib/http');
const { notifyUsers } = require('../lib/notify');
const { studentWhere } = require('../lib/scope');
const { cleanQuestions } = require('../lib/quiz');
const { refreshProgress } = require('../lib/progress');
const router = express.Router();
// Public certificate verification endpoint: QR scans must work without login.
router.get('/certificates/verify/:code', asyncHandler(async(req,res)=>{const c=await prisma.certificate.findUnique({where:{code:req.params.code},include:{student:{select:{fullName:true}},module:{include:{trade:true}}}});if(!c)return res.status(404).json({valid:false,error:'Certificate not found'});if(c.status!=='ACTIVE')return res.status(200).json({valid:false,status:c.status,code:c.code,message:'This certificate is not active'});res.json({valid:true,status:c.status,code:c.code,student:c.student.fullName,module:c.module.name,trade:c.module.trade.name,issuedAt:c.issuedAt,finalScore:c.finalScore});}));
router.use(authenticate);
const canTeach = role => ['TRAINER', 'ADMIN'].includes(role);
const parseQuestions = raw => { try { const q = JSON.parse(raw); return Array.isArray(q) ? q : []; } catch { return []; } };
const canManageModule = async (role, userId, moduleId) => { if (role === 'ADMIN') return true; if (role !== 'TRAINER') return false; const owned = await prisma.lesson.findFirst({ where: { moduleId, trainerId: userId }, select: { id: true } }); if (owned) return true; const assignment = await prisma.assignment.findFirst({ where: { moduleId, trainerId: userId }, select: { id: true } }); if (assignment) return true; return !!(await prisma.quiz.findFirst({ where: { moduleId, trainerId: userId }, select: { id: true } })); };

router.get('/overview', asyncHandler(async (req,res) => {
  const [modules, lessons, assignments, quizzes, enrollments, certificates] = await Promise.all([
    prisma.module.count(), prisma.lesson.count({where:{published:true}}), prisma.assignment.count({where:{published:true}}), prisma.quiz.count({where:{published:true}}),
    prisma.courseEnrollment.count({where:{userId:req.user.id}}), prisma.certificate.findMany({where:{studentId:req.user.id},include:{module:{include:{trade:true}}},orderBy:{issuedAt:'desc'}})
  ]);
  res.json({modules,lessons,assignments,quizzes,enrollments,certificates});
}));
router.get('/enrollments', asyncHandler(async(req,res)=>{
 const where=canTeach(req.user.role)?{user:await studentWhere(req.user)}:{userId:req.user.id};
 const rows=await prisma.courseEnrollment.findMany({where,include:{user:{select:{id:true,fullName:true,email:true,school:true}},module:{include:{trade:true}}},orderBy:{updatedAt:'desc'}});res.json(rows);
}));
router.get('/modules', asyncHandler(async(req,res)=>{
 const rows=await prisma.module.findMany({include:{trade:true,_count:{select:{lessons:true,assignments:true,quizzes:true}}},orderBy:[{trade:{name:'asc'}},{level:'asc'},{name:'asc'}]}); res.json(rows);
}));
router.get('/modules/:id', asyncHandler(async(req,res)=>{
 const id=Number(req.params.id); const row=await prisma.module.findUnique({where:{id},include:{trade:true,lessons:{where:{published:true},orderBy:{order:'asc'}},assignments:{where:{published:true},orderBy:{createdAt:'desc'}},quizzes:{where:{published:true},select:{id:true,title:true,description:true,passMark:true,lessonId:true}}}}); if(!row)return res.status(404).json({error:'Module not found'});
 const views=req.user.role==='STUDENT'?await prisma.lessonView.findMany({where:{studentId:req.user.id,lessonId:{in:row.lessons.map(l=>l.id)}}}):[];
 res.json({...row,lessons:row.lessons.map(l=>({...l,view:views.find(v=>v.lessonId===l.id)||null}))});
}));
router.post('/lessons', asyncHandler(async(req,res)=>{
 if(!canTeach(req.user.role))return res.status(403).json({error:'Trainer access required'});
 const moduleId=Number(req.body.moduleId), title=str(req.body.title,180); if(!moduleId||!title)return res.status(400).json({error:'Module and lesson title are required'});
 const row=await prisma.lesson.create({data:{moduleId,trainerId:req.user.id,title,content:str(req.body.content,20000)||null,videoUrl:str(req.body.videoUrl,1500)||null,resourceUrl:str(req.body.resourceUrl,1500)||null,order:Number(req.body.order)||0,published:req.body.published!==false}});res.status(201).json(row);
}));
router.post('/assignments', asyncHandler(async(req,res)=>{
 if(!canTeach(req.user.role))return res.status(403).json({error:'Trainer access required'});
 const moduleId=Number(req.body.moduleId),title=str(req.body.title,180),instructions=str(req.body.instructions,12000);if(!moduleId||!title||!instructions)return res.status(400).json({error:'Module, title and instructions are required'});
 const row=await prisma.assignment.create({data:{moduleId,trainerId:req.user.id,title,instructions,attachmentUrl:str(req.body.attachmentUrl,1500)||null,dueAt:req.body.dueAt?new Date(req.body.dueAt):null,maxScore:Math.max(1,Number(req.body.maxScore)||100),published:true}});res.status(201).json(row);
}));
router.get('/assignments', asyncHandler(async(req,res)=>{
 const where=canTeach(req.user.role)?{}:{published:true};const rows=await prisma.assignment.findMany({where,include:{module:{include:{trade:true}},trainer:{select:{id:true,fullName:true}},submissions:canTeach(req.user.role)?{include:{student:{select:{id:true,fullName:true,email:true}}}}:{where:{studentId:req.user.id}}},orderBy:{createdAt:'desc'}});res.json(rows);
}));
router.post('/assignments/:id/submit', asyncHandler(async(req,res)=>{
 const assignment=await prisma.assignment.findUnique({where:{id:req.params.id}});if(!assignment||!assignment.published)return res.status(404).json({error:'Assignment not found'});
 const answer=str(req.body.answer,20000),fileUrl=str(req.body.fileUrl,1500)||null;if(!answer&&!fileUrl)return res.status(400).json({error:'Add an answer or attach a file'});
 const row=await prisma.assignmentSubmission.upsert({where:{assignmentId_studentId:{assignmentId:assignment.id,studentId:req.user.id}},create:{assignmentId:assignment.id,studentId:req.user.id,answer,fileUrl},update:{answer,fileUrl,status:'SUBMITTED',score:null,feedback:null,gradedById:null,gradedAt:null,submittedAt:new Date()}});res.status(201).json(row);
}));
router.patch('/submissions/:id/grade', asyncHandler(async(req,res)=>{
 if(!canTeach(req.user.role))return res.status(403).json({error:'Trainer access required'});
 const submission=await prisma.assignmentSubmission.findUnique({where:{id:req.params.id},include:{assignment:true}});if(!submission)return res.status(404).json({error:'Submission not found'});if(req.user.role==='TRAINER'&&submission.assignment.trainerId!==req.user.id)return res.status(403).json({error:'You can only grade work for your own assignments'});
 const score=Number(req.body.score);if(!Number.isFinite(score)||score<0||score>submission.assignment.maxScore)return res.status(400).json({error:`Score must be between 0 and ${submission.assignment.maxScore}`});
 const row=await prisma.assignmentSubmission.update({where:{id:submission.id},data:{score,feedback:str(req.body.feedback,5000)||null,status:'GRADED',gradedById:req.user.id,gradedAt:new Date()}});notifyUsers([submission.studentId],{type:'GRADE',title:'Your assignment was graded',body:`${submission.assignment.title}: ${score}/${submission.assignment.maxScore}`,link:'/learning'});res.json(row);
}));
const quizSettings=(b,row={})=>{const d={};if(b.timeLimit!==undefined)d.timeLimit=Number(b.timeLimit)>0?Math.min(300,Math.round(Number(b.timeLimit))):null;if(b.maxAttempts!==undefined)d.maxAttempts=Number(b.maxAttempts)>0?Math.min(50,Math.round(Number(b.maxAttempts))):null;if(b.showAnswers!==undefined)d.showAnswers=b.showAnswers!==false&&b.showAnswers!=='false';return d;};
router.post('/quizzes', asyncHandler(async(req,res)=>{
 if(!canTeach(req.user.role))return res.status(403).json({error:'Trainer access required'});
 const moduleId=Number(req.body.moduleId),title=str(req.body.title,180);
 if(!moduleId||!title)return res.status(400).json({error:'Module and title are required'});
 if(!(await prisma.module.findUnique({where:{id:moduleId},select:{id:true}})))return res.status(404).json({error:'Module not found'});
 const clean=cleanQuestions(req.body.questions);if(clean.error)return res.status(400).json({error:clean.error});
 const row=await prisma.quiz.create({data:{moduleId,trainerId:req.user.id,title,description:str(req.body.description,2000)||null,questions:JSON.stringify(clean.questions),passMark:Math.min(100,Math.max(0,Number(req.body.passMark)||50)),lessonId:str(req.body.lessonId,100)||null,published:req.body.published!==false,...quizSettings(req.body)}});
 // tell the enrolled students that new questions are waiting
 try{const en=await prisma.courseEnrollment.findMany({where:{moduleId},select:{userId:true},take:2000});notifyUsers(en.map(e=>e.userId),{type:'INFO',title:'New questions available',body:title,link:'/learning'});}catch(e){}
 res.status(201).json({id:row.id,title:row.title,questions:clean.questions.length});
}));
router.get('/quizzes', asyncHandler(async(req,res)=>{const rows=await prisma.quiz.findMany({where:canTeach(req.user.role)?{}:{published:true},include:{module:{include:{trade:true}},trainer:{select:{fullName:true}}},orderBy:{createdAt:'desc'}});res.json(rows.map(q=>({...q,questions:canTeach(req.user.role)?parseQuestions(q.questions).map(({answerIndex,...safe})=>({...safe,answerIndex})):parseQuestions(q.questions).map(({answerIndex,...safe})=>safe)})));}));
router.post('/quizzes/:id/attempt', asyncHandler(async(req,res)=>{
 const quiz=await prisma.quiz.findUnique({where:{id:req.params.id}});if(!quiz||!quiz.published)return res.status(404).json({error:'Quiz not found'});
 if(req.user.role!=='STUDENT')return res.status(403).json({error:'Only students can attempt quizzes'});
 const enrollment=await prisma.courseEnrollment.findUnique({where:{userId_moduleId:{userId:req.user.id,moduleId:quiz.moduleId}}});if(!enrollment)return res.status(403).json({error:'Enroll in this module before taking its quiz'});
 const policy=await prisma.certificatePolicy.findUnique({where:{moduleId:quiz.moduleId}});if(policy?.requireQuiz&&policy.quizId===quiz.id){const passed=await prisma.quizAttempt.findFirst({where:{quizId:quiz.id,studentId:req.user.id,score:{gte:policy.minimumScore}}});if(passed)return res.status(409).json({error:'You have already passed the certificate qualification quiz'});const attempts=await prisma.quizAttempt.count({where:{quizId:quiz.id,studentId:req.user.id}});if(attempts>=policy.maxAttempts)return res.status(403).json({error:'Maximum certificate quiz attempts reached'});}
 if(quiz.maxAttempts){const used=await prisma.quizAttempt.count({where:{quizId:quiz.id,studentId:req.user.id}});if(used>=quiz.maxAttempts)return res.status(403).json({error:`You used all ${quiz.maxAttempts} attempts for this quiz`,code:'NO_ATTEMPTS_LEFT'});}
 const effLesson=quiz.lessonId||(policy?.requireVideo&&policy.quizId===quiz.id?policy.videoLessonId:null);
 if(effLesson){const view=await prisma.lessonView.findUnique({where:{lessonId_studentId:{lessonId:effLesson,studentId:req.user.id}}});if(!view?.completedAt)return res.status(403).json({error:'Watch the lesson video to the end before taking this quiz.',code:'WATCH_VIDEO_FIRST'});}
 const qs=parseQuestions(quiz.questions),answers=Array.isArray(req.body.answers)?req.body.answers:[];let score=0,total=0;
 qs.forEach((q,i)=>{const pts=Math.max(1,Number(q.points)||1);total+=pts;if(answers[i]!==null&&answers[i]!==undefined&&Number(answers[i])===Number(q.answerIndex))score+=pts;});
 const pct=total?Math.round(score/total*100):0;const attempt=await prisma.quizAttempt.create({data:{quizId:quiz.id,studentId:req.user.id,answers:JSON.stringify(answers),score:pct,total:100,passed:pct>=quiz.passMark}});
 // V6: passing may finish the module and release the certificate automatically
 const prog=attempt.passed?await refreshProgress(req.user.id,quiz.moduleId):null;
 const used=quiz.maxAttempts?await prisma.quizAttempt.count({where:{quizId:quiz.id,studentId:req.user.id}}):null;
 res.status(201).json({id:attempt.id,score:pct,passed:attempt.passed,passMark:quiz.passMark,attemptsLeft:quiz.maxAttempts?Math.max(0,quiz.maxAttempts-used):null,
  moduleCompleted:Boolean(prog?.justCompleted),certificateIssued:Boolean(prog?.certificate?.issued),certificateReason:prog?.certificate?.reason||null,
  review:quiz.showAnswers===false?undefined:qs.map((q,i)=>({prompt:q.prompt,options:q.options,yourAnswer:answers[i]!==null&&answers[i]!==undefined&&Number.isInteger(Number(answers[i]))?Number(answers[i]):null,correctIndex:Number(q.answerIndex),explanation:q.explanation||null}))});
}));
router.patch('/enrollments/:id/progress', asyncHandler(async(req,res)=>{
 if(!canTeach(req.user.role))return res.status(403).json({error:'Trainer access required'});
 const progress=Number(req.body.progress);if(!Number.isInteger(progress)||progress<0||progress>100)return res.status(400).json({error:'Progress must be between 0 and 100'});
 const row=await prisma.courseEnrollment.findUnique({where:{id:req.params.id}});if(!row)return res.status(404).json({error:'Enrollment not found'});if(!(await canManageModule(req.user.role,req.user.id,row.moduleId)))return res.status(403).json({error:'You can only update progress for modules you manage'});
 const updated=await prisma.courseEnrollment.update({where:{id:row.id},data:{progress,status:progress===100?'COMPLETED':'ENROLLED'}});res.json(updated);
}));
router.get('/certificates', asyncHandler(async(req,res)=>{
 const where=canTeach(req.user.role)?{}:{studentId:req.user.id};
 res.json(await prisma.certificate.findMany({where,include:{student:{select:{fullName:true,email:true,avatar:true}},module:{include:{trade:true}}},orderBy:{issuedAt:'desc'}}));
}));
// A learner may request a certificate only after completing the module.
router.post('/certificates/request', asyncHandler(async(_req,res)=>res.status(410).json({error:'Use /api/certificates/requests/course.'})));
router.get('/certificates/requests', asyncHandler(async(req,res)=>{
 const where=canTeach(req.user.role)?{}:{studentId:req.user.id};
 res.json(await prisma.certificateRequest.findMany({where,include:{student:{select:{id:true,fullName:true,email:true,avatar:true}},module:{include:{trade:true}}},orderBy:{createdAt:'desc'}}));
}));
router.patch('/certificates/requests/:id/review', asyncHandler(async(_req,res)=>res.status(410).json({error:'Use /api/certificates/requests/course/:id/review.'})));
router.post('/certificates/issue', asyncHandler(async(_req,res)=>res.status(410).json({error:'Legacy certificate issuing is disabled. Use /api/certificates/issue/course.'})));
router.patch('/certificates/:id/status', asyncHandler(async(_req,res)=>res.status(410).json({error:'Legacy certificate status updates are disabled. Use /api/certificates/course/:id/status.'})));
// ---------- V5.5: edit / delete (admin: anything, trainer: own) ----------
const ownsOrAdmin=(user,row)=>user.role==='ADMIN'||(user.role==='TRAINER'&&row.trainerId===user.id);
router.put('/lessons/:id',asyncHandler(async(req,res)=>{const row=await prisma.lesson.findUnique({where:{id:req.params.id}});if(!row)return res.status(404).json({error:'Lesson not found'});if(!ownsOrAdmin(req.user,row))return res.status(403).json({error:'You can only edit your own lessons'});
 const data={};if(req.body.title!==undefined)data.title=str(req.body.title,180)||row.title;for(const k of ['content','videoUrl','resourceUrl'])if(req.body[k]!==undefined)data[k]=str(req.body[k],k==='content'?20000:1500)||null;if(req.body.published!==undefined)data.published=!!req.body.published;
 res.json(await prisma.lesson.update({where:{id:row.id},data}));}));
router.delete('/lessons/:id',asyncHandler(async(req,res)=>{const row=await prisma.lesson.findUnique({where:{id:req.params.id}});if(!row)return res.status(404).json({error:'Lesson not found'});if(!ownsOrAdmin(req.user,row))return res.status(403).json({error:'You can only delete your own lessons'});await prisma.lesson.delete({where:{id:row.id}});res.json({success:true});}));
router.put('/assignments/:id',asyncHandler(async(req,res)=>{const row=await prisma.assignment.findUnique({where:{id:req.params.id}});if(!row)return res.status(404).json({error:'Assignment not found'});if(!ownsOrAdmin(req.user,row))return res.status(403).json({error:'You can only edit your own assignments'});
 const data={};if(req.body.title!==undefined)data.title=str(req.body.title,180)||row.title;if(req.body.instructions!==undefined)data.instructions=str(req.body.instructions,12000)||row.instructions;if(req.body.attachmentUrl!==undefined)data.attachmentUrl=str(req.body.attachmentUrl,1500)||null;if(req.body.dueAt!==undefined)data.dueAt=req.body.dueAt?new Date(req.body.dueAt):null;if(req.body.maxScore!==undefined)data.maxScore=Math.max(1,Number(req.body.maxScore)||row.maxScore);if(req.body.published!==undefined)data.published=!!req.body.published;
 res.json(await prisma.assignment.update({where:{id:row.id},data}));}));
router.delete('/assignments/:id',asyncHandler(async(req,res)=>{const row=await prisma.assignment.findUnique({where:{id:req.params.id}});if(!row)return res.status(404).json({error:'Assignment not found'});if(!ownsOrAdmin(req.user,row))return res.status(403).json({error:'You can only delete your own assignments'});await prisma.assignment.delete({where:{id:row.id}});res.json({success:true});}));
router.put('/quizzes/:id',asyncHandler(async(req,res)=>{const row=await prisma.quiz.findUnique({where:{id:req.params.id}});if(!row)return res.status(404).json({error:'Quiz not found'});if(!ownsOrAdmin(req.user,row))return res.status(403).json({error:'You can only edit your own quizzes'});
 const data=quizSettings(req.body);if(req.body.title!==undefined)data.title=str(req.body.title,180)||row.title;if(req.body.description!==undefined)data.description=str(req.body.description,2000)||null;if(req.body.passMark!==undefined)data.passMark=Math.min(100,Math.max(0,Number(req.body.passMark)||0));if(req.body.lessonId!==undefined)data.lessonId=str(req.body.lessonId,100)||null;if(req.body.published!==undefined)data.published=!!req.body.published;
 if(Array.isArray(req.body.questions)){const clean=cleanQuestions(req.body.questions);if(clean.error)return res.status(400).json({error:clean.error});data.questions=JSON.stringify(clean.questions);}
 res.json(await prisma.quiz.update({where:{id:row.id},data}));}));
router.delete('/quizzes/:id',asyncHandler(async(req,res)=>{const row=await prisma.quiz.findUnique({where:{id:req.params.id}});if(!row)return res.status(404).json({error:'Quiz not found'});if(!ownsOrAdmin(req.user,row))return res.status(403).json({error:'You can only delete your own quizzes'});await prisma.quiz.delete({where:{id:row.id}});res.json({success:true});}));

// ---------- V5.5: lesson video progress (needed before the video quiz) ----------
router.post('/lessons/:id/progress',asyncHandler(async(req,res)=>{
 if(req.user.role!=='STUDENT')return res.status(403).json({error:'Only students track progress'});
 const lesson=await prisma.lesson.findUnique({where:{id:req.params.id},select:{id:true}});if(!lesson)return res.status(404).json({error:'Lesson not found'});
 const pct=Math.min(100,Math.max(0,Math.round(Number(req.body.pct)||0)));const done=req.body.completed===true||pct>=95;
 const prev=await prisma.lessonView.findUnique({where:{lessonId_studentId:{lessonId:lesson.id,studentId:req.user.id}}});
 const row=await prisma.lessonView.upsert({where:{lessonId_studentId:{lessonId:lesson.id,studentId:req.user.id}},create:{lessonId:lesson.id,studentId:req.user.id,watchedPct:pct,completedAt:done?new Date():null},update:{watchedPct:Math.max(prev?.watchedPct||0,pct),...(done&&!prev?.completedAt?{completedAt:new Date()}:{})}});
 const lessonRow=await prisma.lesson.findUnique({where:{id:lesson.id},select:{moduleId:true}});
 const prog=row.completedAt&&!prev?.completedAt&&lessonRow?await refreshProgress(req.user.id,lessonRow.moduleId):null;
 res.json({...row,moduleCompleted:Boolean(prog?.justCompleted),certificateIssued:Boolean(prog?.certificate?.issued)});
}));

// ---------- V5.5: my saved notes (kept inside the system) ----------
router.get('/saved',asyncHandler(async(req,res)=>res.json(await prisma.savedNote.findMany({where:{userId:req.user.id},orderBy:{createdAt:'desc'},take:100}))));
router.post('/saved',asyncHandler(async(req,res)=>{const title=str(req.body.title,180),url=str(req.body.url,1500);if(!title||!url)return res.status(400).json({error:'Title and link are required'});
 const dup=await prisma.savedNote.findFirst({where:{userId:req.user.id,url}});if(dup)return res.json(dup);
 res.status(201).json(await prisma.savedNote.create({data:{userId:req.user.id,title,url,source:str(req.body.source,40)||null}}));}));
router.delete('/saved/:id',asyncHandler(async(req,res)=>{await prisma.savedNote.deleteMany({where:{id:req.params.id,userId:req.user.id}});res.json({success:true});}));

module.exports=router;
