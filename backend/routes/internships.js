const express = require('express');
const prisma = require('../lib/prisma');
const { asyncHandler, str } = require('../lib/http');
const { authenticate, requireAdmin } = require('../lib/auth');
const { emitToUser } = require('../lib/realtime');

const router = express.Router();
router.use(authenticate);
// Admin always; trainers only when the admin granted "edit internships".
const canEditInternships = async (req, res, next) => {
  if (req.user.role === 'ADMIN') return next();
  const me = req.user.role === 'TRAINER' ? await prisma.user.findUnique({ where: { id: req.user.id }, select: { canEditInternships: true } }) : null;
  return me?.canEditInternships ? next() : res.status(403).json({ error: 'The admin has not given you access to edit internships' });
};

// ---------- Internships ----------
router.get('/internships', asyncHandler(async (req, res) => {
  if (req.user.role === 'PARENT') return res.json([]); // parents do not need internships
  let seeAll = req.user.role === 'ADMIN';
  if (!seeAll && req.user.role === 'TRAINER') {
    const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { canEditInternships: true } });
    seeAll = Boolean(me?.canEditInternships); // editors also see the deactivated ones so they can re-activate them
  }
  const where = seeAll ? {} : { isActive: true };
  res.json(await prisma.internship.findMany({ where, orderBy: { createdAt: 'desc' } }));
}));

router.post('/internships', canEditInternships, asyncHandler(async (req, res) => {
  const title = str(req.body.title, 150);
  const company = str(req.body.company, 150);
  const description = str(req.body.description, 5000);
  const deadline = new Date(req.body.deadline);
  if (!title || !company || !description) return res.status(400).json({ error: 'Title, company and description are required' });
  if (isNaN(deadline)) return res.status(400).json({ error: 'A valid deadline is required' });
  const duration = Number.isFinite(parseInt(req.body.duration)) ? Math.max(1, parseInt(req.body.duration)) : 3;
  const stipend = Number.isFinite(parseInt(req.body.stipend)) ? Math.max(0, parseInt(req.body.stipend)) : 0;
  const internship = await prisma.internship.create({
    data: { title, company, description, location: str(req.body.location, 150) || null, duration, stipend, deadline },
  });
  res.status(201).json(internship);
}));

router.patch('/applications/:id/status', canEditInternships, asyncHandler(async (req, res) => {
  const status = String(req.body.status || '').toUpperCase();
  if (!['PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED'].includes(status)) return res.status(400).json({ error: 'Invalid application status' });
  const app = await prisma.internshipApplication.findUnique({ where: { id: req.params.id } });
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (status === 'IN_PROGRESS' && !['APPROVED','IN_PROGRESS'].includes(app.status)) return res.status(409).json({ error: 'Approve the application before starting the internship' });
  if (status === 'COMPLETED' && app.status !== 'IN_PROGRESS') return res.status(409).json({ error: 'Only an internship in progress can be marked completed' });
  const updated = await prisma.internshipApplication.update({ where: { id: app.id }, data: { status, reviewedAt: new Date() } });
  res.json(updated);
}));

// V6: edit an internship (admin, or a trainer the admin allowed)
router.put('/internships/:id', canEditInternships, asyncHandler(async (req, res) => {
  const found = await prisma.internship.findUnique({ where: { id: req.params.id } });
  if (!found) return res.status(404).json({ error: 'Internship not found' });
  const data = {};
  if (req.body.title !== undefined) { data.title = str(req.body.title, 150); if (!data.title) return res.status(400).json({ error: 'Title cannot be empty' }); }
  if (req.body.company !== undefined) { data.company = str(req.body.company, 150); if (!data.company) return res.status(400).json({ error: 'Company cannot be empty' }); }
  if (req.body.description !== undefined) { data.description = str(req.body.description, 5000); if (!data.description) return res.status(400).json({ error: 'Description cannot be empty' }); }
  if (req.body.location !== undefined) data.location = str(req.body.location, 150) || null;
  if (req.body.duration !== undefined) { const d = parseInt(req.body.duration, 10); if (!Number.isFinite(d) || d < 1) return res.status(400).json({ error: 'Duration must be at least 1 month' }); data.duration = d; }
  if (req.body.stipend !== undefined) { const s2 = parseInt(req.body.stipend, 10); data.stipend = Number.isFinite(s2) ? Math.max(0, s2) : 0; }
  if (req.body.deadline !== undefined) { const dl = new Date(req.body.deadline); if (isNaN(dl)) return res.status(400).json({ error: 'A valid deadline is required' }); data.deadline = dl; }
  if (req.body.isActive !== undefined) data.isActive = Boolean(req.body.isActive);
  res.json(await prisma.internship.update({ where: { id: found.id }, data }));
}));

// V6: activate / deactivate (hidden from students while inactive, applications are kept)
router.patch('/internships/:id/active', canEditInternships, asyncHandler(async (req, res) => {
  const found = await prisma.internship.findUnique({ where: { id: req.params.id } });
  if (!found) return res.status(404).json({ error: 'Internship not found' });
  const isActive = req.body.isActive === undefined ? !found.isActive : Boolean(req.body.isActive);
  res.json(await prisma.internship.update({ where: { id: found.id }, data: { isActive } }));
}));

// V6: staff list of applicants for one internship
router.get('/internships/:id/applications', canEditInternships, asyncHandler(async (req, res) => {
  res.json(await prisma.internshipApplication.findMany({
    where: { internshipId: req.params.id },
    include: { student: { select: { id: true, fullName: true, email: true, className: true, department: true } } },
    orderBy: { appliedAt: 'desc' },
  }));
}));

router.delete('/internships/:id', canEditInternships, asyncHandler(async (req, res) => {
  const found = await prisma.internship.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!found) return res.status(404).json({ error: 'Internship not found' });
  await prisma.internship.delete({ where: { id: found.id } }); // applications cascade
  res.json({ success: true });
}));

router.post('/internships/:id/apply', asyncHandler(async (req, res) => {
  if (req.user.role !== 'STUDENT') return res.status(403).json({ error: 'Only students can apply' });
  const internship = await prisma.internship.findUnique({ where: { id: req.params.id } });
  if (!internship || !internship.isActive) return res.status(404).json({ error: 'Internship not found' });
  if (internship.deadline < new Date()) return res.status(400).json({ error: 'The application deadline has passed' });
  const existing = await prisma.internshipApplication.findUnique({
    where: { studentId_internshipId: { studentId: req.user.id, internshipId: internship.id } },
  });
  if (existing) return res.status(400).json({ error: 'You already applied for this internship' });
  const application = await prisma.internshipApplication.create({
    data: { studentId: req.user.id, internshipId: internship.id, message: str(req.body.message, 1000) || null },
  });
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
  admins.forEach((a) => emitToUser(a.id, 'application:submitted', { internshipId: internship.id, applicationId: application.id }));
  res.status(201).json(application);
}));

// ---------- My applications ----------
router.get('/my-applications', asyncHandler(async (req, res) => {
  res.json(await prisma.internshipApplication.findMany({
    where: { studentId: req.user.id },
    include: { internship: { select: { id: true, title: true, company: true } } },
    orderBy: { appliedAt: 'desc' },
  }));
}));

router.delete('/applications/:id', asyncHandler(async (req, res) => {
  const app = await prisma.internshipApplication.findUnique({ where: { id: req.params.id } });
  if (!app || app.studentId !== req.user.id) return res.status(404).json({ error: 'Application not found' });
  if (app.status !== 'PENDING') return res.status(400).json({ error: 'Only pending applications can be withdrawn' });
  await prisma.internshipApplication.delete({ where: { id: app.id } });
  res.json({ success: true });
}));

module.exports = router;
