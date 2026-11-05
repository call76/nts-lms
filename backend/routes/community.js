const express = require('express');
const prisma = require('../lib/prisma');
const { asyncHandler, str } = require('../lib/http');
const { authenticate } = require('../lib/auth');
const { notifyUsers } = require('../lib/notify');
const { emitToUsers } = require('../lib/realtime');
const { trainersFor } = require('../lib/scope');
const router = express.Router();
router.use(authenticate);

router.get('/classes', asyncHandler(async (req, res) => {
  const groups = await prisma.classGroup.findMany({ include: { _count: { select: { members: true, materials: true } } }, orderBy: [{ department: 'asc' }, { name: 'asc' }] });
  res.json(groups);
}));

router.post('/classes/join', asyncHandler(async (req, res) => {
  const groupId = str(req.body.groupId, 100);
  const group = await prisma.classGroup.findUnique({ where: { id: groupId } });
  if (!group) return res.status(404).json({ error: 'Class not found' });
  let classChat = group.chatId ? await prisma.chat.findUnique({ where: { id: group.chatId } }) : null;
  if (!classChat) {
    classChat = await prisma.chat.create({ data: { name: `${group.department} · ${group.name}`, isGroup: true } });
    await prisma.classGroup.update({ where: { id: group.id }, data: { chatId: classChat.id } });
  }
  await prisma.user.update({ where: { id: req.user.id }, data: { classGroupId: group.id } });
  await prisma.chatParticipant.upsert({ where: { chatId_userId: { chatId: classChat.id, userId: req.user.id } }, create: { chatId: classChat.id, userId: req.user.id }, update: {} });
  // The teachers of this class/department see right away that the student joined.
  const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, fullName: true, department: true, classGroupId: true, role: true } });
  if (me?.role === 'STUDENT') {
    const teachers = await trainersFor({ classGroupId: group.id, department: group.department });
    notifyUsers(teachers, { type: 'INFO', title: `${me.fullName} joined ${group.department} · ${group.name}`, body: 'A student has joined your class community.', link: '/community' });
    emitToUsers(teachers, 'class:join', { classGroupId: group.id, student: { id: me.id, fullName: me.fullName } });
  }
  res.json({ success: true, classGroupId: group.id, chatId: classChat.id, joined: true });
}));

router.get('/my-class', asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { classGroup: { include: {
      members: { select: { id: true, fullName: true, avatar: true, department: true, className: true } },
      materials: { include: { trainer: { select: { fullName: true, avatar: true } } }, orderBy: { createdAt: 'desc' } },
    } } },
  });
  res.json(user?.classGroup || null);
}));

router.post('/my-class/chat', asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { classGroup: true } });
  if (!user?.classGroup) return res.status(404).json({ error: 'Join a class community first' });
  let chat = user.classGroup.chatId ? await prisma.chat.findUnique({ where: { id: user.classGroup.chatId } }) : null;
  if (!chat) {
    chat = await prisma.chat.create({ data: { name: `${user.classGroup.department} · ${user.classGroup.name}`, isGroup: true } });
    await prisma.classGroup.update({ where: { id: user.classGroup.id }, data: { chatId: chat.id } });
  }
  const members = await prisma.user.findMany({ where: { classGroupId: user.classGroup.id }, select: { id: true } });
  await prisma.chatParticipant.createMany({ data: members.map(m => ({ chatId: chat.id, userId: m.id })), skipDuplicates: true });
  const full = await prisma.chat.findUnique({ where: { id: chat.id }, include: { participants: { include: { user: { select: { id: true, fullName: true, avatar: true, role: true } } } } } });
  res.json(full);
}));

router.post('/global-chat', asyncHandler(async (req, res) => {
  let chat = await prisma.chat.findFirst({ where: { name: 'NTS Global Lounge', isGroup: true } });
  if (!chat) chat = await prisma.chat.create({ data: { name: 'NTS Global Lounge', isGroup: true } });
  const users = await prisma.user.findMany({ where: { isVerified: true }, select: { id: true } });
  await prisma.chatParticipant.createMany({ data: users.map(u => ({ chatId: chat.id, userId: u.id })), skipDuplicates: true });
  const full = await prisma.chat.findUnique({ where: { id: chat.id }, include: { participants: { include: { user: { select: { id: true, fullName: true, avatar: true, role: true } } } } } });
  res.json(full);
}));

router.get('/enrollments', asyncHandler(async (req, res) => {
  const rows = await prisma.courseEnrollment.findMany({ where: { userId: req.user.id }, include: { module: { include: { trade: { select: { name: true } } } } }, orderBy: { updatedAt: 'desc' } });
  res.json(rows);
}));

router.post('/enrollments', asyncHandler(async (req, res) => {
  const moduleId = Number(req.body.moduleId);
  if (!Number.isInteger(moduleId) || moduleId < 1) return res.status(400).json({ error: 'Valid moduleId is required' });
  const module = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!module) return res.status(404).json({ error: 'Learning module not found' });
  const existed = await prisma.courseEnrollment.findUnique({ where: { userId_moduleId: { userId: req.user.id, moduleId } }, select: { id: true } });
  const row = await prisma.courseEnrollment.upsert({ where: { userId_moduleId: { userId: req.user.id, moduleId } }, create: { userId: req.user.id, moduleId }, update: {} });
  if (!existed && req.user.role === 'STUDENT') {
    const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { fullName: true, department: true, classGroupId: true } });
    const teachers = await trainersFor(me);
    notifyUsers(teachers, { type: 'INFO', title: `${me.fullName} joined the module ${module.name}`, body: 'A student enrolled in a module you teach.', link: '/learning' });
    emitToUsers(teachers, 'module:join', { moduleId, student: me.fullName });
  }
  res.status(201).json({ ...row, joined: true });
}));

router.patch('/enrollments/:id/progress', asyncHandler(async (req, res) => {
  const progress = Number(req.body.progress);
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) return res.status(400).json({ error: 'Progress must be between 0 and 100' });
  if (progress === 100 && !['TRAINER', 'ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'A trainer must confirm course completion before certification' });
  const found = await prisma.courseEnrollment.findFirst({ where: { id: req.params.id, userId: req.user.id }, select: { id: true } });
  if (!found) return res.status(404).json({ error: 'Enrollment not found' });
  const row = await prisma.courseEnrollment.update({ where: { id: found.id }, data: { progress, status: progress === 100 ? 'COMPLETED' : 'ENROLLED' } });
  res.json(row);
}));

router.get('/materials', asyncHandler(async (req, res) => {
  // Students only get the notes of their own class (plus notes shared with everyone); parents get none.
  let where = {};
  if (req.user.role === 'PARENT') return res.json([]);
  if (req.user.role === 'STUDENT') {
    const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { classGroupId: true } });
    where = { OR: [{ classGroupId: me?.classGroupId || '__none__' }, { classGroupId: null }] };
  } else if (req.user.role === 'TRAINER') {
    const mine = (await prisma.trainerAssignment.findMany({ where: { trainerId: req.user.id }, select: { classGroupId: true } })).map((x) => x.classGroupId);
    where = { OR: [{ trainerId: req.user.id }, ...(mine.length ? [{ classGroupId: { in: mine } }] : [])] };
  }
  res.json(await prisma.trainerMaterial.findMany({ where, include: { trainer: { select: { id: true, fullName: true, avatar: true } }, classGroup: { select: { id: true, name: true, department: true } } }, orderBy: { createdAt: 'desc' } }));
}));

router.post('/materials', asyncHandler(async (req, res) => {
  if (!['TRAINER', 'ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Only verified trainers can upload learning materials' });
  const title = str(req.body.title, 150);
  const fileUrl = str(req.body.fileUrl, 1000);
  const fileName = str(req.body.fileName, 255);
  const fileType = str(req.body.fileType, 100);
  if (!title || !fileUrl || !fileName || !fileType) return res.status(400).json({ error: 'Title and uploaded file details are required' });
  const material = await prisma.trainerMaterial.create({ data: { title, description: str(req.body.description, 2000) || null, fileUrl, fileName, fileType, trainerId: req.user.id, classGroupId: str(req.body.classGroupId, 100) || null }, include: { trainer: { select: { fullName: true } }, classGroup: { select: { name: true } } } });
  res.status(201).json(material);
}));

module.exports = router;
