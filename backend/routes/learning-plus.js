// V6 learning extras: question import, quiz results / gradebook, lesson discussion, module reviews, live progress.
const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate } = require('../lib/auth');
const { asyncHandler, str } = require('../lib/http');
const { notifyUsers } = require('../lib/notify');
const { cleanQuestions, parseQuestionText } = require('../lib/quiz');
const { calcProgress, refreshProgress } = require('../lib/progress');
const router = express.Router();
router.use(authenticate);

const staff = (u) => ['ADMIN', 'TRAINER'].includes(u.role);
const ownsOrAdmin = (u, row) => u.role === 'ADMIN' || (u.role === 'TRAINER' && row.trainerId === u.id);
const parseQs = (raw) => { try { const q = JSON.parse(raw); return Array.isArray(q) ? q : []; } catch { return []; } };
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const sendCsv = (res, name, rows) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send('\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'));
};

// ---- parse pasted / uploaded CSV text into questions (preview, nothing is saved)
router.post('/quizzes/parse', asyncHandler(async (req, res) => {
  if (!staff(req.user)) return res.status(403).json({ error: 'Trainer access required' });
  const text = String(req.body.text || '');
  if (!text.trim()) return res.status(400).json({ error: 'Paste your questions or choose a CSV file' });
  if (text.length > 600000) return res.status(413).json({ error: 'File is too large' });
  res.json(parseQuestionText(text));
}));

// ---- add questions to an existing quiz (CSV text or a list)
router.post('/quizzes/:id/questions', asyncHandler(async (req, res) => {
  const quiz = await prisma.quiz.findUnique({ where: { id: req.params.id } });
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  if (!ownsOrAdmin(req.user, quiz)) return res.status(403).json({ error: 'You can only add questions to your own quizzes' });
  let incoming = req.body.questions;
  if (req.body.text) { const r = parseQuestionText(req.body.text); if (!r.questions.length) return res.status(400).json({ error: r.errors[0]?.message || 'No valid question found' }); incoming = r.questions; }
  const clean = cleanQuestions([...parseQs(quiz.questions), ...(Array.isArray(incoming) ? incoming : [])]);
  if (clean.error) return res.status(400).json({ error: clean.error });
  await prisma.quiz.update({ where: { id: quiz.id }, data: { questions: JSON.stringify(clean.questions) } });
  res.json({ total: clean.questions.length });
}));

// ---- copy a quiz (e.g. to reuse it in another module)
router.post('/quizzes/:id/duplicate', asyncHandler(async (req, res) => {
  if (!staff(req.user)) return res.status(403).json({ error: 'Trainer access required' });
  const quiz = await prisma.quiz.findUnique({ where: { id: req.params.id } });
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  const moduleId = Number(req.body.moduleId) || quiz.moduleId;
  if (!(await prisma.module.findUnique({ where: { id: moduleId }, select: { id: true } }))) return res.status(404).json({ error: 'Module not found' });
  const copy = await prisma.quiz.create({ data: { moduleId, trainerId: req.user.id, title: `${quiz.title} (copy)`, description: quiz.description, questions: quiz.questions, passMark: quiz.passMark, published: false, timeLimit: quiz.timeLimit, maxAttempts: quiz.maxAttempts, showAnswers: quiz.showAnswers, lessonId: moduleId === quiz.moduleId ? quiz.lessonId : null } });
  res.status(201).json({ id: copy.id });
}));

// ---- results + per-question statistics
router.get('/quizzes/:id/results', asyncHandler(async (req, res) => {
  if (!staff(req.user)) return res.status(403).json({ error: 'Trainer access required' });
  const quiz = await prisma.quiz.findUnique({ where: { id: req.params.id }, include: { module: { select: { name: true, code: true } } } });
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  if (!ownsOrAdmin(req.user, quiz)) return res.status(403).json({ error: 'You can only see results of your own quizzes' });
  const attempts = await prisma.quizAttempt.findMany({ where: { quizId: quiz.id }, include: { student: { select: { id: true, fullName: true, email: true, className: true } } }, orderBy: { createdAt: 'desc' } });
  const qs = parseQs(quiz.questions);
  const perQ = qs.map(() => ({ right: 0, seen: 0 }));
  attempts.forEach((a) => { let ans = []; try { ans = JSON.parse(a.answers); } catch { /* ignore */ } qs.forEach((q, i) => { if (ans[i] === undefined || ans[i] === null) return; perQ[i].seen += 1; if (Number(ans[i]) === Number(q.answerIndex)) perQ[i].right += 1; }); });
  const best = new Map();
  attempts.forEach((a) => { const b = best.get(a.studentId); if (!b || a.score > b.best) best.set(a.studentId, { student: a.student, best: a.score, passed: a.passed, tries: (b?.tries || 0) + 1, last: b?.last || a.createdAt }); else b.tries += 1; });
  const students = [...best.values()];
  if (req.query.format === 'csv') return sendCsv(res, `quiz-results-${quiz.id}.csv`, [['Student', 'Email', 'Class', 'Best score %', 'Passed', 'Attempts'], ...students.map((s) => [s.student.fullName, s.student.email, s.student.className || '', Math.round(s.best), s.passed ? 'Yes' : 'No', s.tries])]);
  const scores = students.map((s) => s.best);
  res.json({
    quiz: { id: quiz.id, title: quiz.title, module: quiz.module, passMark: quiz.passMark },
    summary: { students: students.length, attempts: attempts.length, average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0, passRate: students.length ? Math.round((students.filter((s) => s.passed).length / students.length) * 100) : 0 },
    questions: qs.map((q, i) => ({ prompt: q.prompt, correctRate: perQ[i].seen ? Math.round((perQ[i].right / perQ[i].seen) * 100) : null, answered: perQ[i].seen })),
    students: students.sort((a, b) => b.best - a.best),
  });
}));

// ---- gradebook of a module (everything a student did) as JSON or CSV
router.get('/modules/:id/gradebook', asyncHandler(async (req, res) => {
  if (!staff(req.user)) return res.status(403).json({ error: 'Trainer access required' });
  const moduleId = Number(req.params.id);
  const mod = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!mod) return res.status(404).json({ error: 'Module not found' });
  const [enrollments, quizzes, assignments] = await Promise.all([
    prisma.courseEnrollment.findMany({ where: { moduleId }, include: { user: { select: { id: true, fullName: true, email: true, className: true } } } }),
    prisma.quiz.findMany({ where: { moduleId, published: true }, select: { id: true, title: true } }),
    prisma.assignment.findMany({ where: { moduleId, published: true }, select: { id: true, title: true, maxScore: true } }),
  ]);
  const ids = enrollments.map((e) => e.userId);
  const [attempts, subs, certs] = await Promise.all([
    prisma.quizAttempt.findMany({ where: { studentId: { in: ids }, quizId: { in: quizzes.map((q) => q.id) } }, select: { quizId: true, studentId: true, score: true } }),
    prisma.assignmentSubmission.findMany({ where: { studentId: { in: ids }, assignmentId: { in: assignments.map((a) => a.id) } }, select: { assignmentId: true, studentId: true, score: true } }),
    prisma.certificate.findMany({ where: { moduleId, studentId: { in: ids }, status: 'ACTIVE' }, select: { studentId: true } }),
  ]);
  const hasCert = new Set(certs.map((c) => c.studentId));
  const rows = enrollments.map((e) => {
    const quizScores = quizzes.map((q) => { const s = attempts.filter((a) => a.quizId === q.id && a.studentId === e.userId).map((a) => a.score); return s.length ? Math.round(Math.max(...s)) : null; });
    const workScores = assignments.map((a) => { const s = subs.find((x) => x.assignmentId === a.id && x.studentId === e.userId); return s ? (s.score == null ? 'submitted' : s.score) : null; });
    return { student: e.user, progress: e.progress, status: e.status, quizScores, workScores, certificate: hasCert.has(e.userId) };
  });
  if (req.query.format === 'csv') return sendCsv(res, `gradebook-${mod.code}.csv`, [['Student', 'Email', 'Class', 'Progress %', 'Status', ...quizzes.map((q) => `Quiz: ${q.title}`), ...assignments.map((a) => `Work: ${a.title} (/${a.maxScore})`), 'Certificate'], ...rows.map((r) => [r.student.fullName, r.student.email, r.student.className || '', r.progress, r.status, ...r.quizScores.map((v) => v ?? ''), ...r.workScores.map((v) => v ?? ''), r.certificate ? 'Yes' : 'No'])]);
  res.json({ module: { id: mod.id, name: mod.name, code: mod.code }, quizzes, assignments, rows });
}));

// ---- live progress of the current student in a module (what is done, what is left)
router.get('/modules/:id/progress', asyncHandler(async (req, res) => {
  const moduleId = Number(req.params.id);
  if (req.user.role !== 'STUDENT') return res.status(403).json({ error: 'Only students have a progress' });
  const [r, enrollment, cert] = await Promise.all([
    calcProgress(req.user.id, moduleId),
    prisma.courseEnrollment.findUnique({ where: { userId_moduleId: { userId: req.user.id, moduleId } } }),
    prisma.certificate.findUnique({ where: { studentId_moduleId: { studentId: req.user.id, moduleId } } }),
  ]);
  res.json({ ...r, enrolled: Boolean(enrollment), status: enrollment?.status || null, certificate: cert && cert.status === 'ACTIVE' ? { id: cert.id, code: cert.code } : null });
}));
// the student may press "re-check" (useful for modules finished before V6)
router.post('/modules/:id/recheck', asyncHandler(async (req, res) => {
  if (req.user.role !== 'STUDENT') return res.status(403).json({ error: 'Only students can do this' });
  const r = await refreshProgress(req.user.id, Number(req.params.id));
  if (!r) return res.status(404).json({ error: 'Enroll in this module first' });
  res.json({ progress: r.progress, complete: r.complete, certificateIssued: Boolean(r.certificate?.issued), certificateReason: r.certificate?.reason || null });
}));

// ---- discussion under a lesson
router.get('/lessons/:id/comments', asyncHandler(async (req, res) => {
  const rows = await prisma.lessonComment.findMany({ where: { lessonId: req.params.id }, orderBy: { createdAt: 'asc' }, take: 300 });
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.userId))] } }, select: { id: true, fullName: true, role: true, avatar: true } });
  const by = Object.fromEntries(users.map((u) => [u.id, u]));
  res.json(rows.map((r) => ({ ...r, author: by[r.userId] ? { id: by[r.userId].id, fullName: by[r.userId].fullName, role: by[r.userId].role } : null })));
}));
router.post('/lessons/:id/comments', asyncHandler(async (req, res) => {
  if (!['STUDENT', 'TRAINER', 'ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Not allowed' });
  const lesson = await prisma.lesson.findUnique({ where: { id: req.params.id }, select: { id: true, title: true, trainerId: true } });
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  const body = str(req.body.body, 2000);
  if (!body) return res.status(400).json({ error: 'Write a message first' });
  let parentId = str(req.body.parentId, 100) || null, parent = null;
  if (parentId) { parent = await prisma.lessonComment.findFirst({ where: { id: parentId, lessonId: lesson.id } }); if (!parent) parentId = null; }
  const row = await prisma.lessonComment.create({ data: { lessonId: lesson.id, userId: req.user.id, parentId, body } });
  const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { fullName: true } });
  const targets = parent ? [parent.userId] : [lesson.trainerId];
  notifyUsers(targets.filter((id) => id !== req.user.id), { type: 'INFO', title: parent ? 'New reply to your comment' : 'New question on your lesson', body: `${me?.fullName}: ${body.slice(0, 100)}`, link: '/learning' });
  res.status(201).json(row);
}));
router.delete('/comments/:id', asyncHandler(async (req, res) => {
  const row = await prisma.lessonComment.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: 'Comment not found' });
  if (row.userId !== req.user.id && !staff(req.user)) return res.status(403).json({ error: 'You can only delete your own comments' });
  await prisma.lessonComment.deleteMany({ where: { OR: [{ id: row.id }, { parentId: row.id }] } });
  res.json({ success: true });
}));

// ---- module reviews (1-5 stars)
router.get('/modules/:id/reviews', asyncHandler(async (req, res) => {
  const moduleId = Number(req.params.id);
  const rows = await prisma.moduleReview.findMany({ where: { moduleId }, orderBy: { createdAt: 'desc' }, take: 100 });
  const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, fullName: true } });
  const by = Object.fromEntries(users.map((u) => [u.id, u.fullName]));
  res.json({ average: rows.length ? Math.round((rows.reduce((a, r) => a + r.rating, 0) / rows.length) * 10) / 10 : null, count: rows.length, mine: rows.find((r) => r.userId === req.user.id) || null, reviews: rows.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt, student: by[r.userId] || 'Student', own: r.userId === req.user.id })) });
}));
router.post('/modules/:id/reviews', asyncHandler(async (req, res) => {
  if (req.user.role !== 'STUDENT') return res.status(403).json({ error: 'Only students can rate a module' });
  const moduleId = Number(req.params.id), rating = Math.round(Number(req.body.rating));
  if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'Rating must be 1 to 5' });
  if (!(await prisma.courseEnrollment.findUnique({ where: { userId_moduleId: { userId: req.user.id, moduleId } } }))) return res.status(403).json({ error: 'Join this module before rating it' });
  const comment = str(req.body.comment, 1000) || null;
  res.status(201).json(await prisma.moduleReview.upsert({ where: { moduleId_userId: { moduleId, userId: req.user.id } }, create: { moduleId, userId: req.user.id, rating, comment }, update: { rating, comment } }));
}));
router.delete('/reviews/:id', asyncHandler(async (req, res) => {
  const row = await prisma.moduleReview.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: 'Review not found' });
  if (row.userId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Not allowed' });
  await prisma.moduleReview.delete({ where: { id: row.id } });
  res.json({ success: true });
}));

// ---- my to-do: assignments and quizzes still open, nearest deadline first
router.get('/todo', asyncHandler(async (req, res) => {
  if (req.user.role !== 'STUDENT') return res.json([]);
  const en = await prisma.courseEnrollment.findMany({ where: { userId: req.user.id }, select: { moduleId: true } });
  const moduleIds = en.map((e) => e.moduleId);
  if (!moduleIds.length) return res.json([]);
  const [assignments, quizzes] = await Promise.all([
    prisma.assignment.findMany({ where: { moduleId: { in: moduleIds }, published: true, submissions: { none: { studentId: req.user.id } } }, include: { module: { select: { name: true } } }, take: 50 }),
    prisma.quiz.findMany({ where: { moduleId: { in: moduleIds }, published: true, attempts: { none: { studentId: req.user.id, passed: true } } }, include: { module: { select: { name: true } } }, take: 50 }),
  ]);
  const items = [
    ...assignments.map((a) => ({ type: 'ASSIGNMENT', id: a.id, title: a.title, module: a.module.name, dueAt: a.dueAt })),
    ...quizzes.map((q) => ({ type: 'QUIZ', id: q.id, title: q.title, module: q.module.name, dueAt: null })),
  ];
  items.sort((a, b) => (a.dueAt ? new Date(a.dueAt).getTime() : Infinity) - (b.dueAt ? new Date(b.dueAt).getTime() : Infinity));
  res.json(items.slice(0, 30));
}));

module.exports = router;
