const express = require('express');
const prisma = require('../lib/prisma');
const { asyncHandler, str } = require('../lib/http');
const { authenticate, publicUser } = require('../lib/auth');
const { emitToUser } = require('../lib/realtime');

const router = express.Router();
router.use(authenticate);

const card = { id: true, fullName: true, avatar: true, role: true };

router.get('/profile/:userId', asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!user || user.deletedAt) return res.status(404).json({ error: 'User not found' });
  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: req.user.id, followingId: user.id } },
  });
  const out = publicUser(user);
  // Only show contact details to the owner and admins
  if (req.user.id !== user.id && req.user.role !== 'ADMIN') {
    delete out.phone;
  }
  res.json({ ...out, isFollowing: !!follow });
}));

router.put('/profile', asyncHandler(async (req, res) => {
  const data = {};
  if (req.body.fullName !== undefined) {
    const name = str(req.body.fullName, 100);
    if (!name) return res.status(400).json({ error: 'Full name is required' });
    data.fullName = name;
  }
  if (req.body.bio !== undefined) data.bio = str(req.body.bio, 500) || null;
  if (req.body.phone !== undefined) data.phone = str(req.body.phone, 30) || null;
  if (req.body.school !== undefined) data.school = str(req.body.school, 120) || null;
  if (req.body.avatar !== undefined) data.avatar = str(req.body.avatar, 500) || null;
  const user = await prisma.user.update({ where: { id: req.user.id }, data });
  res.json(publicUser(user));
}));

router.get('/suggested', asyncHandler(async (req, res) => {
  const following = await prisma.follow.findMany({ where: { followerId: req.user.id }, select: { followingId: true } });
  const users = await prisma.user.findMany({
    where: { id: { notIn: [req.user.id, ...following.map((f) => f.followingId)] }, isVerified: true, isActive: true },
    select: card,
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  res.json(users.map((u) => ({ ...u, isFollowing: false })));
}));

router.get('/search', asyncHandler(async (req, res) => {
  const q = str(req.query.q, 60);
  if (q.length < 2) return res.json([]);
  const users = await prisma.user.findMany({
    where: { id: { not: req.user.id }, isVerified: true, isActive: true, fullName: { contains: q } },
    select: card,
    take: 20,
  });
  res.json(users);
}));

// Toggle follow / unfollow
router.post('/:userId/follow', asyncHandler(async (req, res) => {
  const targetId = req.params.userId;
  if (targetId === req.user.id) return res.status(400).json({ error: 'You cannot follow yourself' });
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!target) return res.status(404).json({ error: 'User not found' });

  const key = { followerId_followingId: { followerId: req.user.id, followingId: targetId } };
  const existing = await prisma.follow.findUnique({ where: key });
  if (existing) {
    await prisma.$transaction([
      prisma.follow.delete({ where: key }),
      prisma.user.update({ where: { id: targetId }, data: { followersCount: { decrement: 1 } } }),
      prisma.user.update({ where: { id: req.user.id }, data: { followingCount: { decrement: 1 } } }),
    ]);
    return res.json({ isFollowing: false });
  }
  await prisma.$transaction([
    prisma.follow.create({ data: { followerId: req.user.id, followingId: targetId } }),
    prisma.user.update({ where: { id: targetId }, data: { followersCount: { increment: 1 } } }),
    prisma.user.update({ where: { id: req.user.id }, data: { followingCount: { increment: 1 } } }),
  ]);
  emitToUser(targetId, 'user:followed', { userId: req.user.id });
  res.json({ isFollowing: true });
}));

module.exports = router;
