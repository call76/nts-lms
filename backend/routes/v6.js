// V6: analytics, TVET competency assessment, internship logbook + evaluation, fees, timetable, AI tutor.
const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { authenticate } = require('../lib/auth');
const { asyncHandler, str, rateLimit } = require('../lib/http');
const { notifyUsers } = require('../lib/notify');
const { studentWhere } = require('../lib/scope');
const router = express.Router();
router.use(authenticate);

const isStaff = (u) => ['ADMIN', 'TRAINER'].includes(u.role);
const need = (...roles) => (req, res, next) => (roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'You do not have access to this section' }));
const json = (raw, fb = []) => { try { const v = JSON.parse(raw); return v ?? fb; } catch { return fb; } };
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const sendCsv = (res, name, rows) => { res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${name}"`); res.send('\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')); };
const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v)) || lo));

/* ===================== ANALYTICS ===================== */
async function studentStats(ids) {
  if (!ids.length) return new Map();
  const [attempts, subs, enrolls, att] = await Promise.all([
    prisma.quizAttempt.findMany({ where: { studentId: { in: ids } }, select: { studentId: true, quizId: true, score: true } }),
    prisma.assignmentSubmission.findMany({ where: { studentId: { in: ids }, status: 'GRADED', score: { not: null } }, select: { studentId: true, score: true, assignment: { select: { maxScore: true } } } }),
    prisma.courseEnrollment.findMany({ where: { userId: { in: ids } }, select: { userId: true, progress: true } }),
    prisma.attendance.findMany({ where: { studentId: { in: ids } }, select: { studentId: true, status: true } }),
  ]);
  const out = new Map(ids.map((id) => [id, { scores: [], progress: [], present: 0, attDays: 0 }]));
  const bestQuiz = new Map();
  attempts.forEach((a) => { const k = `${a.studentId}:${a.quizId}`; bestQuiz.set(k, Math.max(bestQuiz.get(k) ?? 0, a.score)); });
  bestQuiz.forEach((v, k) => out.get(k.split(':')[0])?.scores.push(v));
  subs.forEach((s) => out.get(s.studentId)?.scores.push(s.assignment.maxScore ? (s.score / s.assignment.maxScore) * 100 : 0));
  enrolls.forEach((e) => out.get(e.userId)?.progress.push(e.progress));
  att.forEach((a) => { const o = out.get(a.studentId); if (!o) return; o.attDays += 1; if (['PRESENT', 'LATE', 'EXCUSED'].includes(a.status)) o.present += 1; });
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((x, y) => x + y, 0) / arr.length) : null);
  const res = new Map();
  out.forEach((o, id) => res.set(id, { average: avg(o.scores), progress: avg(o.progress), attendance: o.attDays ? Math.round((o.present / o.attDays) * 100) : null, assessments: o.scores.length }));
  return res;
}
const riskOf = (s) => { const r = []; if (s.average !== null && s.average < 50) r.push('Low marks'); if (s.attendance !== null && s.attendance < 75) r.push('Poor attendance'); if (s.assessments === 0) r.push('No assessments yet'); return r; };

router.get('/analytics/overview', need('ADMIN', 'TRAINER'), asyncHandler(async (req, res) => {
  const students = await prisma.user.findMany({ where: { role: 'STUDENT', deletedAt: null, isActive: true, ...(await studentWhere(req.user)) }, select: { id: true, fullName: true, email: true, className: true, department: true }, take: 1000 });
  const stats = await studentStats(students.map((s) => s.id));
  const rows = students.map((s) => { const st = stats.get(s.id); return { ...s, ...st, risks: riskOf(st) }; });
  if (req.query.format === 'csv') return sendCsv(res, 'student-performance.csv', [['Student', 'Email', 'Class', 'Average %', 'Progress %', 'Attendance %', 'Assessments', 'Alerts'], ...rows.map((r) => [r.fullName, r.email, r.className || '', r.average ?? '', r.progress ?? '', r.attendance ?? '', r.assessments, r.risks.join('; ')])]);
  const graded = rows.filter((r) => r.average !== null);
  const modules = await prisma.module.findMany({ select: { id: true, name: true, code: true } });
  const quizzes = await prisma.quiz.findMany({ where: { published: true }, select: { id: true, moduleId: true } });
  const att = await prisma.quizAttempt.findMany({ where: { quizId: { in: quizzes.map((q) => q.id) }, studentId: { in: students.map((s) => s.id) } }, select: { quizId: true, score: true } });
  const byMod = new Map();
  att.forEach((a) => { const m = quizzes.find((q) => q.id === a.quizId)?.moduleId; if (!m) return; const e = byMod.get(m) || { sum: 0, n: 0 }; e.sum += a.score; e.n += 1; byMod.set(m, e); });
  const hardModules = [...byMod.entries()].map(([id, e]) => ({ ...modules.find((m) => m.id === id), average: Math.round(e.sum / e.n), attempts: e.n })).filter((m) => m.name).sort((a, b) => a.average - b.average).slice(0, 6);
  res.json({
    summary: { students: rows.length, average: graded.length ? Math.round(graded.reduce((a, r) => a + r.average, 0) / graded.length) : null, passing: graded.filter((r) => r.average >= 50).length, failing: graded.filter((r) => r.average < 50).length, atRisk: rows.filter((r) => r.risks.length).length },
    atRisk: rows.filter((r) => r.risks.length).sort((a, b) => b.risks.length - a.risks.length).slice(0, 50),
    top: [...graded].sort((a, b) => b.average - a.average).slice(0, 10),
    hardModules, students: rows,
  });
}));
router.get('/analytics/me', need('STUDENT'), asyncHandler(async (req, res) => {
  const stats = (await studentStats([req.user.id])).get(req.user.id);
  const rank = await prisma.user.findMany({ where: { role: 'STUDENT', deletedAt: null, isActive: true, ...(await prismaClass(req.user.id)) }, select: { id: true }, take: 500 });
  const all = await studentStats(rank.map((r) => r.id));
  const ordered = [...all.entries()].filter(([, v]) => v.average !== null).sort((a, b) => b[1].average - a[1].average);
  const pos = ordered.findIndex(([id]) => id === req.user.id);
  res.json({ ...stats, risks: riskOf(stats), rank: pos >= 0 ? pos + 1 : null, outOf: ordered.length });
}));
async function prismaClass(userId) { const me = await prisma.user.findUnique({ where: { id: userId }, select: { classGroupId: true } }); return me?.classGroupId ? { classGroupId: me.classGroupId } : {}; }

/* ===================== TVET COMPETENCY ===================== */
router.get('/competencies', asyncHandler(async (req, res) => {
  const where = req.query.moduleId ? { moduleId: Number(req.query.moduleId) } : {};
  const rows = await prisma.competency.findMany({ where, orderBy: [{ moduleId: 'asc' }, { code: 'asc' }], take: 300 });
  const mods = await prisma.module.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.moduleId))] } }, select: { id: true, name: true } });
  res.json(rows.map((r) => ({ ...r, criteria: json(r.criteria), module: mods.find((m) => m.id === r.moduleId)?.name || '' })));
}));
router.post('/competencies', need('ADMIN', 'TRAINER'), asyncHandler(async (req, res) => {
  const moduleId = Number(req.body.moduleId), title = str(req.body.title, 200), code = str(req.body.code, 30).toUpperCase();
  const criteria = (Array.isArray(req.body.criteria) ? req.body.criteria : String(req.body.criteria || '').split('\n')).map((c) => str(c, 300)).filter(Boolean).slice(0, 30);
  if (!moduleId || !title || !code) return res.status(400).json({ error: 'Module, code and title are required' });
  if (!criteria.length) return res.status(400).json({ error: 'Add at least one performance criterion' });
  if (!(await prisma.module.findUnique({ where: { id: moduleId }, select: { id: true } }))) return res.status(404).json({ error: 'Module not found' });
  res.status(201).json(await prisma.competency.create({ data: { moduleId, code, title, criteria: JSON.stringify(criteria), createdById: req.user.id } }));
}));
router.delete('/competencies/:id', need('ADMIN', 'TRAINER'), asyncHandler(async (req, res) => {
  const row = await prisma.competency.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'ADMIN' && row.createdById !== req.user.id) return res.status(403).json({ error: 'You can only delete your own competencies' });
  await prisma.competencyAssessment.deleteMany({ where: { competencyId: row.id } });
  await prisma.competency.delete({ where: { id: row.id } });
  res.json({ success: true });
}));
router.post('/competencies/:id/assess', need('ADMIN', 'TRAINER'), asyncHandler(async (req, res) => {
  const comp = await prisma.competency.findUnique({ where: { id: req.params.id } });
  if (!comp) return res.status(404).json({ error: 'Competency not found' });
  const studentId = str(req.body.studentId, 100);
  const student = await prisma.user.findFirst({ where: { id: studentId, role: 'STUDENT', deletedAt: null, ...(await studentWhere(req.user)) }, select: { id: true } });
  if (!student) return res.status(404).json({ error: 'Student not found in your classes' });
  const total = json(comp.criteria).length;
  const checked = [...new Set((Array.isArray(req.body.checked) ? req.body.checked : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < total))];
  const status = checked.length === total ? 'COMPETENT' : 'NOT_YET';
  const evidenceUrl = /^(https?:\/\/|\/uploads\/)/i.test(str(req.body.evidenceUrl, 1500)) ? str(req.body.evidenceUrl, 1500) : null;
  const data = { assessorId: req.user.id, status, checked: JSON.stringify(checked), comment: str(req.body.comment, 2000) || null, ...(evidenceUrl ? { evidenceUrl } : {}) };
  const row = await prisma.competencyAssessment.upsert({ where: { competencyId_studentId: { competencyId: comp.id, studentId } }, create: { competencyId: comp.id, studentId, ...data }, update: data });
  notifyUsers([studentId], { type: 'GRADE', title: status === 'COMPETENT' ? `Competent: ${comp.title}` : `Not yet competent: ${comp.title}`, body: data.comment || null, link: '/campus' });
  res.json(row);
}));
// portfolio: a student's competency record (student themself, staff, or an approved parent)
router.get('/competencies/portfolio/:studentId?', asyncHandler(async (req, res) => {
  const studentId = req.params.studentId || req.user.id;
  if (studentId !== req.user.id && !isStaff(req.user)) {
    const link = req.user.role === 'PARENT' ? await prisma.parentStudent.findFirst({ where: { parentId: req.user.id, studentId, status: 'APPROVED' } }) : null;
    if (!link) return res.status(403).json({ error: 'Not allowed' });
  }
  const [comps, assessed] = await Promise.all([prisma.competency.findMany({ orderBy: [{ moduleId: 'asc' }, { code: 'asc' }] }), prisma.competencyAssessment.findMany({ where: { studentId } })]);
  const mods = await prisma.module.findMany({ select: { id: true, name: true } });
  const rows = comps.map((c) => { const a = assessed.find((x) => x.competencyId === c.id); return { id: c.id, code: c.code, title: c.title, module: mods.find((m) => m.id === c.moduleId)?.name || '', criteria: json(c.criteria), status: a?.status || 'NOT_ASSESSED', checked: a ? json(a.checked) : [], comment: a?.comment || null, evidenceUrl: a?.evidenceUrl || null, assessedAt: a?.updatedAt || null }; });
  res.json({ total: rows.length, competent: rows.filter((r) => r.status === 'COMPETENT').length, rows });
}));

/* ===================== INTERNSHIP LOGBOOK + EVALUATION ===================== */
async function canReview(user) {
  if (['ADMIN', 'EMPLOYER'].includes(user.role)) return true;
  if (user.role !== 'TRAINER') return false;
  return Boolean((await prisma.user.findUnique({ where: { id: user.id }, select: { canEditInternships: true } }))?.canEditInternships);
}
router.get('/logbook/applications', asyncHandler(async (req, res) => {
  const where = req.user.role === 'STUDENT' ? { studentId: req.user.id, status: { in: ['APPROVED', 'IN_PROGRESS', 'COMPLETED'] } } : (await canReview(req.user)) ? { status: { in: ['APPROVED', 'IN_PROGRESS', 'COMPLETED'] } } : null;
  if (!where) return res.json([]);
  const apps = await prisma.internshipApplication.findMany({ where, include: { internship: { select: { title: true, company: true } }, student: { select: { id: true, fullName: true } } }, orderBy: { appliedAt: 'desc' }, take: 200 });
  const logs = await prisma.internshipLog.groupBy({ by: ['applicationId', 'status'], where: { applicationId: { in: apps.map((a) => a.id) } }, _count: { _all: true }, _sum: { hours: true } });
  const evals = await prisma.internshipEvaluation.findMany({ where: { applicationId: { in: apps.map((a) => a.id) } } });
  res.json(apps.map((a) => { const l = logs.filter((x) => x.applicationId === a.id); return { id: a.id, status: a.status, internship: a.internship, student: a.student, logs: l.reduce((n, x) => n + x._count._all, 0), pending: l.filter((x) => x.status === 'SUBMITTED').reduce((n, x) => n + x._count._all, 0), hours: l.filter((x) => x.status === 'APPROVED').reduce((n, x) => n + (x._sum.hours || 0), 0), evaluation: evals.find((e) => e.applicationId === a.id) || null }; }));
}));
router.get('/logbook/:applicationId', asyncHandler(async (req, res) => {
  const app = await prisma.internshipApplication.findUnique({ where: { id: req.params.applicationId } });
  if (!app) return res.status(404).json({ error: 'Internship not found' });
  if (app.studentId !== req.user.id && !(await canReview(req.user))) return res.status(403).json({ error: 'Not allowed' });
  res.json(await prisma.internshipLog.findMany({ where: { applicationId: app.id }, orderBy: { logDate: 'desc' }, take: 400 }));
}));
router.post('/logbook/:applicationId', need('STUDENT'), asyncHandler(async (req, res) => {
  const app = await prisma.internshipApplication.findUnique({ where: { id: req.params.applicationId }, include: { internship: { select: { title: true } } } });
  if (!app || app.studentId !== req.user.id) return res.status(404).json({ error: 'Internship not found' });
  if (!['APPROVED', 'IN_PROGRESS'].includes(app.status)) return res.status(409).json({ error: 'You can write the logbook while the internship is approved or in progress' });
  const logDate = new Date(req.body.logDate || Date.now());
  const activities = str(req.body.activities, 4000);
  if (isNaN(logDate) || logDate > new Date(Date.now() + 86400000)) return res.status(400).json({ error: 'Choose a valid date (not in the future)' });
  if (!activities) return res.status(400).json({ error: 'Describe what you did' });
  const row = await prisma.internshipLog.create({ data: { applicationId: app.id, studentId: req.user.id, logDate, hours: Math.min(16, Math.max(0.5, Number(req.body.hours) || 8)), activities } });
  const reviewers = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
  notifyUsers(reviewers.map((u) => u.id), { type: 'INFO', title: 'New internship logbook entry', body: app.internship.title, link: '/campus' });
  res.status(201).json(row);
}));
router.delete('/logbook/entry/:id', need('STUDENT'), asyncHandler(async (req, res) => {
  const row = await prisma.internshipLog.findUnique({ where: { id: req.params.id } });
  if (!row || row.studentId !== req.user.id) return res.status(404).json({ error: 'Entry not found' });
  if (row.status !== 'SUBMITTED') return res.status(409).json({ error: 'Reviewed entries cannot be deleted' });
  await prisma.internshipLog.delete({ where: { id: row.id } });
  res.json({ success: true });
}));
router.patch('/logbook/entry/:id/review', asyncHandler(async (req, res) => {
  if (!(await canReview(req.user))) return res.status(403).json({ error: 'You cannot review logbooks' });
  const status = String(req.body.status || '').toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(status)) return res.status(400).json({ error: 'Status must be APPROVED or REJECTED' });
  const row = await prisma.internshipLog.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: 'Entry not found' });
  const upd = await prisma.internshipLog.update({ where: { id: row.id }, data: { status, reviewComment: str(req.body.comment, 1000) || null, reviewedById: req.user.id } });
  notifyUsers([row.studentId], { type: 'INFO', title: `Logbook entry ${status.toLowerCase()}`, body: upd.reviewComment, link: '/campus' });
  res.json(upd);
}));
router.post('/logbook/:applicationId/evaluation', asyncHandler(async (req, res) => {
  if (!(await canReview(req.user))) return res.status(403).json({ error: 'You cannot evaluate interns' });
  const app = await prisma.internshipApplication.findUnique({ where: { id: req.params.applicationId } });
  if (!app) return res.status(404).json({ error: 'Internship not found' });
  const d = { punctuality: clampInt(req.body.punctuality, 1, 5), skills: clampInt(req.body.skills, 1, 5), teamwork: clampInt(req.body.teamwork, 1, 5), attitude: clampInt(req.body.attitude, 1, 5), comment: str(req.body.comment, 2000) || null, evaluatorId: req.user.id };
  const row = await prisma.internshipEvaluation.upsert({ where: { applicationId: app.id }, create: { applicationId: app.id, ...d }, update: d });
  notifyUsers([app.studentId], { type: 'INFO', title: 'Your internship was evaluated', body: d.comment, link: '/campus' });
  res.json(row);
}));
router.get('/logbook/:applicationId/evaluation', asyncHandler(async (req, res) => {
  const app = await prisma.internshipApplication.findUnique({ where: { id: req.params.applicationId } });
  if (!app) return res.status(404).json({ error: 'Internship not found' });
  if (app.studentId !== req.user.id && !(await canReview(req.user))) return res.status(403).json({ error: 'Not allowed' });
  res.json(await prisma.internshipEvaluation.findUnique({ where: { applicationId: app.id } }));
}));

/* ===================== FEES ===================== */
const adminOnly = need('ADMIN');
const receiptNo = () => `RCT-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
async function balances(studentIds) {
  const [students, items, pays] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: studentIds } }, select: { id: true, fullName: true, email: true, className: true, classGroupId: true } }),
    prisma.feeItem.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.feePayment.findMany({ where: { studentId: { in: studentIds } } }),
  ]);
  return students.map((s) => {
    const mine = items.filter((i) => !i.classGroupId || i.classGroupId === s.classGroupId);
    const due = mine.reduce((n, i) => n + i.amount, 0);
    const paid = pays.filter((p) => p.studentId === s.id).reduce((n, p) => n + p.amount, 0);
    const overdue = mine.some((i) => i.dueDate && new Date(i.dueDate) < new Date()) && due > paid;
    return { student: { id: s.id, fullName: s.fullName, email: s.email, className: s.className }, due, paid, balance: Math.max(0, due - paid), overdue };
  });
}
router.get('/fees/items', need('ADMIN', 'STUDENT', 'PARENT'), asyncHandler(async (req, res) => res.json(await prisma.feeItem.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }))));
router.post('/fees/items', adminOnly, asyncHandler(async (req, res) => {
  const title = str(req.body.title, 150), amount = Math.round(Number(req.body.amount));
  if (!title || !(amount > 0)) return res.status(400).json({ error: 'Title and a positive amount are required' });
  const dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
  if (dueDate && isNaN(dueDate)) return res.status(400).json({ error: 'Invalid due date' });
  res.status(201).json(await prisma.feeItem.create({ data: { title, amount, dueDate, classGroupId: str(req.body.classGroupId, 100) || null } }));
}));
router.delete('/fees/items/:id', adminOnly, asyncHandler(async (req, res) => {
  if (await prisma.feePayment.findFirst({ where: { feeItemId: req.params.id } })) return res.status(409).json({ error: 'This fee already has payments and cannot be deleted' });
  await prisma.feeItem.deleteMany({ where: { id: req.params.id } });
  res.json({ success: true });
}));
router.get('/fees/summary', adminOnly, asyncHandler(async (req, res) => {
  const students = await prisma.user.findMany({ where: { role: 'STUDENT', deletedAt: null, isActive: true }, select: { id: true }, take: 2000 });
  const rows = await balances(students.map((s) => s.id));
  if (req.query.format === 'csv') return sendCsv(res, 'fees-report.csv', [['Student', 'Email', 'Class', 'Due', 'Paid', 'Balance'], ...rows.map((r) => [r.student.fullName, r.student.email, r.student.className || '', r.due, r.paid, r.balance])]);
  res.json({ totals: { due: rows.reduce((n, r) => n + r.due, 0), paid: rows.reduce((n, r) => n + r.paid, 0), balance: rows.reduce((n, r) => n + r.balance, 0), withBalance: rows.filter((r) => r.balance > 0).length }, rows: rows.sort((a, b) => b.balance - a.balance) });
}));
router.get('/fees/mine', need('STUDENT', 'PARENT'), asyncHandler(async (req, res) => {
  let ids = [req.user.id];
  if (req.user.role === 'PARENT') ids = (await prisma.parentStudent.findMany({ where: { parentId: req.user.id, status: 'APPROVED' }, select: { studentId: true } })).map((l) => l.studentId);
  const rows = await balances(ids);
  const payments = await prisma.feePayment.findMany({ where: { studentId: { in: ids } }, orderBy: { paidAt: 'desc' }, take: 100 });
  const items = await prisma.feeItem.findMany();
  res.json({ balances: rows, payments: payments.map((p) => ({ ...p, item: items.find((i) => i.id === p.feeItemId)?.title || '' })) });
}));
router.post('/fees/payments', adminOnly, asyncHandler(async (req, res) => {
  const item = await prisma.feeItem.findUnique({ where: { id: str(req.body.feeItemId, 100) } });
  const student = await prisma.user.findFirst({ where: { id: str(req.body.studentId, 100), role: 'STUDENT' }, select: { id: true } });
  const amount = Math.round(Number(req.body.amount));
  if (!item || !student) return res.status(404).json({ error: 'Fee item or student not found' });
  if (!(amount > 0)) return res.status(400).json({ error: 'Enter the amount paid' });
  const method = ['CASH', 'MOBILE_MONEY', 'BANK'].includes(req.body.method) ? req.body.method : 'CASH';
  const row = await prisma.feePayment.create({ data: { feeItemId: item.id, studentId: student.id, amount, method, reference: str(req.body.reference, 100) || null, receiptNo: receiptNo(), recordedById: req.user.id } });
  notifyUsers([student.id], { type: 'INFO', title: 'Payment received', body: `${amount.toLocaleString()} RWF for ${item.title}. Receipt ${row.receiptNo}`, link: '/campus' });
  res.status(201).json(row);
}));
router.get('/fees/receipt/:id', asyncHandler(async (req, res) => {
  const p = await prisma.feePayment.findUnique({ where: { id: req.params.id } });
  if (!p) return res.status(404).json({ error: 'Receipt not found' });
  if (req.user.role !== 'ADMIN' && p.studentId !== req.user.id) {
    const link = req.user.role === 'PARENT' ? await prisma.parentStudent.findFirst({ where: { parentId: req.user.id, studentId: p.studentId, status: 'APPROVED' } }) : null;
    if (!link) return res.status(403).json({ error: 'Not allowed' });
  }
  const [student, item] = await Promise.all([prisma.user.findUnique({ where: { id: p.studentId }, select: { fullName: true, className: true } }), prisma.feeItem.findUnique({ where: { id: p.feeItemId } })]);
  res.json({ ...p, student, item: item?.title });
}));
router.post('/fees/remind', adminOnly, asyncHandler(async (req, res) => {
  const students = await prisma.user.findMany({ where: { role: 'STUDENT', deletedAt: null, isActive: true }, select: { id: true }, take: 2000 });
  const owing = (await balances(students.map((s) => s.id))).filter((r) => r.balance > 0);
  notifyUsers(owing.map((r) => r.student.id), { type: 'INFO', title: 'Fees reminder', body: 'You have an outstanding school fee balance. Open Campus → Fees.', link: '/campus' });
  const links = await prisma.parentStudent.findMany({ where: { studentId: { in: owing.map((r) => r.student.id) }, status: 'APPROVED' }, select: { parentId: true } });
  notifyUsers(links.map((l) => l.parentId), { type: 'INFO', title: 'Fees reminder', body: 'Your child has an outstanding fee balance.', link: '/campus' });
  res.json({ reminded: owing.length });
}));

/* ===================== TIMETABLE ===================== */
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const overlap = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;
router.get('/timetable', asyncHandler(async (req, res) => {
  let where = {};
  if (req.user.role === 'STUDENT') { const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { classGroupId: true } }); if (!me?.classGroupId) return res.json({ slots: [], classes: [] }); where = { classGroupId: me.classGroupId }; }
  else if (req.user.role === 'TRAINER') where = req.query.all === '1' ? {} : { trainerId: req.user.id };
  else if (req.user.role === 'PARENT') { const kids = await prisma.parentStudent.findMany({ where: { parentId: req.user.id, status: 'APPROVED' }, select: { studentId: true } }); const cls = await prisma.user.findMany({ where: { id: { in: kids.map((k) => k.studentId) } }, select: { classGroupId: true } }); where = { classGroupId: { in: cls.map((c) => c.classGroupId).filter(Boolean) } }; }
  else if (req.user.role !== 'ADMIN') return res.json({ slots: [], classes: [] });
  if (req.query.classGroupId && ['ADMIN', 'TRAINER'].includes(req.user.role)) where = { ...where, classGroupId: String(req.query.classGroupId) };
  const slots = await prisma.timetableSlot.findMany({ where, orderBy: [{ day: 'asc' }, { startTime: 'asc' }], take: 500 });
  const [classes, trainers] = await Promise.all([prisma.classGroup.findMany({ select: { id: true, name: true } }), prisma.user.findMany({ where: { id: { in: slots.map((s) => s.trainerId).filter(Boolean) } }, select: { id: true, fullName: true } })]);
  res.json({ classes, slots: slots.map((s) => ({ ...s, className: classes.find((c) => c.id === s.classGroupId)?.name || '', trainer: trainers.find((t) => t.id === s.trainerId)?.fullName || null })) });
}));
async function slotConflict(d, ignoreId) {
  const same = await prisma.timetableSlot.findMany({ where: { day: d.day, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) } });
  for (const o of same) {
    if (!overlap(d.startTime, d.endTime, o.startTime, o.endTime)) continue;
    if (o.classGroupId === d.classGroupId) return 'This class already has a lesson at that time';
    if (d.trainerId && o.trainerId === d.trainerId) return 'This trainer already teaches another class at that time';
    if (d.room && o.room && o.room.toLowerCase() === d.room.toLowerCase()) return `Room ${d.room} is already used at that time`;
  }
  return null;
}
function slotData(b) {
  const d = { classGroupId: str(b.classGroupId, 100), day: Math.round(Number(b.day)), startTime: str(b.startTime, 5), endTime: str(b.endTime, 5), subject: str(b.subject, 150), trainerId: str(b.trainerId, 100) || null, room: str(b.room, 60) || null };
  if (!d.classGroupId || !d.subject) return { error: 'Class and subject are required' };
  if (!(d.day >= 1 && d.day <= 7)) return { error: 'Choose a day' };
  if (!HHMM.test(d.startTime) || !HHMM.test(d.endTime) || d.startTime >= d.endTime) return { error: 'Start time must be before the end time (HH:MM)' };
  return { d };
}
async function tellClass(classGroupId, text) {
  const ids = (await prisma.user.findMany({ where: { classGroupId, role: 'STUDENT', isActive: true }, select: { id: true }, take: 500 })).map((u) => u.id);
  const par = await prisma.parentStudent.findMany({ where: { studentId: { in: ids }, status: 'APPROVED' }, select: { parentId: true } });
  notifyUsers([...ids, ...par.map((p) => p.parentId)], { type: 'ANNOUNCEMENT', title: 'Timetable updated', body: text, link: '/campus' });
}
router.post('/timetable', adminOnly, asyncHandler(async (req, res) => {
  const { d, error } = slotData(req.body); if (error) return res.status(400).json({ error });
  if (!(await prisma.classGroup.findUnique({ where: { id: d.classGroupId }, select: { id: true } }))) return res.status(404).json({ error: 'Class not found' });
  const c = await slotConflict(d); if (c) return res.status(409).json({ error: c });
  const row = await prisma.timetableSlot.create({ data: d });
  tellClass(d.classGroupId, `${d.subject} added (${d.startTime}-${d.endTime})`);
  res.status(201).json(row);
}));
router.put('/timetable/:id', adminOnly, asyncHandler(async (req, res) => {
  const old = await prisma.timetableSlot.findUnique({ where: { id: req.params.id } }); if (!old) return res.status(404).json({ error: 'Lesson not found' });
  const { d, error } = slotData({ ...old, ...req.body }); if (error) return res.status(400).json({ error });
  const c = await slotConflict(d, old.id); if (c) return res.status(409).json({ error: c });
  const row = await prisma.timetableSlot.update({ where: { id: old.id }, data: d });
  tellClass(d.classGroupId, `${d.subject} changed to ${d.startTime}-${d.endTime}`);
  res.json(row);
}));
router.delete('/timetable/:id', adminOnly, asyncHandler(async (req, res) => {
  const old = await prisma.timetableSlot.findUnique({ where: { id: req.params.id } }); if (!old) return res.status(404).json({ error: 'Lesson not found' });
  await prisma.timetableSlot.delete({ where: { id: old.id } });
  tellClass(old.classGroupId, `${old.subject} was removed from the timetable`);
  res.json({ success: true });
}));

/* ===================== AI TUTOR (students / trainers) ===================== */
router.post('/ai/tutor', need('STUDENT', 'TRAINER', 'ADMIN'), rateLimit({ windowMs: 60_000, max: 10, message: 'Please wait a moment before asking again' }), asyncHandler(async (req, res) => {
  const on = await prisma.siteSetting.findUnique({ where: { key: 'tutor_ai_enabled' } });
  if (on?.value === 'false') return res.status(403).json({ error: 'The AI tutor is turned off by the administrator' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI is not configured yet. Ask the administrator to set OPENAI_API_KEY.' });
  const question = str(req.body.question, 3000); if (!question) return res.status(400).json({ error: 'Write your question' });
  const lang = { rw: 'Kinyarwanda', en: 'English', fr: 'French' }[req.body.language] || 'English';
  const mode = ['explain', 'quiz', 'lesson'].includes(req.body.mode) ? req.body.mode : 'explain';
  const task = { explain: 'Explain the topic simply with a short example, then give 2 practice questions.', quiz: 'Create 5 multiple-choice practice questions with 4 options each. Put the answers at the end.', lesson: 'Prepare a short lesson plan (objectives, activities, assessment) for a TVET trainer.' }[mode];
  const r = await fetch(process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0.4, max_tokens: 1100, messages: [{ role: 'system', content: `You are the NTS learning assistant for Rwandan TVET students and trainers. Reply in ${lang}. ${task} Help the person learn; never give marks or certificate decisions. If unsure, say so.` }, { role: 'user', content: question }] }) });
  if (!r.ok) { console.error('AI tutor error', r.status); return res.status(502).json({ error: 'AI service is temporarily unavailable' }); }
  const data = await r.json();
  res.json({ answer: data.choices?.[0]?.message?.content || 'No answer returned' });
}));

module.exports = router;
