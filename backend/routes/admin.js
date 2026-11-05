const express = require('express');
const path = require('path');
const prisma = require('../lib/prisma');
const { asyncHandler, str } = require('../lib/http');
const { authenticate, requireAdmin, publicUser } = require('../lib/auth');
const { emitToUser } = require('../lib/realtime');
const { ROLES } = require('../lib/config');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { logAdmin } = require('../lib/audit');
const { notifyUsers } = require('../lib/notify');
const { sendOTPEmail } = require('../config/email');

const router = express.Router();
router.use(authenticate);

// Any logged-in user can ask "who do I contact?" (used by Internships -> Contact Company)
router.get('/contact', asyncHandler(async (req, res) => {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' }, select: { id: true, fullName: true } });
  if (!admin) return res.status(404).json({ error: 'No admin available' });
  res.json(admin);
}));

router.use(requireAdmin);


router.get('/verifications', asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({ where: { verificationStatus: 'PENDING' }, select: { id: true, fullName: true, email: true, school: true, schoolType: true, department: true, className: true, verificationStatus: true, createdAt: true } , orderBy: { createdAt: 'asc' } });
  res.json(users);
}));

router.get('/verifications/:id/document', asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { verificationDocumentUrl: true } });
  if (!user?.verificationDocumentUrl) return res.status(404).json({ error: 'Document not found' });
  const file = path.join(__dirname, '..', 'private-verifications', path.basename(user.verificationDocumentUrl));
  if (!require('fs').existsSync(file)) return res.status(404).json({ error: 'The uploaded file is missing on the server (demo accounts have no real document). Ask the student to upload it again.' });
  res.sendFile(file);
}));

// ---------- V5.5: which classes each trainer teaches + what the trainer may edit ----------
router.get('/teaching', asyncHandler(async (req, res) => {
  const [trainers, classes, assigns] = await Promise.all([
    prisma.user.findMany({ where: { role: 'TRAINER', deletedAt: null }, select: { id: true, fullName: true, email: true, department: true, isActive: true, canEditInternships: true, canEditEvents: true }, orderBy: { fullName: 'asc' } }),
    prisma.classGroup.findMany({ select: { id: true, name: true, department: true, school: true, _count: { select: { members: true } } }, orderBy: [{ department: 'asc' }, { name: 'asc' }] }),
    prisma.trainerAssignment.findMany(),
  ]);
  res.json({ trainers: trainers.map((t) => ({ ...t, classIds: assigns.filter((a) => a.trainerId === t.id).map((a) => a.classGroupId) })), classes });
}));

router.put('/teaching/:trainerId', asyncHandler(async (req, res) => {
  const trainer = await prisma.user.findFirst({ where: { id: req.params.trainerId, role: 'TRAINER' }, select: { id: true } });
  if (!trainer) return res.status(404).json({ error: 'Trainer not found' });
  const classIds = Array.isArray(req.body.classIds) ? [...new Set(req.body.classIds.map(String))].slice(0, 100) : [];
  const valid = (await prisma.classGroup.findMany({ where: { id: { in: classIds } }, select: { id: true } })).map((c) => c.id);
  await prisma.$transaction([
    prisma.trainerAssignment.deleteMany({ where: { trainerId: trainer.id } }),
    ...(valid.length ? [prisma.trainerAssignment.createMany({ data: valid.map((classGroupId) => ({ trainerId: trainer.id, classGroupId })) })] : []),
    prisma.user.update({ where: { id: trainer.id }, data: { canEditInternships: !!req.body.canEditInternships, canEditEvents: !!req.body.canEditEvents } }),
  ]);
  res.json({ success: true, classIds: valid });
}));

router.put('/verifications/:id', asyncHandler(async (req, res) => {
  const status = req.body.status;
  if (!['APPROVED', 'REJECTED'].includes(status)) return res.status(400).json({ error: 'Status must be APPROVED or REJECTED' });
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { verificationStatus: status, verificationNote: str(req.body.note, 500) || null } }).catch(() => null);
  if (!user) return res.status(404).json({ error: 'Student not found' });
  res.json(publicUser(user));
}));

// ---------------------------------------------------------------------------
// User management (V5.1): list/search/filter, add, edit, activate/deactivate,
// reset password and SOFT delete (courses, grades and certificates are kept).
// ---------------------------------------------------------------------------
const tempPassword = () => `Nts-${crypto.randomBytes(4).toString('hex')}${Math.floor(10 + Math.random() * 90)}`;
const activeAdminCount = (excludeId) => prisma.user.count({ where: { role: 'ADMIN', isActive: true, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) } });

// GET /admin/users?q=&role=&status=&page=&limit=
//   status: ACTIVE | INACTIVE | DELETED | PENDING (email not verified yet). Deleted users are hidden by default.
router.get('/users', asyncHandler(async (req, res) => {
  const q = str(req.query.q, 80);
  const role = ROLES.includes(req.query.role) ? req.query.role : null;
  const status = str(req.query.status, 20).toUpperCase();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 500);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const where = {};
  if (q) where.OR = [{ fullName: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }];
  if (role) where.role = role;
  if (status === 'DELETED') where.deletedAt = { not: null };
  else {
    where.deletedAt = null;
    if (status === 'ACTIVE') { where.isActive = true; where.isVerified = true; }
    else if (status === 'INACTIVE') where.isActive = false;
    else if (status === 'PENDING') where.isVerified = false;
  }

  const [rows, total, byRole, deleted, inactive] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.user.count({ where }),
    prisma.user.groupBy({ by: ['role'], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.user.count({ where: { deletedAt: { not: null } } }),
    prisma.user.count({ where: { deletedAt: null, isActive: false } }),
  ]);
  const counts = { deleted, inactive, byRole: Object.fromEntries(byRole.map((r) => [r.role, r._count._all])) };
  res.json({ users: rows.map(publicUser), total, page, pages: Math.max(Math.ceil(total / limit), 1), counts });
}));

// POST /admin/users  { fullName, email, phone, role, password?, status? }
router.post('/users', asyncHandler(async (req, res) => {
  const fullName = str(req.body.fullName, 100);
  const email = str(req.body.email, 254).toLowerCase();
  const role = req.body.role || 'STUDENT';
  if (!fullName) return res.status(400).json({ error: 'Full name is required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Valid email is required' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  let password = typeof req.body.password === 'string' ? req.body.password : '';
  if (password && password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const generated = !password;
  if (generated) password = tempPassword();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, deletedAt: true } });
  if (existing) return res.status(400).json({ error: existing.deletedAt ? 'This email belongs to a deleted user. Restore that user instead.' : 'Email already registered' });
  const inactive = String(req.body.status || '').toUpperCase() === 'INACTIVE';
  const user = await prisma.user.create({
    data: {
      fullName, email, role,
      phone: str(req.body.phone, 30) || null,
      school: str(req.body.school, 120) || null,
      passwordHash: await bcrypt.hash(password, 10),
      isVerified: true, // created by an admin, no email OTP needed
      isActive: !inactive, status: inactive ? 'INACTIVE' : 'ACTIVE',
      mustChangePassword: generated,
    },
  });
  logAdmin(req.user.id, 'USER_CREATED', user.id, { email, role });
  res.status(201).json({ user: publicUser(user), ...(generated ? { tempPassword: password } : {}) });
}));

router.put('/users/:id/role', asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (req.params.id === req.user.id && role !== 'ADMIN') return res.status(400).json({ error: 'You cannot remove your own admin role' });
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { role } }).catch(() => null);
  if (!user) return res.status(404).json({ error: 'User not found' });
  logAdmin(req.user.id, 'ROLE_CHANGED', user.id, { role });
  res.json(publicUser(user));
}));

// PUT /admin/users/:id/status  { status: 'ACTIVE' | 'INACTIVE' }   (the Activate / Deactivate switch)
router.put('/users/:id/status', asyncHandler(async (req, res) => {
  const status = String(req.body.status || '').toUpperCase();
  if (!['ACTIVE', 'INACTIVE'].includes(status)) return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE' });
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target || target.deletedAt) return res.status(404).json({ error: 'User not found' });
  if (status === 'INACTIVE') {
    if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot deactivate your own account' });
    if (target.role === 'ADMIN' && (await activeAdminCount(target.id)) === 0) return res.status(400).json({ error: 'At least one active admin is required' });
  }
  const user = await prisma.user.update({ where: { id: target.id }, data: { status, isActive: status === 'ACTIVE' } });
  logAdmin(req.user.id, status === 'ACTIVE' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', user.id);
  res.json(publicUser(user));
}));

// PUT /admin/users/:id  (edit names, email, phone, role, status ...)
router.put('/users/:id', asyncHandler(async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target || target.deletedAt) return res.status(404).json({ error: 'User not found' });
  const data = {};
  if (req.body.fullName !== undefined) {
    const n = str(req.body.fullName, 100);
    if (!n) return res.status(400).json({ error: 'Full name is required' });
    data.fullName = n;
  }
  if (req.body.email !== undefined) {
    const email = str(req.body.email, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Valid email is required' });
    if (email !== target.email) {
      if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return res.status(400).json({ error: 'Email already registered' });
      data.email = email;
    }
  }
  if (req.body.phone !== undefined) data.phone = str(req.body.phone, 30) || null;
  if (req.body.school !== undefined) data.school = str(req.body.school, 120) || null;
  if (req.body.bio !== undefined) data.bio = str(req.body.bio, 500) || null;
  if (req.body.role !== undefined && req.body.role !== target.role) {
    if (!ROLES.includes(req.body.role)) return res.status(400).json({ error: 'Invalid role' });
    if (target.role === 'ADMIN' && (req.params.id === req.user.id || (await activeAdminCount(target.id)) === 0)) return res.status(400).json({ error: 'You cannot remove the last / your own admin role' });
    data.role = req.body.role;
  }
  if (req.body.status !== undefined) {
    const status = String(req.body.status).toUpperCase();
    if (!['ACTIVE', 'INACTIVE'].includes(status)) return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE' });
    if (status === 'INACTIVE' && target.id === req.user.id) return res.status(400).json({ error: 'You cannot deactivate your own account' });
    data.status = status; data.isActive = status === 'ACTIVE';
  }
  const user = await prisma.user.update({ where: { id: target.id }, data });
  logAdmin(req.user.id, 'USER_UPDATED', user.id, Object.keys(data));
  res.json(publicUser(user));
}));

// POST /admin/users/:id/reset-password  { mode: 'set' | 'generate' | 'email', newPassword? }
router.post('/users/:id/reset-password', asyncHandler(async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target || target.deletedAt) return res.status(404).json({ error: 'User not found' });
  const mode = ['set', 'generate', 'email'].includes(req.body.mode) ? req.body.mode : (req.body.newPassword ? 'set' : 'generate');

  if (mode === 'email') {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await prisma.otp.deleteMany({ where: { email: target.email, type: 'reset' } });
    await prisma.otp.create({ data: { email: target.email, type: 'reset', codeHash: await bcrypt.hash(code, 8), expiresAt: new Date(Date.now() + 10 * 60_000) } });
    const sent = await sendOTPEmail(target.email, code, 'reset');
    if (!sent) return res.status(502).json({ error: 'Could not send the email. Check EMAIL_USER / EMAIL_PASS in .env' });
    logAdmin(req.user.id, 'PASSWORD_RESET_EMAILED', target.id);
    return res.json({ message: `A reset code was emailed to ${target.email}. The user continues from "Forgot password".` });
  }

  let password = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
  if (mode === 'set' && password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const generated = mode === 'generate';
  if (generated) password = tempPassword();
  await prisma.user.update({ where: { id: target.id }, data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: generated } });
  logAdmin(req.user.id, generated ? 'PASSWORD_RESET_GENERATED' : 'PASSWORD_RESET_SET', target.id);
  res.json({ message: 'Password reset', ...(generated ? { tempPassword: password } : {}) });
}));

// DELETE /admin/users/:id  -> SOFT delete. The row (and every course, grade, certificate linked to it) stays.
router.delete('/users/:id', asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });
  const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true, deletedAt: true } });
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.deletedAt) return res.json({ success: true, alreadyDeleted: true });
  if (target.role === 'ADMIN' && (await activeAdminCount(target.id)) === 0) return res.status(400).json({ error: 'At least one active admin is required' });
  await prisma.user.update({ where: { id: target.id }, data: { isActive: false, status: 'DELETED', deletedAt: new Date() } });
  logAdmin(req.user.id, 'USER_SOFT_DELETED', target.id);
  res.json({ success: true, soft: true });
}));

router.post('/users/:id/restore', asyncHandler(async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, deletedAt: true } });
  if (!target) return res.status(404).json({ error: 'User not found' });
  const user = await prisma.user.update({ where: { id: target.id }, data: { isActive: true, status: 'ACTIVE', deletedAt: null } });
  logAdmin(req.user.id, 'USER_RESTORED', target.id);
  res.json(publicUser(user));
}));

// Recent admin activity (who changed which account)
router.get('/audit-log', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const rows = await prisma.adminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  const ids = [...new Set(rows.flatMap((r) => [r.actorId, r.targetId]).filter(Boolean))];
  const people = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true, email: true } });
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  res.json(rows.map((r) => ({ ...r, actor: byId[r.actorId] || null, target: r.targetId ? byId[r.targetId] || null : null })));
}));

// Parent <-> student links
router.get('/parent-links', asyncHandler(async (req, res) => {
  res.json(await prisma.parentStudent.findMany({
    include: { parent: { select: { id: true, fullName: true, email: true } }, student: { select: { id: true, fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  }));
}));
router.post('/parent-links', asyncHandler(async (req, res) => {
  const { parentId, studentId } = req.body;
  const [parent, student] = await Promise.all([
    prisma.user.findUnique({ where: { id: String(parentId || '') }, select: { role: true } }),
    prisma.user.findUnique({ where: { id: String(studentId || '') }, select: { role: true } }),
  ]);
  if (!parent || parent.role !== 'PARENT') return res.status(400).json({ error: 'parentId must be a PARENT account' });
  if (!student || student.role !== 'STUDENT') return res.status(400).json({ error: 'studentId must be a STUDENT account' });
  const link = await prisma.parentStudent.upsert({
    where: { parentId_studentId: { parentId, studentId } },
    update: { relationship: str(req.body.relationship, 40) || 'Parent', status: 'APPROVED' },
    create: { parentId, studentId, relationship: str(req.body.relationship, 40) || 'Parent', status: 'APPROVED' },
  });
  logAdmin(req.user.id, 'PARENT_LINKED', studentId, { parentId });
  res.status(201).json(link);
}));
router.delete('/parent-links/:id', asyncHandler(async (req, res) => {
  await prisma.parentStudent.delete({ where: { id: req.params.id } }).catch(() => null);
  res.json({ success: true });
}));

router.get('/applications', asyncHandler(async (req, res) => {
  res.json(await prisma.internshipApplication.findMany({
    include: {
      student: { select: { id: true, fullName: true, email: true, school: true } },
      internship: { select: { id: true, title: true, company: true } },
    },
    orderBy: { appliedAt: 'desc' },
  }));
}));

router.put('/applications/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const found = await prisma.internshipApplication.findUnique({ where: { id: req.params.id }, select: { id: true, status: true } });
  if (!found) return res.status(404).json({ error: 'Application not found' });
  if (status === 'IN_PROGRESS' && !['APPROVED','IN_PROGRESS'].includes(found.status)) return res.status(409).json({ error: 'Approve the application before starting the internship' });
  if (status === 'COMPLETED' && found.status !== 'IN_PROGRESS') return res.status(409).json({ error: 'Only an internship in progress can be marked completed' });
  const app = await prisma.internshipApplication.update({
    where: { id: found.id },
    data: { status, reviewedAt: new Date() },
    include: { internship: { select: { title: true } } },
  });
  // Tell the student in real time (previously the admin's browser tried to do this itself)
  emitToUser(app.studentId, 'application:status:updated', { internshipTitle: app.internship.title, status });
  notifyUsers([app.studentId], { type: 'APPLICATION', title: `Internship application ${status.toLowerCase().replace('_', ' ')}`, body: app.internship.title, link: '/internships' });
  res.json(app);
}));

router.get('/reports', asyncHandler(async (req, res) => {
  res.json(await prisma.report.findMany({
    where: { status: 'OPEN' },
    include: { post: { select: { id: true, content: true, authorId: true } }, reporter: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'desc' },
  }));
}));

module.exports = router;
