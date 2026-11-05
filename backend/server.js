const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { PORT, JWT_SECRET, corsOrigin, isProd, ADMIN_EMAIL, ADMIN_PASSWORD } = require('./lib/config');
const prisma = require('./lib/prisma');
const { asyncHandler } = require('./lib/http');
const { authenticate } = require('./lib/auth');
const realtime = require('./lib/realtime');
const { seedDefaultTrades } = require('./routes/trades');
const { seedDemoData, seedDemoDataV53, seedDemoDataV54, seedDemoDataV55 } = require('./scripts/seed');
const { seedDemoDataV62 } = require('./scripts/seedV62');

const app = express();
const server = http.createServer(app);
app.set('trust proxy', 1); // behind Render's proxy: correct req.protocol / req.ip

const io = new Server(server, {
  cors: { origin: corsOrigin, credentials: true },
  transports: ['websocket', 'polling'],
});
realtime.setIO(io);

// ---------- Middleware ----------
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(cors({ origin: corsOrigin, credentials: true }));
// Files go through multer, so JSON bodies can stay small (was 100mb = easy DoS)
app.use(express.json({ limit: '1mb' }));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir, { maxAge: '7d', setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin') }));

// ---------- File upload ----------
const BLOCKED_EXT = new Set(['.html', '.htm', '.svg', '.js', '.mjs', '.exe', '.bat', '.cmd', '.sh', '.php', '.jar']);
const ALLOWED_MIME = /^(image\/(jpeg|png|gif|webp)|video\/|audio\/|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.[a-z.]+|vnd\.ms-(excel|powerpoint)|zip)|text\/plain)/i;
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXT.has(ext) || !ALLOWED_MIME.test(file.mimetype)) return cb(new Error('This file type is not allowed'));
    cb(null, true);
  },
});

app.post('/api/upload', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  // req.protocol respects X-Forwarded-Proto (the old code hard-coded https, breaking localhost)
  res.json({ url: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`, path: `/uploads/${req.file.filename}`, mimetype: req.file.mimetype, filename: req.file.originalname, size: req.file.size });
});

// ---------- Routes ----------
app.get('/', (req, res) => res.json({ name: 'NTS API', status: 'ok' }));
app.get('/api/health', asyncHandler(async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok', time: new Date().toISOString() });
}));

app.use('/api/settings', require('./routes/settings'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/trades', require('./routes/trades'));
app.use('/api/community', require('./routes/community'));
app.use('/api/learning', require('./routes/learning'));
app.use('/api/learning', require('./routes/learning-plus')); // V6
app.use('/api/v6', require('./routes/v6')); // V6 campus tools
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/parents', require('./routes/parents'));
app.use('/api/family', require('./routes/family'));
app.use('/api/school', require('./routes/school'));
app.use('/api/school', require('./routes/sessions'));
app.use('/api/support', require('./routes/support'));
app.use('/api/library', require('./routes/library')); // V6.2
app.use('/api/bank', require('./routes/bank')); // V6.2
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/talent', require('./routes/talent'));
app.use('/api/dashboard', require('./routes/overview')); // /overview, /leaderboard (the old /stats stays below)
app.use('/api', require('./routes/resources'));
app.use('/api/guest-ai', require('./routes/guest-ai'));
app.use('/api', require('./routes/internships')); // /internships, /my-applications, /applications/:id

app.get('/api/dashboard/stats', authenticate, asyncHandler(async (req, res) => {
  const me = req.user.id;
  const isAdmin = req.user.role === 'ADMIN';
  const [students, trainers, posts, internships, applications, meRow, coursesEnrolled] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.user.count({ where: { role: 'TRAINER' } }),
    prisma.post.count({ where: { isDeleted: false } }),
    prisma.internship.count({ where: { isActive: true } }),
    prisma.internshipApplication.count({ where: isAdmin ? {} : { studentId: me } }),
    prisma.user.findUnique({ where: { id: me }, select: { followersCount: true, followingCount: true } }),
    prisma.courseEnrollment.count({ where: { userId: me } }),
  ]);
  res.json({
    students, trainers, posts, internships, applications,
    coursesEnrolled,
    followers: meRow?.followersCount || 0,
    following: meRow?.followingCount || 0,
  });
}));

app.use('/api', (req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` }));

// Central error handler: no more crashes / hanging requests on unexpected errors
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 100MB)' : err.message });
  }
  if (err.message === 'This file type is not allowed' || err.message?.includes('learning file type is not allowed') || err.message?.startsWith('Only images')) return res.status(400).json({ error: err.message });
  if (err.message?.startsWith('Origin ')) return res.status(403).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
  console.error(`❌ ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ error: isProd ? 'Internal server error' : err.message });
});

// ---------- Socket.IO ----------
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token'));
  try {
    socket.userId = jwt.verify(token, JWT_SECRET).id;
    next();
  } catch (e) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const uid = socket.userId;
  socket.join(`user:${uid}`);
  const count = (realtime.onlineCounts.get(uid) || 0) + 1;
  realtime.onlineCounts.set(uid, count);
  if (count === 1) socket.broadcast.emit('user:online', { userId: uid });
  // Tell the newcomer who is already online
  for (const [id] of realtime.onlineCounts) if (id !== uid) socket.emit('user:online', { userId: id });

  // Messages, reads, reactions and edits are created through the REST API, which
  // already pushes socket events. Re-relaying client "message:send" events here
  // used to deliver every message twice.
  const relayTyping = (event) => ({ receiverId, chatId } = {}) => {
    if (receiverId) io.to(`user:${receiverId}`).emit(event, { userId: uid, chatId });
  };
  socket.on('typing:start', relayTyping('typing:start'));
  socket.on('typing:stop', relayTyping('typing:stop'));

  socket.on('disconnect', () => {
    const left = (realtime.onlineCounts.get(uid) || 1) - 1;
    if (left <= 0) {
      realtime.onlineCounts.delete(uid);
      socket.broadcast.emit('user:offline', { userId: uid });
    } else {
      realtime.onlineCounts.set(uid, left);
    }
  });
});

// ---------- Startup ----------
async function ensureAdmin() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!existing) {
    await prisma.user.create({
      data: { email: ADMIN_EMAIL, fullName: 'Admin', passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10), role: 'ADMIN', isVerified: true },
    });
    console.log(`✅ Admin created (${ADMIN_EMAIL})`);
    if (!process.env.ADMIN_PASSWORD) console.warn('⚠️  Using the default admin password. Set ADMIN_PASSWORD and change it after first login.');
    return;
  }
  // Keep the admin account in sync with .env. Previously an admin row created with an
  // older email/password (or a normal STUDENT account with the same email) meant that
  // the credentials in .env never worked and login always answered "Invalid credentials".
  const passwordOk = await bcrypt.compare(ADMIN_PASSWORD, existing.passwordHash);
  const patch = {};
  if (!passwordOk && process.env.ADMIN_PASSWORD) patch.passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  if (existing.role !== 'ADMIN') patch.role = 'ADMIN';
  if (!existing.isVerified) patch.isVerified = true;
  if (!existing.isActive || existing.status !== 'ACTIVE' || existing.deletedAt) { patch.isActive = true; patch.status = 'ACTIVE'; patch.deletedAt = null; }
  if (Object.keys(patch).length) {
    await prisma.user.update({ where: { id: existing.id }, data: patch });
    console.log(`✅ Admin account synced with .env (${ADMIN_EMAIL})`);
  }
}

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
// Don't block the port on DB setup: Render health checks need the server up quickly
Promise.resolve()
  .then(ensureAdmin)
  .then(seedDefaultTrades)
  .then(() => (process.env.SEED_DEMO_DATA === 'false' ? null : seedDemoData()))
  .then(() => (process.env.SEED_DEMO_DATA === 'false' ? null : seedDemoDataV53()))
  .then(() => (process.env.SEED_DEMO_DATA === 'false' ? null : seedDemoDataV54()))
  .then(() => (process.env.SEED_DEMO_DATA === 'false' ? null : seedDemoDataV55()))
  .then(() => (process.env.SEED_DEMO_DATA === 'false' ? null : seedDemoDataV62()))
  .catch((err) => console.error('❌ Startup tasks failed (is DATABASE_URL correct and the schema pushed?):', err.message));
