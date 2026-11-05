// Certificate questions (answered by the admin) and NTS Pro upgrade requests.
const express = require('express');
const prisma = require('../lib/prisma');
const { asyncHandler, str } = require('../lib/http');
const { authenticate, requireAdmin } = require('../lib/auth');
const { notifyUsers } = require('../lib/notify');

const router = express.Router();
router.use(authenticate);

// ----- certificate questions -----
router.get('/questions', asyncHandler(async (req, res) => {
  const where = req.user.role === 'ADMIN' ? {} : { studentId: req.user.id };
  const rows = await prisma.certificateQuestion.findMany({ where, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 100 });
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.studentId))] } }, select: { id: true, fullName: true, email: true } });
  res.json(rows.map((r) => ({ ...r, student: users.find((u) => u.id === r.studentId) || null })));
}));

router.post('/questions', asyncHandler(async (req, res) => {
  if (req.user.role === 'ADMIN') return res.status(400).json({ error: 'Admins answer questions, they do not ask them' });
  const subject = str(req.body.subject, 150);
  const message = str(req.body.message, 3000);
  if (!subject || !message) return res.status(400).json({ error: 'Subject and message are required' });
  const row = await prisma.certificateQuestion.create({ data: { studentId: req.user.id, subject, message } });
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
  notifyUsers(admins.map((a) => a.id), { type: 'INFO', title: `Certificate question: ${subject}`, body: message.slice(0, 120), link: '/certificates' });
  res.status(201).json(row);
}));

router.put('/questions/:id/reply', requireAdmin, asyncHandler(async (req, res) => {
  const reply = str(req.body.reply, 3000);
  if (!reply) return res.status(400).json({ error: 'Write a reply' });
  const q = await prisma.certificateQuestion.findUnique({ where: { id: req.params.id } });
  if (!q) return res.status(404).json({ error: 'Question not found' });
  const row = await prisma.certificateQuestion.update({ where: { id: q.id }, data: { reply, status: 'ANSWERED', repliedById: req.user.id, repliedAt: new Date() } });
  notifyUsers([q.studentId], { type: 'INFO', title: `The admin answered: ${q.subject}`, body: reply.slice(0, 120), link: '/certificates' });
  res.json(row);
}));

// ----- NTS Pro (more than the free certificates) -----
router.post('/pro-requests', asyncHandler(async (req, res) => {
  if (req.user.role !== 'STUDENT') return res.status(403).json({ error: 'Students only' });
  const reference = str(req.body.reference, 120);
  if (!reference) return res.status(400).json({ error: 'Enter your payment reference' });
  const open = await prisma.proRequest.findFirst({ where: { studentId: req.user.id, status: 'PENDING' } });
  if (open) return res.status(409).json({ error: 'You already have a Pro request waiting for the admin' });
  const row = await prisma.proRequest.create({ data: { studentId: req.user.id, reference } });
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
  notifyUsers(admins.map((a) => a.id), { type: 'INFO', title: 'New NTS Pro request', body: `Payment reference: ${reference}`, link: '/certificates' });
  res.status(201).json(row);
}));

router.get('/pro-requests', requireAdmin, asyncHandler(async (req, res) => {
  const rows = await prisma.proRequest.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 100 });
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.studentId))] } }, select: { id: true, fullName: true, email: true, isPro: true } });
  res.json(rows.map((r) => ({ ...r, student: users.find((u) => u.id === r.studentId) || null })));
}));

router.put('/pro-requests/:id', requireAdmin, asyncHandler(async (req, res) => {
  const row = await prisma.proRequest.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: 'Request not found' });
  const approve = req.body.action === 'approve';
  await prisma.proRequest.update({ where: { id: row.id }, data: { status: approve ? 'APPROVED' : 'REJECTED', decidedById: req.user.id, decidedAt: new Date() } });
  if (approve) await prisma.user.update({ where: { id: row.studentId }, data: { isPro: true } });
  notifyUsers([row.studentId], { type: 'INFO', title: approve ? 'NTS Pro is active' : 'Pro request not approved', body: approve ? 'You can now request unlimited course certificates.' : 'Please contact the school office.', link: '/certificates' });
  res.json({ success: true });
}));

module.exports = router;
