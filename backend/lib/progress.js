// V6: module progress is calculated by the system (videos watched + quizzes passed + work submitted),
// and a finished module can trigger the automatic certificate.
const prisma = require('./prisma');
const { notifyUsers } = require('./notify');

async function calcProgress(studentId, moduleId) {
  const [lessons, quizzes, assignments] = await Promise.all([
    prisma.lesson.findMany({ where: { moduleId, published: true, videoUrl: { not: null } }, select: { id: true, title: true } }),
    prisma.quiz.findMany({ where: { moduleId, published: true }, select: { id: true, title: true, passMark: true } }),
    prisma.assignment.findMany({ where: { moduleId, published: true }, select: { id: true, title: true } }),
  ]);
  const [views, passes, subs] = await Promise.all([
    lessons.length ? prisma.lessonView.findMany({ where: { studentId, lessonId: { in: lessons.map((l) => l.id) }, completedAt: { not: null } }, select: { lessonId: true } }) : [],
    quizzes.length ? prisma.quizAttempt.findMany({ where: { studentId, quizId: { in: quizzes.map((q) => q.id) }, passed: true }, select: { quizId: true } }) : [],
    assignments.length ? prisma.assignmentSubmission.findMany({ where: { studentId, assignmentId: { in: assignments.map((a) => a.id) } }, select: { assignmentId: true } }) : [],
  ]);
  const watched = new Set(views.map((v) => v.lessonId)), passed = new Set(passes.map((p) => p.quizId)), sent = new Set(subs.map((s) => s.assignmentId));
  const items = [
    ...lessons.map((l) => ({ type: 'VIDEO', id: l.id, title: l.title, done: watched.has(l.id), required: true })),
    ...quizzes.map((q) => ({ type: 'QUIZ', id: q.id, title: q.title, done: passed.has(q.id), required: true })),
    ...assignments.map((a) => ({ type: 'ASSIGNMENT', id: a.id, title: a.title, done: sent.has(a.id), required: false })),
  ];
  const total = items.length, done = items.filter((i) => i.done).length;
  const requiredItems = items.filter((i) => i.required);
  const complete = requiredItems.length > 0 && requiredItems.every((i) => i.done);
  return { items, progress: complete ? 100 : total ? Math.min(99, Math.round((done / total) * 100)) : 0, complete };
}

// Re-calculates the enrollment and, when the module is finished, tries the automatic certificate.
async function refreshProgress(studentId, moduleId) {
  try {
    const enrollment = await prisma.courseEnrollment.findUnique({ where: { userId_moduleId: { userId: studentId, moduleId } } });
    if (!enrollment) return null;
    const r = await calcProgress(studentId, moduleId);
    const wasComplete = enrollment.status === 'COMPLETED' && enrollment.progress >= 100;
    if (r.complete) {
      if (!wasComplete) {
        await prisma.courseEnrollment.update({ where: { id: enrollment.id }, data: { progress: 100, status: 'COMPLETED' } });
        notifyUsers([studentId], { type: 'INFO', title: 'Module completed 🎉', body: 'You watched the videos and passed the questions.', link: '/learning' });
      }
      const { autoIssueCourse } = require('../routes/certificates');
      const cert = await autoIssueCourse(studentId, moduleId);
      return { ...r, justCompleted: !wasComplete, certificate: cert };
    }
    if (!wasComplete && r.progress !== enrollment.progress) await prisma.courseEnrollment.update({ where: { id: enrollment.id }, data: { progress: r.progress } });
    return { ...r, justCompleted: false };
  } catch (e) { console.warn('progress refresh skipped:', e.message); return null; }
}

module.exports = { calcProgress, refreshProgress };
