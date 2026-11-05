const express = require('express');
const prisma = require('../lib/prisma');
const { asyncHandler } = require('../lib/http');
const { authenticate } = require('../lib/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: limit }),
    prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
  ]);
  res.json({ items, unread });
}));

router.post('/read-all', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
  res.json({ success: true });
}));

router.post('/:id/read', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { isRead: true } });
  res.json({ success: true });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.notification.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  res.json({ success: true });
}));

module.exports = router;
