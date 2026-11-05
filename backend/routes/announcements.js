const express = require('express');
const prisma = require('../lib/prisma');
const { asyncHandler, str } = require('../lib/http');
const { authenticate } = require('../lib/auth');
const { notifyUsers } = require('../lib/notify');

const router = express.Router();
router.use(authenticate);

const AUDIENCES = ['ALL', 'STUDENT', 'TRAINER', 'PARENT', 'EMPLOYER', 'GUEST'];
const PRIORITIES = ['NORMAL', 'IMPORTANT', 'URGENT'];
const canPost = (role) => role === 'ADMIN' || role === 'TRAINER';

async function withAuthors(rows) {
  const ids = [...new Set(rows.map((r) => r.authorId))];
  const people = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true, role: true } });
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  const now = Date.now();
  return rows.map((r) => ({ ...r, author: byId[r.authorId] || null, expired: !!r.expiresAt && new Date(r.expiresAt).getTime() < now }));
}

// Everyone sees announcements for ALL or for their own role; admins see everything.
router.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const notExpired = { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };
  const where = req.user.role === 'ADMIN' ? {} : { AND: [notExpired, { OR: [{ audience: 'ALL' }, { audience: req.user.role }, { authorId: req.user.id }] }] };
  const rows = await prisma.announcement.findMany({ where, orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }], take: limit });
  res.json(await withAuthors(rows));
}));

router.post('/', asyncHandler(async (req, res) => {
  if (!canPost(req.user.role)) return res.status(403).json({ error: 'Only admins and trainers can post announcements' });
  const title = str(req.body.title, 150);
  const body = str(req.body.body, 5000);
  const audience = AUDIENCES.includes(req.body.audience) ? req.body.audience : 'ALL';
  const priority = PRIORITIES.includes(req.body.priority) ? req.body.priority : 'NORMAL';
  if (!title || !body) return res.status(400).json({ error: 'Title and message are required' });
  if (req.user.role === 'TRAINER' && !['ALL', 'STUDENT', 'PARENT'].includes(audience)) return res.status(403).json({ error: 'Trainers can address students, parents or everyone' });
  let expiresAt = null;
  if (req.body.expiresAt) {
    expiresAt = new Date(req.body.expiresAt);
    if (isNaN(expiresAt)) return res.status(400).json({ error: 'Invalid expiry date' });
  }
  const row = await prisma.announcement.create({ data: { title, body, audience, priority, pinned: req.user.role === 'ADMIN' && !!req.body.pinned, expiresAt, authorId: req.user.id } });

  // Tell everyone in the audience (bell icon + live)
  const people = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null, isVerified: true, id: { not: req.user.id }, ...(audience === 'ALL' ? {} : { role: audience }) },
    select: { id: true },
    take: 5000,
  });
  notifyUsers(people.map((p) => p.id), { type: 'ANNOUNCEMENT', title: `${priority === 'URGENT' ? '🚨 ' : ''}${title}`, body: body.slice(0, 160), link: '/announcements' });
  res.status(201).json((await withAuthors([row]))[0]);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const row = await prisma.announcement.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: 'Announcement not found' });
  if (req.user.role !== 'ADMIN' && row.authorId !== req.user.id) return res.status(403).json({ error: 'Not allowed' });
  const data = {};
  if (req.body.title !== undefined) { const t = str(req.body.title, 150); if (!t) return res.status(400).json({ error: 'Title is required' }); data.title = t; }
  if (req.body.body !== undefined) { const b = str(req.body.body, 5000); if (!b) return res.status(400).json({ error: 'Message is required' }); data.body = b; }
  if (PRIORITIES.includes(req.body.priority)) data.priority = req.body.priority;
  if (req.user.role === 'ADMIN' && req.body.pinned !== undefined) data.pinned = !!req.body.pinned;
  if (req.body.expiresAt !== undefined) data.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
  const updated = await prisma.announcement.update({ where: { id: row.id }, data });
  res.json((await withAuthors([updated]))[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const row = await prisma.announcement.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: 'Announcement not found' });
  if (req.user.role !== 'ADMIN' && row.authorId !== req.user.id) return res.status(403).json({ error: 'Not allowed' });
  await prisma.announcement.delete({ where: { id: row.id } });
  res.json({ success: true });
}));

module.exports = router;
