const express = require('express');
const { signupAllowed } = require('../lib/siteConfig');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { asyncHandler, rateLimit, str, normEmail, isEmail } = require('../lib/http');
const { signToken, publicUser, authenticate } = require('../lib/auth');
const { ALLOWED_SELF_ROLES, isProd } = require('../lib/config');
const { sendOTPEmail } = require('../config/email');
const { notifyUsers } = require('../lib/notify');
const { makeChallenge, requireHuman } = require('../lib/humanCheck');

const router = express.Router();
const verificationDir = path.join(__dirname, '..', 'private-verifications');
if (!fs.existsSync(verificationDir)) fs.mkdirSync(verificationDir, { recursive: true });
const verificationUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, verificationDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^(image\/(jpeg|png|webp)|application\/pdf)$/i.test(file.mimetype);
    cb(ok ? null : new Error('Verification document must be PDF, JPG, PNG or WEBP'), ok);
  },
});
const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 40 });
const otpLimiter = rateLimit({ windowMs: 10 * 60_000, max: 10, message: 'Too many code requests, please wait a few minutes' });

const OTP_TTL_MS = 10 * 60_000;
const MAX_OTP_ATTEMPTS = 5;

async function issueOtp(email, type) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await bcrypt.hash(code, 8);
  await prisma.otp.deleteMany({ where: { email, type } });
  await prisma.otp.create({ data: { email, type, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) } });
  return sendOTPEmail(email, code, type);
}

// returns null if OK, or an error string
async function checkOtp(email, type, code) {
  const otp = await prisma.otp.findFirst({ where: { email, type }, orderBy: { createdAt: 'desc' } });
  if (!otp) return 'No code requested. Please request a new code.';
  if (otp.expiresAt < new Date()) {
    await prisma.otp.delete({ where: { id: otp.id } });
    return 'Code expired. Please request a new one.';
  }
  if (otp.attempts >= MAX_OTP_ATTEMPTS) return 'Too many wrong attempts. Please request a new code.';
  const ok = await bcrypt.compare(String(code || ''), otp.codeHash);
  if (!ok) {
    await prisma.otp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return 'Invalid code';
  }
  await prisma.otp.deleteMany({ where: { email, type } });
  return null;
}

// "I am not a robot" question (signed token, expires in 10 minutes)
router.get('/human-check', (req, res) => res.json(makeChallenge()));

router.post('/register', authLimiter, verificationUpload.single('verificationDocument'), requireHuman, asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email);
  const fullName = str(req.body.fullName, 100);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const phone = str(req.body.phone, 30) || null;
  const role = ALLOWED_SELF_ROLES.includes(req.body.role) ? req.body.role : 'STUDENT';
  if (!(await signupAllowed(role))) return res.status(403).json({ error: 'Registration for this account type is closed by the administrator.' });
  const school = str(req.body.school, 120) || null;
  const schoolType = ['UNIVERSITY', 'HIGH_SCHOOL', 'TVET'].includes(req.body.schoolType) ? req.body.schoolType : null;
  const department = str(req.body.department, 120) || null;
  const className = str(req.body.className, 80) || null;
  // The ID/letter upload is optional unless REQUIRE_STUDENT_DOCUMENT=true (admins can still approve it later)
  if (role === 'STUDENT' && process.env.REQUIRE_STUDENT_DOCUMENT === 'true' && !req.file) return res.status(400).json({ error: schoolType === 'UNIVERSITY' ? 'Upload your university student card' : 'Upload your school introduction letter' });
  if (role === 'STUDENT' && !schoolType) return res.status(400).json({ error: 'Choose your education level' });
  const childEmails = role === 'PARENT' ? String(req.body.childEmails || '').split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(isEmail).slice(0, 8) : [];
  const relationship = str(req.body.relationship, 40) || 'Parent';
  if (role === 'PARENT' && !childEmails.length) return res.status(400).json({ error: 'Enter your child\'s student email so we can link your accounts' });
  const verificationDocumentUrl = req.file ? `/private-verifications/${req.file.filename}` : null;
  // Never trust a client-supplied role: only STUDENT / TRAINER can be self-selected

  if (!isEmail(email)) return res.status(400).json({ error: 'Valid email is required' });
  if (!fullName) return res.status(400).json({ error: 'Full name is required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.isVerified) return res.status(400).json({ error: 'Email already registered' });

  let classGroupId = null;
  if (role === 'STUDENT' && department && className) {
    let group = await prisma.classGroup.findFirst({ where: { school, department, name: className, schoolType } });
    if (!group) group = await prisma.classGroup.create({ data: { school, department, name: className, schoolType } });
    classGroupId = group.id;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let account;
  if (existing) {
    // Unverified leftover from an earlier attempt: let them re-register with new details
    account = await prisma.user.update({ where: { id: existing.id }, data: { fullName, passwordHash, role, phone, school, schoolType, department, className, verificationDocumentUrl, verificationStatus: verificationDocumentUrl ? 'PENDING' : 'NOT_SUBMITTED', classGroupId } });
  } else {
    account = await prisma.user.create({ data: { email, fullName, passwordHash, role, phone, school, schoolType, department, className, verificationDocumentUrl, verificationStatus: verificationDocumentUrl ? 'PENDING' : 'NOT_SUBMITTED', classGroupId, isVerified: false } });
  }

  // Parents are linked to their children's student accounts right away (matched by the student's email)
  const unlinkedEmails = [];
  if (role === 'PARENT') {
    for (const childEmail of childEmails) {
      const child = await prisma.user.findFirst({ where: { email: childEmail, role: 'STUDENT' }, select: { id: true } });
      if (!child) { unlinkedEmails.push(childEmail); continue; }
      await prisma.parentStudent.upsert({ where: { parentId_studentId: { parentId: account.id, studentId: child.id } }, update: { relationship }, create: { parentId: account.id, studentId: child.id, relationship, status: 'PENDING' } });
      notifyUsers([child.id], { type: 'INFO', title: `${fullName} wants to follow your progress`, body: 'Approve or reject this parent request in Parents & Teachers.', link: '/family' });
    }
  }

  // EMAIL_VERIFICATION=off skips the code. In development a failed email also falls back to
  // instant verification (the code is printed in the backend console) so sign-up never blocks.
  const sent = process.env.EMAIL_VERIFICATION === 'off' ? false : await issueOtp(email, 'verification');
  if (!sent && (process.env.EMAIL_VERIFICATION === 'off' || !isProd)) {
    const verified = await prisma.user.update({ where: { id: account.id }, data: { isVerified: true } });
    return res.status(201).json({ email, autoVerified: true, token: signToken(verified), user: publicUser(verified), unlinkedEmails, message: 'Account created' });
  }
  if (!sent) return res.status(502).json({ error: 'Could not send verification email. Please try again shortly.' });
  res.status(201).json({ email, unlinkedEmails, message: 'Verification code sent' });
}));

router.post('/verify-otp', authLimiter, asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: 'Account not found' });

  if (!user.isVerified) {
    const err = await checkOtp(email, 'verification', req.body.otp);
    if (err) return res.status(400).json({ error: err });
  } else {
    return res.status(400).json({ error: 'Account already verified. Please login.' });
  }
  const updated = await prisma.user.update({ where: { id: user.id }, data: { isVerified: true } });
  res.json({ token: signToken(updated), user: publicUser(updated) });
}));

router.post('/resend-otp', otpLimiter, asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email);
  const user = await prisma.user.findUnique({ where: { email } });
  // Same response whether or not the account exists (no user enumeration)
  if (user && !user.isVerified) {
    const sent = await issueOtp(email, 'verification');
    if (!sent) return res.status(502).json({ error: 'Could not send email. Please try again shortly.' });
  }
  res.json({ message: 'If the account is awaiting verification, a new code was sent' });
}));

router.post('/login', authLimiter, requireHuman, asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid || user.deletedAt || user.status === 'DELETED') return res.status(401).json({ error: 'Invalid credentials' });
  if (!user.isActive || user.status === 'INACTIVE') {
    return res.status(403).json({ error: 'Your account is deactivated. Please contact the administrator.', code: 'ACCOUNT_DISABLED' });
  }
  if (!user.isVerified) {
    return res.status(403).json({ error: 'Please verify your email first', needsVerification: true, email });
  }
  const updated = await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  res.json({ token: signToken(updated), user: publicUser(updated) });
}));

router.post('/forgot-password', otpLimiter, asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email);
  if (!isEmail(email)) return res.status(400).json({ error: 'Valid email is required' });
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const sent = await issueOtp(email, 'reset');
    if (!sent) return res.status(502).json({ error: 'Could not send email. Please try again shortly.' });
  }
  res.json({ message: 'If that email exists, a reset code was sent' });
}));

router.post('/reset-password', authLimiter, asyncHandler(async (req, res) => {
  const email = normEmail(req.body.email);
  const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(400).json({ error: 'Invalid code' });
  const err = await checkOtp(email, 'reset', req.body.otp);
  if (err) return res.status(400).json({ error: err });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10), isVerified: true, mustChangePassword: false } });
  res.json({ message: 'Password reset successfully' });
}));

router.post('/change-password', authenticate, authLimiter, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!(await bcrypt.compare(String(currentPassword || ''), user.passwordHash))) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10), mustChangePassword: false } });
  res.json({ message: 'Password changed' });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json(publicUser(user));
}));

module.exports = router;
