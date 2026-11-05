// Marks a student really earned in a module, collected from the system (no typing needed).
const prisma = require('./prisma');

async function buildAssessment(studentId, moduleId) {
  const [subs, quizzes] = await Promise.all([
    prisma.assignmentSubmission.findMany({ where: { studentId, status: 'GRADED', assignment: { moduleId } }, include: { assignment: { select: { title: true, maxScore: true } } } }),
    prisma.quiz.findMany({ where: { moduleId, published: true }, include: { attempts: { where: { studentId }, orderBy: { score: 'desc' }, take: 1 } } }),
  ]);
  const rows = [];
  subs.forEach((s) => { if (s.score != null) rows.push({ label: s.assignment.title, score: Math.round(s.score), max: s.assignment.maxScore, type: 'Assignment' }); });
  quizzes.forEach((q) => { if (q.attempts[0]) rows.push({ label: q.title, score: Math.round(q.attempts[0].score), max: 100, type: 'Quiz' }); });
  const pcts = rows.map((r) => (r.max ? (r.score / r.max) * 100 : 0));
  const finalScore = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
  return { rows, finalScore };
}

// assessmentSummary is stored as JSON text; old records may hold other shapes.
function parseSummary(raw) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    const list = Array.isArray(v) ? v : Array.isArray(v?.rows) ? v.rows : [];
    return list.filter((r) => r && (r.label || r.title)).map((r) => ({ label: String(r.label || r.title), score: Number(r.score), max: Number(r.max) || 100, type: r.type || '' })).filter((r) => Number.isFinite(r.score));
  } catch { return []; }
}

module.exports = { buildAssessment, parseSummary };
