const express = require('express');
const prisma = require('../lib/prisma');
const { asyncHandler } = require('../lib/http');
const { authenticate } = require('../lib/auth');
const { attendanceSummary } = require('../lib/attendance');
const { notifyUsers } = require('../lib/notify');
const { studentWhere } = require('../lib/scope');
const KINDS = ['MARKS', 'CERTIFICATES', 'ATTENDANCE'];

const router = express.Router();
router.use(authenticate);

// A parent sees how the students linked to their account are doing.
router.get('/children', asyncHandler(async (req, res) => {
  if (!['PARENT', 'ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Parents only' });
  const where = { status: 'APPROVED', ...(req.user.role === 'ADMIN' && req.query.parentId ? { parentId: String(req.query.parentId) } : { parentId: req.user.id }) };
  const links = await prisma.parentStudent.findMany({
    where,
    include: {
      student: {
        select: {
          id: true, fullName: true, email: true, school: true, department: true, className: true,
          enrollments: { select: { progress: true, status: true, module: { select: { code: true, name: true } } } },
          quizAttempts: { select: { score: true, total: true, passed: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 8 },
          assignmentSubmissions: { select: { score: true, status: true, submittedAt: true, assignment: { select: { title: true, maxScore: true } } }, orderBy: { submittedAt: 'desc' }, take: 5 },
          certificates: { select: { code: true, status: true, issuedAt: true, module: { select: { name: true } } } },
        },
      },
    },
  });
  // V5.3: attendance chart data, teacher remarks and open conversations per child
  const out = [];
  for (const l of links) {
    const shares = new Set((await prisma.parentShare.findMany({ where: { studentId: l.student.id }, select: { kind: true } })).map((x) => x.kind));
    const [attendance, remarks, threads] = await Promise.all([
      attendanceSummary(l.student.id, { parentView: !shares.has('ATTENDANCE') }),
      prisma.teacherRemark.findMany({ where: { studentId: l.student.id }, orderBy: { createdAt: 'desc' }, take: 5, include: { trainer: { select: { fullName: true } } } }),
      prisma.familyThread.count({ where: { parentId: l.parentId, studentId: l.student.id, status: 'OPEN' } }),
    ]);
    // The parent always sees the modules the child studies; marks, certificates and full attendance only when a trainer/admin shared them.
    const child = { ...l.student };
    if (!shares.has('MARKS')) { child.quizAttempts = []; child.assignmentSubmissions = []; }
    if (!shares.has('CERTIFICATES')) child.certificates = [];
    out.push({ relationship: l.relationship, ...child, attendance, remarks, openThreads: threads, shared: { MARKS: shares.has('MARKS'), CERTIFICATES: shares.has('CERTIFICATES'), ATTENDANCE: shares.has('ATTENDANCE') } });
  }
  res.json(out);
}));

// A parent who registered themselves must be approved by the student (or an admin) before seeing anything.
router.get('/requests', asyncHandler(async (req, res) => {
  if (req.user.role === 'PARENT') {
    return res.json(await prisma.parentStudent.findMany({ where: { parentId: req.user.id, status: 'PENDING' }, include: { student: { select: { id: true, fullName: true } } } }));
  }
  const where = req.user.role === 'ADMIN' ? { status: 'PENDING' } : { studentId: req.user.id, status: 'PENDING' };
  res.json(await prisma.parentStudent.findMany({ where, include: { parent: { select: { id: true, fullName: true, email: true } }, student: { select: { id: true, fullName: true } } } }));
}));

router.put('/requests/:id', asyncHandler(async (req, res) => {
  const link = await prisma.parentStudent.findUnique({ where: { id: req.params.id } });
  if (!link || (req.user.role !== 'ADMIN' && link.studentId !== req.user.id)) return res.status(404).json({ error: 'Request not found' });
  if (req.body.action === 'approve') {
    await prisma.parentStudent.update({ where: { id: link.id }, data: { status: 'APPROVED' } });
    notifyUsers([link.parentId], { type: 'INFO', title: 'Link approved', body: 'You can now follow your child in the Parent Portal.', link: '/parent' });
  } else {
    await prisma.parentStudent.delete({ where: { id: link.id } });
  }
  res.json({ success: true });
}));

// ---------- trainer / admin decide what each student's parents may see ----------
router.get('/share-list', asyncHandler(async (req, res) => {
  if (!['TRAINER', 'ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Teachers only' });
  const where = { status: 'APPROVED', student: await studentWhere(req.user) };
  const links = await prisma.parentStudent.findMany({ where, include: { parent: { select: { fullName: true } }, student: { select: { id: true, fullName: true, className: true } } }, take: 400 });
  const ids = [...new Set(links.map((l) => l.studentId))];
  const shares = await prisma.parentShare.findMany({ where: { studentId: { in: ids } } });
  res.json(ids.map((id) => {
    const rows = links.filter((l) => l.studentId === id);
    return { studentId: id, studentName: rows[0].student.fullName, className: rows[0].student.className, parents: rows.map((r) => r.parent.fullName), shared: Object.fromEntries(KINDS.map((k) => [k, shares.some((s) => s.studentId === id && s.kind === k)])) };
  }));
}));

router.put('/share', asyncHandler(async (req, res) => {
  if (!['TRAINER', 'ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Teachers only' });
  const studentId = String(req.body.studentId || '');
  const kind = String(req.body.kind || '').toUpperCase();
  if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Unknown kind' });
  const allowed = await prisma.user.findFirst({ where: { id: studentId, role: 'STUDENT', ...(await studentWhere(req.user)) }, select: { id: true } });
  if (!allowed) return res.status(403).json({ error: 'This student is not in your classes' });
  if (req.body.enabled) {
    await prisma.parentShare.upsert({ where: { studentId_kind: { studentId, kind } }, update: { grantedById: req.user.id }, create: { studentId, kind, grantedById: req.user.id } });
    const parents = await prisma.parentStudent.findMany({ where: { studentId, status: 'APPROVED' }, select: { parentId: true } });
    const label = { MARKS: 'marks', CERTIFICATES: 'certificates', ATTENDANCE: 'attendance' }[kind];
    notifyUsers(parents.map((p) => p.parentId), { type: 'INFO', title: `New information about your child: ${label}`, body: 'A teacher shared this with you.', link: '/parent' });
  } else {
    await prisma.parentShare.deleteMany({ where: { studentId, kind } });
  }
  res.json({ success: true });
}));

module.exports = router;
