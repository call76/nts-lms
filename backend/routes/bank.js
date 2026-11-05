// V6.2 Question bank: trainers keep reusable multiple-choice questions and build quizzes from them.
const express = require('express');
const prisma = require('../lib/prisma');
const { asyncHandler, str } = require('../lib/http');
const { authenticate } = require('../lib/auth');
const { notifyUsers } = require('../lib/notify');
const { cleanQuestions, safeImage } = require('../lib/quiz');

const router = express.Router();
router.use(authenticate);
router.use((req, res, next) => (['ADMIN', 'TRAINER'].includes(req.user.role) ? next() : res.status(403).json({ error: 'Trainer or admin only' })));

const LEVELS = ['EASY', 'MEDIUM', 'HARD'];
const mine = (req) => (req.user.role === 'ADMIN' ? {} : { ownerId: req.user.id });
const parseOptions = (v) => { try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
const view = (r) => ({
  id: r.id, ownerId: r.ownerId, moduleId: r.moduleId, topic: r.topic, difficulty: r.difficulty, prompt: r.prompt,
  options: parseOptions(r.options), answerIndex: r.answerIndex, points: r.points, explanation: r.explanation, imageUrl: r.imageUrl, createdAt: r.createdAt,
});

// Validates one question with the same rules quizzes use, so a bank question is always quiz-ready.
function cleanOne(body) {
  const clean = cleanQuestions([{ prompt: body.prompt, options: body.options, answerIndex: body.answerIndex, points: body.points, explanation: body.explanation, imageUrl: body.imageUrl }]);
  if (clean.error) return { error: clean.error.replace(/^Question 1: /, '') };
  const q = clean.questions[0];
  const difficulty = LEVELS.includes(String(body.difficulty).toUpperCase()) ? String(body.difficulty).toUpperCase() : 'MEDIUM';
  const moduleId = Number(body.moduleId);
  return {
    data: {
      prompt: q.prompt, options: JSON.stringify(q.options), answerIndex: q.answerIndex, points: q.points,
      explanation: q.explanation || null, imageUrl: safeImage(body.imageUrl) || null,
      topic: str(body.topic, 80) || null, difficulty, moduleId: Number.isInteger(moduleId) && moduleId > 0 ? moduleId : null,
    },
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const where = { ...mine(req) };
  const moduleId = Number(req.query.moduleId);
  if (moduleId) where.moduleId = moduleId;
  const topic = str(req.query.topic, 80);
  if (topic) where.topic = topic;
  const difficulty = str(req.query.difficulty, 10).toUpperCase();
  if (LEVELS.includes(difficulty)) where.difficulty = difficulty;
  const q = str(req.query.q, 100);
  if (q) where.prompt = { contains: q };
  const [rows, total, topics] = await Promise.all([
    prisma.bankQuestion.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 }),
    prisma.bankQuestion.count({ where: mine(req) }),
    prisma.bankQuestion.groupBy({ by: ['topic'], _count: { _all: true }, where: mine(req) }),
  ]);
  res.json({ items: rows.map(view), total, topics: topics.filter((t) => t.topic).map((t) => ({ name: t.topic, count: t._count._all })) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const c = cleanOne(req.body);
  if (c.error) return res.status(400).json({ error: c.error });
  res.status(201).json(view(await prisma.bankQuestion.create({ data: { ...c.data, ownerId: req.user.id } })));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const row = await prisma.bankQuestion.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: 'Question not found' });
  if (req.user.role !== 'ADMIN' && row.ownerId !== req.user.id) return res.status(403).json({ error: 'You can only edit your own questions' });
  const c = cleanOne(req.body);
  if (c.error) return res.status(400).json({ error: c.error });
  res.json(view(await prisma.bankQuestion.update({ where: { id: row.id }, data: c.data })));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const row = await prisma.bankQuestion.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: 'Question not found' });
  if (req.user.role !== 'ADMIN' && row.ownerId !== req.user.id) return res.status(403).json({ error: 'You can only delete your own questions' });
  await prisma.bankQuestion.delete({ where: { id: row.id } });
  res.json({ success: true });
}));

// Copy every question of an existing quiz into the bank (skips questions already saved).
router.post('/from-quiz/:quizId', asyncHandler(async (req, res) => {
  const quiz = await prisma.quiz.findUnique({ where: { id: req.params.quizId } });
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  if (req.user.role !== 'ADMIN' && quiz.trainerId !== req.user.id) return res.status(403).json({ error: 'You can only copy questions from your own quizzes' });
  let list = [];
  try { list = JSON.parse(quiz.questions); } catch (e) { /* empty */ }
  const have = new Set((await prisma.bankQuestion.findMany({ where: { ownerId: req.user.id, moduleId: quiz.moduleId }, select: { prompt: true } })).map((r) => r.prompt));
  let added = 0;
  for (const q of list) {
    if (!q || have.has(q.prompt)) continue;
    const c = cleanOne({ ...q, moduleId: quiz.moduleId, topic: quiz.title });
    if (c.error) continue;
    await prisma.bankQuestion.create({ data: { ...c.data, ownerId: req.user.id } });
    added += 1;
  }
  res.json({ added, skipped: list.length - added });
}));

// Build and publish a quiz from selected bank questions.
router.post('/build-quiz', asyncHandler(async (req, res) => {
  const moduleId = Number(req.body.moduleId);
  const title = str(req.body.title, 180);
  const ids = Array.isArray(req.body.questionIds) ? req.body.questionIds.filter((x) => typeof x === 'string').slice(0, 200) : [];
  if (!moduleId || !title) return res.status(400).json({ error: 'Choose a module and give the quiz a title' });
  if (!ids.length) return res.status(400).json({ error: 'Select at least one question' });
  if (!(await prisma.module.findUnique({ where: { id: moduleId }, select: { id: true } }))) return res.status(404).json({ error: 'Module not found' });
  const rows = await prisma.bankQuestion.findMany({ where: { id: { in: ids }, ...mine(req) } });
  const order = new Map(ids.map((id, i) => [id, i]));
  rows.sort((a, b) => order.get(a.id) - order.get(b.id));
  const clean = cleanQuestions(rows.map((r) => ({ prompt: r.prompt, options: parseOptions(r.options), answerIndex: r.answerIndex, points: r.points, explanation: r.explanation, imageUrl: r.imageUrl })));
  if (clean.error) return res.status(400).json({ error: clean.error });
  const limit = Number(req.body.timeLimit);
  const attempts = Number(req.body.maxAttempts);
  const quiz = await prisma.quiz.create({
    data: {
      moduleId, trainerId: req.user.id, title, description: str(req.body.description, 2000) || null,
      questions: JSON.stringify(clean.questions), passMark: Math.min(100, Math.max(0, Number(req.body.passMark) || 50)),
      published: req.body.published !== false,
      timeLimit: Number.isFinite(limit) && limit > 0 ? Math.round(limit) : null,
      maxAttempts: Number.isFinite(attempts) && attempts > 0 ? Math.round(attempts) : null,
    },
  });
  try {
    const en = await prisma.courseEnrollment.findMany({ where: { moduleId }, select: { userId: true }, take: 2000 });
    notifyUsers(en.map((e) => e.userId), { type: 'INFO', title: 'New questions available', body: title, link: '/learning' });
  } catch (e) { /* notifications are best effort */ }
  res.status(201).json({ id: quiz.id, title: quiz.title, questions: clean.questions.length });
}));

module.exports = router;
