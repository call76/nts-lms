const prisma = require('./prisma');

const STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

// Totals + percentage + last 6 months, used by the student, parent and trainer views.
async function attendanceSummary(studentId, { parentView = false } = {}) {
  const rows = await prisma.attendance.findMany({ where: { studentId, ...(parentView ? { visibleToParents: true } : {}) }, orderBy: { date: 'desc' }, take: 400 });
  const totals = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  rows.forEach((r) => { if (totals[r.status] !== undefined) totals[r.status] += 1; });
  const counted = rows.length;
  // Late still counts as attending; excused days are not held against the student
  const rate = counted ? Math.round(((totals.PRESENT + totals.LATE + totals.EXCUSED) / counted) * 100) : null;

  const months = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    months.push({ key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('en', { month: 'short', timeZone: 'UTC' }), present: 0, total: 0 });
  }
  rows.forEach((r) => {
    const key = r.date.toISOString().slice(0, 7);
    const m = months.find((x) => x.key === key);
    if (m) { m.total += 1; if (r.status !== 'ABSENT') m.present += 1; }
  });
  return {
    totals, rate, counted,
    byMonth: months.map((m) => ({ label: m.label, value: m.total ? Math.round((m.present / m.total) * 100) : 0 })),
    recent: rows.slice(0, 15).map((r) => ({ id: r.id, date: r.date, status: r.status, note: r.note, joinedAt: r.joinedAt })),
  };
}

// Who may look at one student's records?
async function canSeeStudent(user, studentId) {
  if (!user || !studentId) return false;
  if (user.role === 'ADMIN' || user.role === 'TRAINER') return true;
  if (user.id === studentId) return true;
  if (user.role === 'PARENT') {
    const link = await prisma.parentStudent.findUnique({ where: { parentId_studentId: { parentId: user.id, studentId } } });
    return Boolean(link && link.status === 'APPROVED');
  }
  return false;
}

module.exports = { attendanceSummary, canSeeStudent, STATUSES };
