const express=require('express');
const {authenticate}=require('../lib/auth');
const {asyncHandler,str,rateLimit}=require('../lib/http');
const prisma=require('../lib/prisma');
const router=express.Router();
router.use(authenticate);
router.post('/ask',rateLimit({windowMs:60_000,max:8,message:'Please wait before asking another question'}),asyncHandler(async(req,res)=>{
  if(req.user.role!=='GUEST')return res.status(403).json({error:'AI assistant is available to Guest accounts only'});
  const setting=await prisma.siteSetting.findUnique({where:{key:'guest_ai_enabled'}});
  if(setting?.value!=='true')return res.status(403).json({error:'Guest AI is disabled. An administrator must enable it first.'});
  const question=str(req.body.question,4000);if(!question)return res.status(400).json({error:'Question is required'});
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'AI provider is not configured. Contact the administrator.'});
  const response=await fetch(process.env.OPENAI_API_URL||'https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4o-mini',messages:[{role:'system',content:'You are the public NTS learning information assistant. Answer general educational questions and public information about NTS. You have no access to private student, trainer, employer, or institutional records. Never claim to have accessed private records.'},{role:'user',content:question}],temperature:0.5,max_tokens:900})});
  if(!response.ok){const message=await response.text();console.error('Guest AI provider error:',response.status,message.slice(0,500));return res.status(502).json({error:'AI service is temporarily unavailable'});}
  const data=await response.json();res.json({answer:data.choices?.[0]?.message?.content||'No answer returned'});
}));
module.exports=router;
