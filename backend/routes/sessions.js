// Online-class attendance: the trainer opens a session, students check in with the code shown in class,
// the trainer verifies who really attended, and chooses whether parents / admin receive the result.
const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { asyncHandler, str } = require('../lib/http');
const { authenticate } = require('../lib/auth');
const { emitToUsers } = require('../lib/realtime');
const { notifyUsers } = require('../lib/notify');
const { canSeeStudent } = require('../lib/attendance');

const router = express.Router();
router.use(authenticate);
const staff = (req, res, next) => (['TRAINER', 'ADMIN'].includes(req.user.role) ? next() : res.status(403).json({ error: 'Teachers only' }));
const LATE_AFTER_MIN = 15;     // joined later than this = LATE
const SUSPICIOUS_AFTER_MIN = 30; // checked in this long after the start = worth a second look
const dayOf = (d) => new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
const hhmm = (d) => d.toISOString().slice(11, 16);

async function mySession(req, res) {
  const s = await prisma.attendanceSession.findUnique({ where: { id: req.params.id } });
  if (!s) { res.status(404).json({ error: 'Session not found' }); return null; }
  const owner = s.trainerId === req.user.id;
  const adminSees = req.user.role === 'ADMIN' && (s.sharedWithAdmin || owner);
  if (!owner && !adminSees) { res.status(403).json({ error: 'Not allowed' }); return null; }
  return s;
}
const classOf = (id) => prisma.classGroup.findUnique({ where: { id }, select: { id: true, name: true, department: true } });

// ---------- open a session (trainer) ----------
router.post('/sessions', staff, asyncHandler(async (req, res) => {
  const classGroupId = str(req.body.classGroupId, 60);
  const title = str(req.body.title, 150);
  const cls = await classOf(classGroupId);
  if (!cls || !title) return res.status(400).json({ error: 'Choose a class and give the session a title' });
  const minutes = Math.min(180, Math.max(5, parseInt(req.body.windowMinutes, 10) || 30));
  const now = new Date();
  const session = await prisma.attendanceSession.create({
    data: { trainerId: req.user.id, classGroupId, title, meetingLink: str(req.body.meetingLink, 400) || null, code: String(crypto.randomInt(10000, 99999)), startsAt: now, opensUntil: new Date(now.getTime() + minutes * 60_000) },
  });
  const students = await prisma.user.findMany({ where: { role: 'STUDENT', classGroupId, isActive: true, deletedAt: null }, select: { id: true } });
  notifyUsers(students.map((s) => s.id), { type: 'INFO', title: `Attendance is open: ${title}`, body: `Check in within ${minutes} minutes using the code your teacher shows in class.`, link: '/attendance' });
  emitToUsers(students.map((s) => s.id), 'attendance:open', { id: session.id, title });
  res.status(201).json(session);
}));

// ---------- list ----------
router.get('/sessions', asyncHandler(async (req, res) => {
  const { role, id } = req.user;
  if (role === 'STUDENT') {
    const me = await prisma.user.findUnique({ where: { id }, select: { classGroupId: true } });
    if (!me?.classGroupId) return res.json([]);
    const rows = await prisma.attendanceSession.findMany({ where: { classGroupId: me.classGroupId }, orderBy: { createdAt: 'desc' }, take: 10, include: { checkins: { where: { studentId: id } } } });
    return res.json(rows.map((s) => ({
      id: s.id, title: s.title, meetingLink: s.meetingLink, startsAt: s.startsAt, opensUntil: s.opensUntil, status: s.status,
      open: s.status === 'OPEN' && s.opensUntil > new Date(), checkedInAt: s.checkins[0]?.checkedInAt || null,
    })));
  }
  if (!['TRAINER', 'ADMIN'].includes(role)) return res.json([]);
  const where = role === 'ADMIN' ? { OR: [{ sharedWithAdmin: true }, { trainerId: id }] } : { trainerId: id };
  const rows = await prisma.attendanceSession.findMany({ where, orderBy: { createdAt: 'desc' }, take: 40, include: { _count: { select: { checkins: true } } } });
  const classes = await prisma.classGroup.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.classGroupId))] } }, select: { id: true, name: true, department: true } });
  const trainers = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.trainerId))] } }, select: { id: true, fullName: true } });
  res.json(rows.map((s) => ({ ...s, class: classes.find((c) => c.id === s.classGroupId) || null, trainer: trainers.find((t) => t.id === s.trainerId) || null, checkinCount: s._count.checkins, code: s.trainerId === id ? s.code : undefined })));
}));

// ---------- student check-in ----------
router.post('/sessions/:id/checkin', asyncHandler(async (req, res) => {
  if (req.user.role !== 'STUDENT') return res.status(403).json({ error: 'Only students check in' });
  const s = await prisma.attendanceSession.findUnique({ where: { id: req.params.id } });
  const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { classGroupId: true } });
  if (!s || s.classGroupId !== me?.classGroupId) return res.status(404).json({ error: 'Session not found for your class' });
  if (s.status !== 'OPEN' || s.opensUntil < new Date()) return res.status(400).json({ error: 'Check-in is closed for this session' });
  if (str(req.body.code, 10) !== s.code) return res.status(400).json({ error: 'Wrong code. Use the code your teacher shows in the online class.' });
  const checkin = await prisma.attendanceCheckin.upsert({ where: { sessionId_studentId: { sessionId: s.id, studentId: req.user.id } }, update: {}, create: { sessionId: s.id, studentId: req.user.id } });
  emitToUsers([s.trainerId], 'attendance:checkin', { sessionId: s.id, studentId: req.user.id });
  res.status(201).json({ checkedInAt: checkin.checkedInAt });
}));

router.post('/sessions/:id/close', staff, asyncHandler(async (req, res) => {
  const s = await mySession(req, res);
  if (!s) return;
  res.json(await prisma.attendanceSession.update({ where: { id: s.id }, data: { status: s.status === 'VERIFIED' ? 'VERIFIED' : 'CLOSED', opensUntil: new Date() } }));
}));

// ---------- trainer reviews who checked in ----------
router.get('/sessions/:id', staff, asyncHandler(async (req, res) => {
  const s = await mySession(req, res);
  if (!s) return;
  const [students, checkins, cls] = await Promise.all([
    prisma.user.findMany({ where: { role: 'STUDENT', classGroupId: s.classGroupId, deletedAt: null }, select: { id: true, fullName: true, avatar: true }, orderBy: { fullName: 'asc' } }),
    prisma.attendanceCheckin.findMany({ where: { sessionId: s.id } }),
    classOf(s.classGroupId),
  ]);
  const map = new Map(checkins.map((c) => [c.studentId, c]));
  res.json({
    session: { ...s, code: s.trainerId === req.user.id ? s.code : undefined, class: cls },
    students: students.map((st) => {
      const c = map.get(st.id);
      const mins = c ? Math.round((c.checkedInAt - s.startsAt) / 60_000) : null;
      return { ...st, checkedInAt: c?.checkedInAt || null, minutesAfterStart: mins, decision: c?.decision || null, late: mins != null && mins > LATE_AFTER_MIN, suspicious: mins != null && mins > SUSPICIOUS_AFTER_MIN };
    }),
  });
}));

// ---------- verify + choose who gets the result ----------
router.post('/sessions/:id/verify', staff, asyncHandler(async (req, res) => {
  const s = await mySession(req, res);
  if (!s) return;
  if (s.trainerId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Not allowed' });
  const shareParents = Boolean(req.body.shareWithParents);
  const shareAdmin = Boolean(req.body.shareWithAdmin);
  const decisions = new Map((Array.isArray(req.body.decisions) ? req.body.decisions : []).map((d) => [String(d.studentId), d.attended !== false]));

  const students = await prisma.user.findMany({ where: { role: 'STUDENT', classGroupId: s.classGroupId, deletedAt: null }, select: { id: true, fullName: true } });
  const checkins = new Map((await prisma.attendanceCheckin.findMany({ where: { sessionId: s.id } })).map((c) => [c.studentId, c]));
  const date = dayOf(s.startsAt);
  const excused = new Set((await prisma.absenceExcuse.findMany({ where: { date, status: 'APPROVED', studentId: { in: students.map((x) => x.id) } }, select: { studentId: true } })).map((e) => e.studentId));

  const result = { present: 0, late: 0, absent: 0, excused: 0, rejected: 0 };
  const lines = [];
  for (const st of students) {
    const c = checkins.get(st.id);
    const attended = c ? decisions.get(st.id) !== false : false; // checked in => attended unless the trainer rejects it
    let status; let note = null;
    if (c && attended) {
      const mins = Math.round((c.checkedInAt - s.startsAt) / 60_000);
      status = mins > LATE_AFTER_MIN ? 'LATE' : 'PRESENT';
      note = `${s.title}: joined ${hhmm(c.checkedInAt)} UTC`;
    } else if (excused.has(st.id)) { status = 'EXCUSED'; note = 'Approved excuse'; } else {
      status = 'ABSENT'; note = c ? `${s.title}: checked in but not confirmed by teacher` : `${s.title}: no check-in`;
    }
    if (c) await prisma.attendanceCheckin.update({ where: { id: c.id }, data: { decision: attended ? 'CONFIRMED' : 'REJECTED' } });
    await prisma.attendance.upsert({
      where: { studentId_date: { studentId: st.id, date } },
      update: { status, note, trainerId: s.trainerId, sessionId: s.id, joinedAt: c && attended ? c.checkedInAt : null, visibleToParents: shareParents },
      create: { studentId: st.id, date, status, note, trainerId: s.trainerId, sessionId: s.id, joinedAt: c && attended ? c.checkedInAt : null, visibleToParents: shareParents },
    });
    if (c && !attended) result.rejected += 1;
    result[{ PRESENT: 'present', LATE: 'late', ABSENT: 'absent', EXCUSED: 'excused' }[status]] += 1;
    lines.push({ student: st, status, joined: c && attended ? hhmm(c.checkedInAt) : null });
  }
  const updated = await prisma.attendanceSession.update({ where: { id: s.id }, data: { status: 'VERIFIED', verifiedAt: new Date(), opensUntil: new Date(), sharedWithParents: shareParents, sharedWithAdmin: shareAdmin } });

  if (shareParents) {
    const links = await prisma.parentStudent.findMany({ where: { studentId: { in: students.map((x) => x.id) }, status: 'APPROVED' } });
    for (const l of links) {
      const ln = lines.find((x) => x.student.id === l.studentId);
      const text = ln.status === 'ABSENT' ? 'was absent' : ln.status === 'EXCUSED' ? 'was excused' : `attended${ln.joined ? ` (joined ${ln.joined} UTC)` : ''}${ln.status === 'LATE' ? ', late' : ''}`;
      await notifyUsers([l.parentId], { type: 'INFO', title: `${ln.student.fullName} ${text}`, body: s.title, link: '/attendance' });
    }
  }
  if (shareAdmin) {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
    await notifyUsers(admins.map((a) => a.id), { type: 'INFO', title: `Attendance report: ${s.title}`, body: `Present ${result.present}, late ${result.late}, absent ${result.absent}, excused ${result.excused}.`, link: '/attendance' });
  }
  res.json({ session: updated, result });
}));

// ---------- absence excuses ----------
router.post('/excuses', asyncHandler(async (req, res) => {
  if (!['STUDENT', 'PARENT'].includes(req.user.role)) return res.status(403).json({ error: 'Students and parents only' });
  const studentId = req.user.role === 'STUDENT' ? req.user.id : str(req.body.studentId, 60);
  if (!(await canSeeStudent(req.user, studentId))) return res.status(403).json({ error: 'Not allowed' });
  const date = new Date(`${str(req.body.date, 10)}T00:00:00.000Z`);
  const reason = str(req.body.reason, 1000);
  if (Number.isNaN(date.getTime()) || !reason) return res.status(400).json({ error: 'Date and reason are required' });
  const row = await prisma.absenceExcuse.create({ data: { studentId, submittedById: req.user.id, date, reason } });
  const trainers = await prisma.user.findMany({ where: { role: 'TRAINER', isActive: true }, select: { id: true }, take: 200 });
  notifyUsers(trainers.map((t) => t.id), { type: 'INFO', title: 'New absence excuse', body: reason.slice(0, 100), link: '/attendance' });
  res.status(201).json(row);
}));

router.get('/excuses', asyncHandler(async (req, res) => {
  const { role, id } = req.user;
  let where = {};
  if (role === 'STUDENT') where = { studentId: id };
  else if (role === 'PARENT') {
    const links = await prisma.parentStudent.findMany({ where: { parentId: id, status: 'APPROVED' }, select: { studentId: true } });
    where = { studentId: { in: links.map((l) => l.studentId) } };
  } else if (!['TRAINER', 'ADMIN'].includes(role)) return res.json([]);
  const rows = await prisma.absenceExcuse.findMany({ where, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 50 });
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.studentId))] } }, select: { id: true, fullName: true } });
  res.json(rows.map((r) => ({ ...r, studentName: users.find((u) => u.id === r.studentId)?.fullName || '' })));
}));

router.put('/excuses/:id', staff, asyncHandler(async (req, res) => {
  const e = await prisma.absenceExcuse.findUnique({ where: { id: req.params.id } });
  if (!e) return res.status(404).json({ error: 'Not found' });
  const approve = req.body.action === 'approve';
  const updated = await prisma.absenceExcuse.update({ where: { id: e.id }, data: { status: approve ? 'APPROVED' : 'REJECTED', decidedById: req.user.id, decidedAt: new Date() } });
  if (approve) {
    await prisma.attendance.upsert({
      where: { studentId_date: { studentId: e.studentId, date: e.date } },
      update: { status: 'EXCUSED', note: 'Approved excuse', visibleToParents: true },
      create: { studentId: e.studentId, date: e.date, status: 'EXCUSED', note: 'Approved excuse', trainerId: req.user.id },
    });
  }
  const parents = await prisma.parentStudent.findMany({ where: { studentId: e.studentId, status: 'APPROVED' }, select: { parentId: true } });
  notifyUsers([e.studentId, ...parents.map((p) => p.parentId)], { type: 'INFO', title: approve ? 'Absence excused' : 'Excuse not accepted', body: e.reason.slice(0, 100), link: '/attendance' });
  res.json(updated);
}));

module.exports = router;
