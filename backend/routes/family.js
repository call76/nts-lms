// Parent <-> teacher conversations. The linked student can READ every thread about them
// (transparency) but cannot write in it. Also: teacher remarks about a student.
const express = require('express');
const prisma = require('../lib/prisma');
const { asyncHandler, str } = require('../lib/http');
const { authenticate } = require('../lib/auth');
const { emitToUsers } = require('../lib/realtime');
const { notifyUsers } = require('../lib/notify');
const { canSeeStudent } = require('../lib/attendance');
const { studentWhere } = require('../lib/scope');

const router = express.Router();
router.use(authenticate);

const card = { id: true, fullName: true, avatar: true, role: true };
const threadInclude = {
  parent: { select: card }, trainer: { select: card }, student: { select: { ...card, className: true, department: true } },
  messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { id: true, fullName: true } } } },
  _count: { select: { messages: true } },
};

function visibleWhere(user) {
  if (user.role === 'ADMIN') return {};
  if (user.role === 'PARENT') return { parentId: user.id };
  if (user.role === 'TRAINER') return { trainerId: user.id };
  if (user.role === 'STUDENT') return { studentId: user.id };
  return { id: '__none__' };
}
const canReply = (user, t) => (user.role === 'PARENT' && t.parentId === user.id) || (user.role === 'TRAINER' && t.trainerId === user.id);

async function loadThread(req, res) {
  const t = await prisma.familyThread.findFirst({ where: { id: req.params.id, ...visibleWhere(req.user) }, include: { ...threadInclude, messages: { orderBy: { createdAt: 'asc' }, take: 500, include: { sender: { select: { id: true, fullName: true, avatar: true, role: true } } } } } });
  if (!t) { res.status(404).json({ error: 'Conversation not found' }); return null; }
  return t;
}

// ----- who can I talk to? -----
router.get('/contacts', asyncHandler(async (req, res) => {
  if (req.user.role === 'PARENT') {
    const [children, teachers] = await Promise.all([
      prisma.parentStudent.findMany({ where: { parentId: req.user.id, status: 'APPROVED' }, include: { student: { select: { id: true, fullName: true, className: true, department: true } } } }),
      prisma.user.findMany({ where: { role: { in: ['TRAINER', 'ADMIN'] }, isActive: true, deletedAt: null }, select: { id: true, fullName: true, department: true, avatar: true, role: true }, orderBy: [{ role: 'desc' }, { fullName: 'asc' }] }),
    ]);
    return res.json({ students: children.map((c) => ({ ...c.student, relationship: c.relationship })), teachers });
  }
  if (req.user.role === 'TRAINER' || req.user.role === 'ADMIN') {
    const links = await prisma.parentStudent.findMany({ where: { status: 'APPROVED', student: await studentWhere(req.user) }, include: { parent: { select: { id: true, fullName: true } }, student: { select: { id: true, fullName: true, className: true } } }, take: 500 });
    return res.json({ links: links.map((l) => ({ parentId: l.parent.id, parentName: l.parent.fullName, studentId: l.student.id, studentName: l.student.fullName, className: l.student.className, relationship: l.relationship })) });
  }
  res.json({});
}));

// ----- threads -----
router.get('/threads', asyncHandler(async (req, res) => {
  const where = visibleWhere(req.user);
  if (req.query.studentId && ['PARENT', 'ADMIN', 'TRAINER'].includes(req.user.role)) where.studentId = String(req.query.studentId);
  const rows = await prisma.familyThread.findMany({ where, include: threadInclude, orderBy: { updatedAt: 'desc' }, take: 100 });
  res.json(rows.map((t) => ({ ...t, canReply: canReply(req.user, t) })));
}));

router.get('/threads/:id', asyncHandler(async (req, res) => {
  const t = await loadThread(req, res);
  if (t) res.json({ ...t, canReply: canReply(req.user, t) && t.status === 'OPEN' });
}));

router.post('/threads', asyncHandler(async (req, res) => {
  const subject = str(req.body.subject, 150);
  const content = str(req.body.content, 5000);
  const studentId = str(req.body.studentId, 60);
  if (!subject || !content || !studentId) return res.status(400).json({ error: 'Subject, student and first message are required' });

  let parentId; let trainerId;
  if (req.user.role === 'PARENT') {
    parentId = req.user.id; trainerId = str(req.body.trainerId, 60);
    const link = await prisma.parentStudent.findUnique({ where: { parentId_studentId: { parentId, studentId } } });
    if (!link || link.status !== 'APPROVED') return res.status(403).json({ error: 'This student is not linked to your account' });
    const trainer = await prisma.user.findFirst({ where: { id: trainerId, role: { in: ['TRAINER', 'ADMIN'] }, isActive: true } });
    if (!trainer) return res.status(400).json({ error: 'Choose a teacher' });
  } else if (req.user.role === 'TRAINER') {
    trainerId = req.user.id; parentId = str(req.body.parentId, 60);
    const link = await prisma.parentStudent.findUnique({ where: { parentId_studentId: { parentId, studentId } } });
    if (!link || link.status !== 'APPROVED') return res.status(400).json({ error: 'That parent is not linked to this student' });
  } else {
    return res.status(403).json({ error: 'Only parents and teachers can start a conversation' });
  }

  const thread = await prisma.familyThread.create({
    data: { parentId, trainerId, studentId, subject, messages: { create: { senderId: req.user.id, content } } },
    include: threadInclude,
  });
  const audience = [parentId, trainerId, studentId].filter((id) => id !== req.user.id);
  emitToUsers(audience, 'family:thread', thread);
  notifyUsers([parentId, trainerId].filter((id) => id !== req.user.id), { type: 'INFO', title: `New conversation: ${subject}`, body: content.slice(0, 120), link: `/family?thread=${thread.id}` });
  notifyUsers([studentId], { type: 'INFO', title: 'Your parent and teacher are talking about you', body: `Topic: ${subject}. You can read it in Parents & Teachers.`, link: `/family?thread=${thread.id}` });
  res.status(201).json({ ...thread, canReply: true });
}));

router.post('/threads/:id/messages', asyncHandler(async (req, res) => {
  const t = await loadThread(req, res);
  if (!t) return;
  if (!canReply(req.user, t)) return res.status(403).json({ error: req.user.role === 'STUDENT' ? 'Students can read this conversation but cannot write in it' : 'Not allowed' });
  if (t.status !== 'OPEN') return res.status(400).json({ error: 'This conversation is closed' });
  const content = str(req.body.content, 5000);
  if (!content) return res.status(400).json({ error: 'Message cannot be empty' });

  const message = await prisma.familyMessage.create({ data: { threadId: t.id, senderId: req.user.id, content }, include: { sender: { select: { id: true, fullName: true, avatar: true, role: true } } } });
  await prisma.familyThread.update({ where: { id: t.id }, data: { updatedAt: new Date() } });
  emitToUsers([t.parentId, t.trainerId, t.studentId].filter((id) => id !== req.user.id), 'family:message', { threadId: t.id, message });
  notifyUsers([t.parentId, t.trainerId].filter((id) => id !== req.user.id), { type: 'INFO', title: `${message.sender.fullName}: ${t.subject}`, body: content.slice(0, 120), link: `/family?thread=${t.id}` });
  res.status(201).json(message);
}));

router.put('/threads/:id/status', asyncHandler(async (req, res) => {
  const t = await loadThread(req, res);
  if (!t) return;
  if (!canReply(req.user, t) && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Not allowed' });
  const status = req.body.status === 'CLOSED' ? 'CLOSED' : 'OPEN';
  const updated = await prisma.familyThread.update({ where: { id: t.id }, data: { status } });
  emitToUsers([t.parentId, t.trainerId, t.studentId], 'family:status', { threadId: t.id, status });
  res.json(updated);
}));

// ----- teacher remarks -----
router.get('/remarks', asyncHandler(async (req, res) => {
  const studentId = req.query.studentId === 'me' || !req.query.studentId ? req.user.id : String(req.query.studentId);
  if (!(await canSeeStudent(req.user, studentId))) return res.status(403).json({ error: 'Not allowed' });
  res.json(await prisma.teacherRemark.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, take: 50, include: { trainer: { select: { id: true, fullName: true } } } }));
}));

router.post('/remarks', asyncHandler(async (req, res) => {
  if (!['TRAINER', 'ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Teachers only' });
  const content = str(req.body.content, 2000);
  const studentId = str(req.body.studentId, 60);
  const type = ['PRAISE', 'CONCERN', 'NOTE'].includes(req.body.type) ? req.body.type : 'NOTE';
  const student = await prisma.user.findFirst({ where: { id: studentId, role: 'STUDENT' }, select: { id: true } });
  if (!student || !content) return res.status(400).json({ error: 'Student and remark are required' });
  const remark = await prisma.teacherRemark.create({ data: { studentId, trainerId: req.user.id, type, content }, include: { trainer: { select: { id: true, fullName: true } } } });
  const parents = await prisma.parentStudent.findMany({ where: { studentId, status: 'APPROVED' }, select: { parentId: true } });
  notifyUsers([studentId, ...parents.map((p) => p.parentId)], { type: 'INFO', title: type === 'PRAISE' ? 'Good news from a teacher' : 'New teacher remark', body: content.slice(0, 120), link: '/attendance' });
  res.status(201).json(remark);
}));

router.delete('/remarks/:id', asyncHandler(async (req, res) => {
  const r = await prisma.teacherRemark.findUnique({ where: { id: req.params.id } });
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'ADMIN' && r.trainerId !== req.user.id) return res.status(403).json({ error: 'Not allowed' });
  await prisma.teacherRemark.delete({ where: { id: r.id } });
  res.json({ success: true });
}));

module.exports = router;
