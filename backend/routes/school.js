// Attendance and the school calendar.
const express = require('express');
const prisma = require('../lib/prisma');
const { asyncHandler, str } = require('../lib/http');
const { authenticate } = require('../lib/auth');
const { notifyUsers } = require('../lib/notify');
const { trainerScope } = require('../lib/scope');
const { attendanceSummary, canSeeStudent, STATUSES } = require('../lib/attendance');

const router = express.Router();
router.use(authenticate);
const staff = (req, res, next) => (['TRAINER', 'ADMIN'].includes(req.user.role) ? next() : res.status(403).json({ error: 'Teachers only' }));
// The calendar can be edited by the admin and by trainers the admin gave this permission to.
const calendarEditor = async (req, res, next) => {
  if (req.user.role === 'ADMIN') return next();
  const me = req.user.role === 'TRAINER' ? await prisma.user.findUnique({ where: { id: req.user.id }, select: { canEditEvents: true } }) : null;
  return me?.canEditEvents ? next() : res.status(403).json({ error: 'The admin has not given you access to edit the calendar' });
};
const toDay = (v) => {
  const d = new Date(`${String(v || new Date().toISOString()).slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

// ----- attendance -----
router.get('/attendance/classes', staff, asyncHandler(async (req, res) => {
  const scope = await trainerScope(req.user);
  const where = scope.all ? {} : { OR: [...(scope.classIds.length ? [{ id: { in: scope.classIds } }] : []), ...(scope.departments.length ? [{ department: { in: scope.departments } }] : [])] };
  res.json(await prisma.classGroup.findMany({ where, orderBy: [{ department: 'asc' }, { name: 'asc' }], take: 200, select: { id: true, name: true, department: true, school: true } }));
}));

// Students of a class with their status on one day
router.get('/attendance/class/:classGroupId', staff, asyncHandler(async (req, res) => {
  const date = toDay(req.query.date);
  if (!date) return res.status(400).json({ error: 'Invalid date' });
  const students = await prisma.user.findMany({ where: { role: 'STUDENT', classGroupId: req.params.classGroupId, deletedAt: null }, select: { id: true, fullName: true, avatar: true }, orderBy: { fullName: 'asc' } });
  const rows = await prisma.attendance.findMany({ where: { date, studentId: { in: students.map((s) => s.id) } } });
  const map = new Map(rows.map((r) => [r.studentId, r]));
  res.json(students.map((s) => ({ ...s, status: map.get(s.id)?.status || null, note: map.get(s.id)?.note || '' })));
}));

router.post('/attendance/mark', staff, asyncHandler(async (req, res) => {
  const date = toDay(req.body.date);
  const records = Array.isArray(req.body.records) ? req.body.records.slice(0, 300) : [];
  if (!date || !records.length) return res.status(400).json({ error: 'Date and records are required' });
  const absent = [];
  for (const r of records) {
    const status = STATUSES.includes(r.status) ? r.status : null;
    const studentId = str(r.studentId, 60);
    if (!status || !studentId) continue;
    await prisma.attendance.upsert({
      where: { studentId_date: { studentId, date } },
      update: { status, note: str(r.note, 200) || null, trainerId: req.user.id },
      create: { studentId, date, status, note: str(r.note, 200) || null, trainerId: req.user.id },
    });
    if (status === 'ABSENT') absent.push(studentId);
  }
  if (absent.length) {
    const links = await prisma.parentStudent.findMany({ where: { studentId: { in: absent }, status: 'APPROVED' }, include: { student: { select: { fullName: true } } } });
    for (const l of links) {
      await notifyUsers([l.parentId], { type: 'INFO', title: `${l.student.fullName} was absent`, body: `Marked absent on ${date.toISOString().slice(0, 10)}.`, link: '/attendance' });
    }
  }
  res.json({ success: true, saved: records.length });
}));

// 'me' = the logged-in student
router.get('/attendance/student/:id', asyncHandler(async (req, res) => {
  const id = req.params.id === 'me' ? req.user.id : req.params.id;
  if (!(await canSeeStudent(req.user, id))) return res.status(403).json({ error: 'Not allowed' });
  const student = await prisma.user.findUnique({ where: { id }, select: { id: true, fullName: true, className: true, department: true } });
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json({ student, ...(await attendanceSummary(id, { parentView: req.user.role === 'PARENT' })) });
}));

// ----- events -----
router.get('/events', asyncHandler(async (req, res) => {
  const where = req.user.role === 'ADMIN' ? {} : { audience: { in: ['ALL', req.user.role] } };
  const rows = await prisma.schoolEvent.findMany({ where, orderBy: { startsAt: 'asc' }, take: 200 });
  const now = Date.now();
  res.json({ upcoming: rows.filter((e) => new Date(e.startsAt).getTime() >= now - 86_400_000), past: rows.filter((e) => new Date(e.startsAt).getTime() < now - 86_400_000).reverse().slice(0, 20) });
}));

router.get('/events/can-edit', asyncHandler(async (req, res) => {
  if (req.user.role === 'ADMIN') return res.json({ canEdit: true });
  const me = req.user.role === 'TRAINER' ? await prisma.user.findUnique({ where: { id: req.user.id }, select: { canEditEvents: true } }) : null;
  res.json({ canEdit: !!me?.canEditEvents });
}));

router.post('/events', calendarEditor, asyncHandler(async (req, res) => {
  const title = str(req.body.title, 150);
  const startsAt = new Date(req.body.startsAt);
  if (!title || Number.isNaN(startsAt.getTime())) return res.status(400).json({ error: 'Title and a valid date are required' });
  const audience = ['ALL', 'STUDENT', 'TRAINER', 'PARENT', 'EMPLOYER', 'GUEST'].includes(req.body.audience) ? req.body.audience : 'ALL';
  const ev = await prisma.schoolEvent.create({ data: { title, description: str(req.body.description, 2000) || null, location: str(req.body.location, 150) || null, startsAt, audience, createdById: req.user.id } });
  const users = await prisma.user.findMany({ where: { isActive: true, deletedAt: null, ...(audience === 'ALL' ? {} : { role: audience }) }, select: { id: true }, take: 2000 });
  notifyUsers(users.map((u) => u.id).filter((id) => id !== req.user.id), { type: 'ANNOUNCEMENT', title: `Event: ${title}`, body: startsAt.toDateString(), link: '/events' });
  res.status(201).json(ev);
}));

router.put('/events/:id', calendarEditor, asyncHandler(async (req, res) => {
  const found = await prisma.schoolEvent.findUnique({ where: { id: req.params.id } });
  if (!found) return res.status(404).json({ error: 'Event not found' });
  const data = {};
  if (req.body.title !== undefined) { data.title = str(req.body.title, 150); if (!data.title) return res.status(400).json({ error: 'Title is required' }); }
  if (req.body.description !== undefined) data.description = str(req.body.description, 2000) || null;
  if (req.body.location !== undefined) data.location = str(req.body.location, 150) || null;
  if (req.body.startsAt !== undefined) { const d = new Date(req.body.startsAt); if (isNaN(d)) return res.status(400).json({ error: 'A valid date is required' }); data.startsAt = d; }
  if (req.body.audience !== undefined) data.audience = ['ALL', 'STUDENT', 'TRAINER', 'PARENT', 'EMPLOYER', 'GUEST'].includes(req.body.audience) ? req.body.audience : 'ALL';
  res.json(await prisma.schoolEvent.update({ where: { id: found.id }, data }));
}));

router.delete('/events/:id', calendarEditor, asyncHandler(async (req, res) => {
  const ev = await prisma.schoolEvent.findUnique({ where: { id: req.params.id } });
  if (!ev) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'ADMIN' && ev.createdById !== req.user.id) return res.status(403).json({ error: 'Not allowed' });
  await prisma.schoolEvent.delete({ where: { id: ev.id } });
  res.json({ success: true });
}));

module.exports = router;
