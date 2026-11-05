const express = require('express');
const prisma = require('../lib/prisma');
const { asyncHandler } = require('../lib/http');
const { authenticate } = require('../lib/auth');

const router = express.Router();
router.use(authenticate);

const dayKey = (d) => d.toISOString().slice(0, 10);
const lastDays = (n) => Array.from({ length: n }, (_, i) => dayKey(new Date(Date.now() - (n - 1 - i) * 86_400_000)));

// One request that feeds the whole dashboard (shape depends on the role).
router.get('/overview', asyncHandler(async (req, res) => {
  const me = req.user;
  const now = new Date();
  const out = { role: me.role };

  const annWhere = me.role === 'ADMIN' ? {} : { AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, { OR: [{ audience: 'ALL' }, { audience: me.role }] }] };
  const [announcements, unread] = await Promise.all([
    prisma.announcement.findMany({ where: annWhere, orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }], take: 3 }),
    prisma.notification.count({ where: { userId: me.id, isRead: false } }),
  ]);
  out.announcements = announcements;
  out.unreadNotifications = unread;

  if (me.role === 'ADMIN') {
    const days = lastDays(14);
    const [users, active, inactive, byRole, pendingVerifications, pendingCertificates, openReports, activeInternships, pendingApplications, posts, signupRows, recentUsers, audit] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, isActive: true } }),
      prisma.user.count({ where: { deletedAt: null, isActive: false } }),
      prisma.user.groupBy({ by: ['role'], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.user.count({ where: { verificationStatus: 'PENDING', deletedAt: null } }),
      prisma.certificateRequest.count({ where: { status: 'PENDING' } }),
      prisma.report.count({ where: { status: 'OPEN' } }),
      prisma.internship.count({ where: { isActive: true } }),
      prisma.internshipApplication.count({ where: { status: 'PENDING' } }),
      prisma.post.count({ where: { isDeleted: false } }),
      prisma.user.findMany({ where: { createdAt: { gte: new Date(`${days[0]}T00:00:00.000Z`) } }, select: { createdAt: true }, take: 5000 }),
      prisma.user.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, fullName: true, email: true, role: true, isActive: true, createdAt: true } }),
      prisma.adminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),
    ]);
    const buckets = Object.fromEntries(days.map((d) => [d, 0]));
    signupRows.forEach((r) => { const k = dayKey(new Date(r.createdAt)); if (k in buckets) buckets[k] += 1; });
    const ids = [...new Set(audit.flatMap((a) => [a.actorId, a.targetId]).filter(Boolean))];
    const people = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
    const nameOf = Object.fromEntries(people.map((p) => [p.id, p.fullName]));
    const roleCount = Object.fromEntries(byRole.map((r) => [r.role, r._count._all]));
    out.kpis = { users, active, inactive, pendingVerifications, pendingCertificates, openReports, activeInternships, pendingApplications, posts, students: roleCount.STUDENT || 0, trainers: roleCount.TRAINER || 0, parents: roleCount.PARENT || 0, employers: roleCount.EMPLOYER || 0 };
    out.roleBreakdown = byRole.map((r) => ({ role: r.role, count: r._count._all })).sort((a, b) => b.count - a.count);
    out.signups = days.map((d) => ({ date: d, count: buckets[d] }));
    out.recentUsers = recentUsers;
    out.recentActivity = audit.map((a) => ({ id: a.id, action: a.action, createdAt: a.createdAt, actor: nameOf[a.actorId] || null, target: a.targetId ? nameOf[a.targetId] || null : null }));
  } else if (me.role === 'TRAINER') {
    const mine = { trainerId: me.id };
    const [lm, am, qm, toGrade, recent, lessons, quizzes] = await Promise.all([
      prisma.lesson.findMany({ where: mine, select: { moduleId: true }, distinct: ['moduleId'] }),
      prisma.assignment.findMany({ where: mine, select: { moduleId: true }, distinct: ['moduleId'] }),
      prisma.quiz.findMany({ where: mine, select: { moduleId: true }, distinct: ['moduleId'] }),
      prisma.assignmentSubmission.count({ where: { status: 'SUBMITTED', assignment: mine } }),
      prisma.assignmentSubmission.findMany({ where: { status: 'SUBMITTED', assignment: mine }, orderBy: { submittedAt: 'desc' }, take: 5, select: { id: true, submittedAt: true, student: { select: { fullName: true } }, assignment: { select: { title: true } } } }),
      prisma.lesson.count({ where: mine }),
      prisma.quiz.count({ where: mine }),
    ]);
    const moduleIds = [...new Set([...lm, ...am, ...qm].map((x) => x.moduleId))];
    const students = moduleIds.length ? (await prisma.courseEnrollment.findMany({ where: { moduleId: { in: moduleIds } }, select: { userId: true }, distinct: ['userId'] })).length : 0;
    out.kpis = { modules: moduleIds.length, students, toGrade, lessons, quizzes };
    out.toGrade = recent;
  } else if (me.role === 'STUDENT') {
    const [enrollments, enrolled, avg, certificates, quiz, applications] = await Promise.all([
      prisma.courseEnrollment.findMany({ where: { userId: me.id }, orderBy: { updatedAt: 'desc' }, take: 6, include: { module: { select: { id: true, code: true, name: true } } } }),
      prisma.courseEnrollment.count({ where: { userId: me.id } }),
      prisma.courseEnrollment.aggregate({ where: { userId: me.id }, _avg: { progress: true } }),
      prisma.certificate.count({ where: { studentId: me.id, status: 'ACTIVE' } }),
      prisma.quizAttempt.aggregate({ where: { studentId: me.id }, _sum: { score: true, total: true } }),
      prisma.internshipApplication.count({ where: { studentId: me.id } }),
    ]);
    const moduleIds = enrollments.map((e) => e.moduleId);
    const [upcoming, grades] = await Promise.all([
      moduleIds.length ? prisma.assignment.findMany({ where: { published: true, moduleId: { in: moduleIds }, dueAt: { gte: now }, submissions: { none: { studentId: me.id } } }, orderBy: { dueAt: 'asc' }, take: 5, select: { id: true, title: true, dueAt: true, maxScore: true, module: { select: { code: true, name: true } } } }) : [],
      prisma.assignmentSubmission.findMany({ where: { studentId: me.id, status: 'GRADED' }, orderBy: { gradedAt: 'desc' }, take: 5, select: { id: true, score: true, gradedAt: true, assignment: { select: { title: true, maxScore: true } } } }),
    ]);
    const qTotal = quiz._sum.total || 0;
    out.kpis = { enrolled, avgProgress: Math.round(avg._avg.progress || 0), certificates, quizAverage: qTotal ? Math.round(((quiz._sum.score || 0) / qTotal) * 100) : null, applications };
    out.courses = enrollments.map((e) => ({ id: e.id, moduleId: e.moduleId, code: e.module.code, name: e.module.name, progress: e.progress, status: e.status }));
    out.upcoming = upcoming;
    out.recentGrades = grades;
  } else if (me.role === 'PARENT') {
    const links = await prisma.parentStudent.findMany({
      where: { parentId: me.id, status: 'APPROVED' },
      include: { student: { select: { id: true, fullName: true, className: true, department: true, enrollments: { select: { progress: true } } } } },
    });
    out.children = links.map((l) => {
      const p = l.student.enrollments.map((e) => e.progress);
      return { id: l.student.id, fullName: l.student.fullName, className: l.student.className, department: l.student.department, relationship: l.relationship, avgProgress: p.length ? Math.round(p.reduce((a, b) => a + b, 0) / p.length) : 0, courses: p.length };
    });
  } else if (me.role === 'EMPLOYER') {
    const [talent, internships, applications] = await Promise.all([
      prisma.user.count({ where: { role: 'STUDENT', isActive: true, deletedAt: null, certificates: { some: { status: 'ACTIVE' } } } }),
      prisma.internship.count({ where: { isActive: true } }),
      prisma.internshipApplication.count(),
    ]);
    out.kpis = { talent, internships, applications };
  }
  res.json(out);
}));

// Top students by average score across quizzes and graded assignments
router.get('/leaderboard', asyncHandler(async (req, res) => {
  const [quiz, subs] = await Promise.all([
    prisma.quizAttempt.groupBy({ by: ['studentId'], _sum: { score: true, total: true }, _count: { _all: true } }),
    prisma.assignmentSubmission.findMany({ where: { status: 'GRADED', score: { not: null } }, select: { studentId: true, score: true, assignment: { select: { maxScore: true } } }, take: 5000 }),
  ]);
  const acc = new Map();
  const row = (id) => { if (!acc.has(id)) acc.set(id, { id, qs: 0, qt: 0, as: 0, am: 0, n: 0 }); return acc.get(id); };
  quiz.forEach((g) => { const r = row(g.studentId); r.qs += g._sum.score || 0; r.qt += g._sum.total || 0; r.n += g._count._all; });
  subs.forEach((s) => { const r = row(s.studentId); r.as += s.score || 0; r.am += s.assignment?.maxScore || 0; r.n += 1; });
  const scored = [...acc.values()].map((r) => {
    const parts = [];
    if (r.qt) parts.push((r.qs / r.qt) * 100);
    if (r.am) parts.push((r.as / r.am) * 100);
    return { id: r.id, percent: parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 0, activities: r.n };
  });
  const people = await prisma.user.findMany({ where: { id: { in: scored.map((r) => r.id) }, role: 'STUDENT', isActive: true, deletedAt: null }, select: { id: true, fullName: true, avatar: true, className: true } });
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  const ranked = scored.filter((r) => byId[r.id]).sort((a, b) => b.percent - a.percent || b.activities - a.activities)
    .map((r, i) => ({ rank: i + 1, ...byId[r.id], percent: r.percent, activities: r.activities }));
  res.json({ top: ranked.slice(0, 10), me: ranked.find((r) => r.id === req.user.id) || null, total: ranked.length });
}));

module.exports = router;
