// Which students does a trainer teach? The admin assigns classes to trainers (Admin > Teaching).
// A trainer with no assignment and no department keeps full access so existing installs keep working.
const prisma = require('./prisma');

async function trainerScope(user) {
  if (!user || user.role === 'ADMIN') return { all: true, classIds: [], departments: [] };
  if (user.role !== 'TRAINER') return { all: false, classIds: [], departments: [] };
  const rows = await prisma.trainerAssignment.findMany({ where: { trainerId: user.id }, select: { classGroupId: true } });
  const classIds = rows.map((r) => r.classGroupId);
  const classes = classIds.length ? await prisma.classGroup.findMany({ where: { id: { in: classIds } }, select: { department: true } }) : [];
  const departments = [...new Set([...classes.map((c) => c.department), ...(user.department ? [user.department] : [])])].filter(Boolean);
  return { all: !classIds.length && !departments.length, classIds, departments };
}

// Prisma `where` for STUDENT users this staff member may see
async function studentWhere(user) {
  const s = await trainerScope(user);
  if (s.all) return {};
  const or = [];
  if (s.classIds.length) or.push({ classGroupId: { in: s.classIds } });
  if (s.departments.length) or.push({ department: { in: s.departments } });
  return { OR: or };
}

// Trainers (and admins) who should hear about a student's activity
async function trainersFor(student) {
  const [trainers, assigns] = await Promise.all([
    prisma.user.findMany({ where: { role: 'TRAINER', isActive: true, deletedAt: null }, select: { id: true, department: true } }),
    prisma.trainerAssignment.findMany({ select: { trainerId: true, classGroupId: true } }),
  ]);
  const byTrainer = new Map();
  assigns.forEach((a) => { if (!byTrainer.has(a.trainerId)) byTrainer.set(a.trainerId, new Set()); byTrainer.get(a.trainerId).add(a.classGroupId); });
  return trainers.filter((t) => {
    const mine = byTrainer.get(t.id);
    if (mine && mine.size) return Boolean(student.classGroupId && mine.has(student.classGroupId));
    if (t.department) return t.department === student.department;
    return true; // unassigned trainer: legacy behaviour
  }).map((t) => t.id);
}

module.exports = { trainerScope, studentWhere, trainersFor };
