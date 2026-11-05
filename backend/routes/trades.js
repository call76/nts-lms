const express = require('express');
const prisma = require('../lib/prisma');
const { asyncHandler, str } = require('../lib/http');
const { authenticate, requireAdmin } = require('../lib/auth');
const requireStaff = (req, res, next) => (['ADMIN', 'TRAINER'].includes(req.user?.role) ? next() : res.status(403).json({ error: 'Trainer or admin only' }));

// Only files that were uploaded through the system (/uploads/...) are accepted as module media.
const uploadedPath = (v) => { const s = str(v, 1500); return /^\/uploads\/[A-Za-z0-9._-]+$/.test(s) ? s : null; };
const hoursOf = (v) => { const n = parseInt(v, 10); return Number.isInteger(n) && n > 0 && n <= 2000 ? n : null; };

const router = express.Router();
router.use(authenticate);

const DEFAULT_TRADES = [
  { name: 'Software Development', icon: 'FaCode', color: 'bg-green-500', description: 'Learn programming, web development, mobile apps, and software engineering.' },
  { name: 'Networking & Internet Technologies', icon: 'FaNetworkWired', color: 'bg-blue-500', description: 'Network design, administration and security.' },
  { name: 'Computer Systems & Architecture', icon: 'FaMicrochip', color: 'bg-purple-500', description: 'Hardware, operating systems and system administration.' },
  { name: 'Electronics & Telecommunication', icon: 'FaBroadcastTower', color: 'bg-yellow-500', description: 'Electronic circuits, signals and telecommunication systems.' },
  { name: 'Multimedia & Production', icon: 'FaVideo', color: 'bg-red-500', description: 'Graphic design, video, audio and digital content production.' },
];

async function seedDefaultTrades() {
  if ((await prisma.trade.count()) === 0) {
    await prisma.trade.createMany({ data: DEFAULT_TRADES });
    console.log('✅ Default trades created');
  }
}

const shape = (t) => {
  const levels = { 1: [], 2: [], 3: [] };
  (t.modules || []).forEach((m) => (levels[m.level] || (levels[m.level] = [])).push(m));
  const { modules, ...rest } = t;
  return { ...rest, levels };
};

router.get('/', asyncHandler(async (req, res) => {
  const trades = await prisma.trade.findMany({
    include: { modules: { orderBy: [{ level: 'asc' }, { code: 'asc' }] } },
    orderBy: { id: 'asc' },
  });
  res.json(trades.map(shape));
}));

router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const name = str(req.body.name, 120);
  if (!name) return res.status(400).json({ error: 'Trade name is required' });
  const trade = await prisma.trade.create({
    data: { name, description: str(req.body.description, 500) || null, icon: str(req.body.icon, 40) || 'FaCode', color: str(req.body.color, 40) || 'bg-green-500' },
    include: { modules: true },
  });
  res.status(201).json(shape(trade));
}));

router.put('/modules/:moduleId', requireStaff, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.moduleId, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  const m = await prisma.module.findUnique({ where: { id } });
  if (!m) return res.status(404).json({ error: 'Module not found' });
  const data = {};
  if (req.body.name !== undefined) { data.name = str(req.body.name, 150); if (!data.name) return res.status(400).json({ error: 'Module name is required' }); }
  if (req.body.code !== undefined) {
    data.code = str(req.body.code, 30).toUpperCase(); if (!data.code) return res.status(400).json({ error: 'Module code is required' });
    const dup = await prisma.module.findFirst({ where: { tradeId: m.tradeId, code: data.code, NOT: { id } } });
    if (dup) return res.status(400).json({ error: `Module ${data.code} already exists in this trade` });
  }
  if (req.body.level !== undefined) { const l = parseInt(req.body.level, 10); if (![1, 2, 3].includes(l)) return res.status(400).json({ error: 'Level must be 1, 2 or 3' }); data.level = l; }
  if (req.body.description !== undefined) data.description = str(req.body.description, 1000) || null;
  if (req.body.coverUrl !== undefined) data.coverUrl = uploadedPath(req.body.coverUrl);
  if (req.body.introVideoUrl !== undefined) data.introVideoUrl = uploadedPath(req.body.introVideoUrl);
  if (req.body.hours !== undefined) data.hours = hoursOf(req.body.hours);
  res.json(await prisma.module.update({ where: { id }, data }));
}));

router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  const t = await prisma.trade.findUnique({ where: { id }, select: { id: true } });
  if (!t) return res.status(404).json({ error: 'Trade not found' });
  const data = {};
  if (req.body.name !== undefined) { data.name = str(req.body.name, 120); if (!data.name) return res.status(400).json({ error: 'Trade name is required' }); }
  if (req.body.description !== undefined) data.description = str(req.body.description, 500) || null;
  if (req.body.icon !== undefined) data.icon = str(req.body.icon, 40) || 'FaCode';
  if (req.body.color !== undefined) data.color = str(req.body.color, 40) || 'bg-green-500';
  res.json(await prisma.trade.update({ where: { id }, data }));
}));

router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  const t = await prisma.trade.findUnique({ where: { id }, select: { id: true } });
  if (!t) return res.status(404).json({ error: 'Trade not found' });
  await prisma.trade.delete({ where: { id } }); // modules cascade
  res.json({ success: true });
}));

router.post('/:id/modules', requireStaff, asyncHandler(async (req, res) => {
  const tradeId = parseInt(req.params.id, 10);
  const level = parseInt(req.body.level, 10);
  const code = str(req.body.code, 30).toUpperCase();
  const name = str(req.body.name, 150);
  if (!Number.isInteger(tradeId)) return res.status(400).json({ error: 'Invalid trade' });
  if (![1, 2, 3].includes(level)) return res.status(400).json({ error: 'Level must be 1, 2 or 3' });
  if (!code || !name) return res.status(400).json({ error: 'Module code and name are required' });
  const trade = await prisma.trade.findUnique({ where: { id: tradeId }, select: { id: true } });
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  const dup = await prisma.module.findUnique({ where: { tradeId_code: { tradeId, code } } });
  if (dup) return res.status(400).json({ error: `Module ${code} already exists in this trade` });
  const module = await prisma.module.create({
    data: {
      tradeId, level, code, name,
      description: str(req.body.description, 1000) || null,
      coverUrl: uploadedPath(req.body.coverUrl),
      introVideoUrl: uploadedPath(req.body.introVideoUrl),
      hours: hoursOf(req.body.hours),
    },
  });
  res.status(201).json(module);
}));

router.delete('/modules/:moduleId', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.moduleId, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  const m = await prisma.module.findUnique({ where: { id }, select: { id: true } });
  if (!m) return res.status(404).json({ error: 'Module not found' });
  await prisma.module.delete({ where: { id } });
  res.json({ success: true });
}));

module.exports = router;
module.exports.seedDefaultTrades = seedDefaultTrades;
