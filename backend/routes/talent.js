const express = require('express');
const prisma = require('../lib/prisma');
const { asyncHandler, str } = require('../lib/http');
const { authenticate } = require('../lib/auth');

const router = express.Router();
router.use(authenticate);

// Employers can browse students who hold an ACTIVE certificate. No email / phone is exposed.
router.get('/', asyncHandler(async (req, res) => {
  if (!['EMPLOYER', 'ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Employers only' });
  const q = str(req.query.q, 80);
  const where = {
    role: 'STUDENT', isActive: true, deletedAt: null, isVerified: true,
    certificates: { some: { status: 'ACTIVE' } },
    ...(q ? { OR: [{ fullName: { contains: q } }, { department: { contains: q } }, { school: { contains: q } }] } : {}),
  };
  const rows = await prisma.user.findMany({
    where,
    select: {
      id: true, fullName: true, avatar: true, school: true, department: true, bio: true,
      certificates: { where: { status: 'ACTIVE' }, select: { code: true, finalScore: true, issuedAt: true, module: { select: { name: true } } }, orderBy: { issuedAt: 'desc' } },
    },
    take: 100,
  });
  const people = rows.map((r) => {
    const scores = (r.certificates || []).map((c) => c.finalScore).filter((s) => typeof s === 'number');
    return { ...r, avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null };
  }).sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0));
  res.json(people);
}));

module.exports = router;
