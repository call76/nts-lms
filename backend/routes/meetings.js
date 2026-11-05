// In-system video meetings (Jitsi Meet rooms - free, no API key). Students, trainers and the admin
// can create a meeting, invite people or a whole class, and everybody can see who joined.
const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { asyncHandler, str } = require('../lib/http');
const { authenticate } = require('../lib/auth');
const { notifyUsers } = require('../lib/notify');
const { emitToUsers } = require('../lib/realtime');

const router = express.Router();
router.use(authenticate);
const parseIds = (raw) => { try { const v = JSON.parse(raw || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const JITSI = process.env.JITSI_DOMAIN || 'meet.jit.si';

// people a user can invite (students, trainers, admins - never parents' data beyond the name)
router.get('/people', asyncHandler(async (req, res) => {
  if (req.user.role === 'PARENT' || req.user.role === 'GUEST' || req.user.role === 'EMPLOYER') return res.json({ people: [], classes: [] });
  const q = str(req.query.q, 60);
  const people = await prisma.user.findMany({
    where: { id: { not: req.user.id }, isActive: true, deletedAt: null, role: { in: ['STUDENT', 'TRAINER', 'ADMIN'] }, ...(q ? { fullName: { contains: q } } : {}) },
    select: { id: true, fullName: true, role: true, className: true }, orderBy: { fullName: 'asc' }, take: 60,
  });
  const classes = ['TRAINER', 'ADMIN'].includes(req.user.role) ? await prisma.classGroup.findMany({ select: { id: true, name: true, department: true }, orderBy: [{ department: 'asc' }, { name: 'asc' }] }) : [];
  res.json({ people, classes });
}));

async function visibleTo(user, m) {
  if (m.hostId === user.id || user.role === 'ADMIN') return true;
  if (parseIds(m.invitedIds).includes(user.id)) return true;
  if (m.classGroupId) { const me = await prisma.user.findUnique({ where: { id: user.id }, select: { classGroupId: true } }); if (me?.classGroupId === m.classGroupId) return true; }
  return false;
}

router.get('/', asyncHandler(async (req, res) => {
  if (['PARENT', 'GUEST', 'EMPLOYER'].includes(req.user.role)) return res.json([]);
  const rows = await prisma.meeting.findMany({ where: { startsAt: { gte: new Date(Date.now() - 6 * 3600_000) }, status: { not: 'ENDED' } }, orderBy: { startsAt: 'asc' }, take: 100, include: { joins: true } });
  const out = [];
  for (const m of rows) {
    if (!(await visibleTo(req.user, m))) continue;
    const people = await prisma.user.findMany({ where: { id: { in: [m.hostId, ...m.joins.map((j) => j.userId)] } }, select: { id: true, fullName: true } });
    const name = (id) => people.find((p) => p.id === id)?.fullName || '';
    out.push({ id: m.id, title: m.title, description: m.description, startsAt: m.startsAt, status: m.status, hostId: m.hostId, hostName: name(m.hostId), classGroupId: m.classGroupId, joined: m.joins.some((j) => j.userId === req.user.id), joinedCount: m.joins.length, joinedNames: m.hostId === req.user.id || req.user.role === 'ADMIN' ? m.joins.map((j) => name(j.userId)) : undefined });
  }
  res.json(out);
}));

router.post('/', asyncHandler(async (req, res) => {
  if (['PARENT', 'GUEST', 'EMPLOYER'].includes(req.user.role)) return res.status(403).json({ error: 'Not allowed' });
  const title = str(req.body.title, 150);
  const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : new Date();
  if (!title || Number.isNaN(startsAt.getTime())) return res.status(400).json({ error: 'Title and a valid time are required' });
  const invited = Array.isArray(req.body.invitedIds) ? [...new Set(req.body.invitedIds.map(String))].slice(0, 200) : [];
  let classGroupId = str(req.body.classGroupId, 60) || null;
  if (classGroupId && !['TRAINER', 'ADMIN'].includes(req.user.role)) classGroupId = null;
  if (!invited.length && !classGroupId) return res.status(400).json({ error: 'Invite at least one person or a class' });
  const room = `NTS-${crypto.randomBytes(6).toString('hex')}`;
  const m = await prisma.meeting.create({ data: { hostId: req.user.id, title, description: str(req.body.description, 1000) || null, room, startsAt, classGroupId, invitedIds: JSON.stringify(invited), status: startsAt <= new Date(Date.now() + 5 * 60_000) ? 'LIVE' : 'SCHEDULED' } });
  let audience = invited;
  if (classGroupId) audience = [...audience, ...(await prisma.user.findMany({ where: { classGroupId, role: 'STUDENT', isActive: true }, select: { id: true } })).map((u) => u.id)];
  audience = [...new Set(audience)].filter((id) => id !== req.user.id);
  notifyUsers(audience, { type: 'INFO', title: `Meeting: ${title}`, body: `${startsAt.toLocaleString()} · hosted by ${req.user.fullName || 'a teacher'}`, link: `/meetings?open=${m.id}` });
  emitToUsers(audience, 'meeting:new', { id: m.id, title });
  res.status(201).json(m);
}));

// Join = get the room link; the join is recorded so the host sees who is in.
router.post('/:id/join', asyncHandler(async (req, res) => {
  const m = await prisma.meeting.findUnique({ where: { id: req.params.id } });
  if (!m || m.status === 'ENDED') return res.status(404).json({ error: 'Meeting not found or already ended' });
  if (!(await visibleTo(req.user, m))) return res.status(403).json({ error: 'You are not invited to this meeting' });
  await prisma.meetingJoin.upsert({ where: { meetingId_userId: { meetingId: m.id, userId: req.user.id } }, update: {}, create: { meetingId: m.id, userId: req.user.id } });
  if (m.status === 'SCHEDULED') await prisma.meeting.update({ where: { id: m.id }, data: { status: 'LIVE' } });
  if (m.hostId !== req.user.id) emitToUsers([m.hostId], 'meeting:joined', { meetingId: m.id, name: req.user.fullName });
  res.json({ url: `https://${JITSI}/${m.room}`, domain: JITSI, room: m.room, displayName: req.user.fullName || 'NTS user', joined: true });
}));

router.post('/:id/end', asyncHandler(async (req, res) => {
  const m = await prisma.meeting.findUnique({ where: { id: req.params.id } });
  if (!m) return res.status(404).json({ error: 'Meeting not found' });
  if (m.hostId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Only the host can end the meeting' });
  await prisma.meeting.update({ where: { id: m.id }, data: { status: 'ENDED' } });
  res.json({ success: true });
}));

module.exports = router;
