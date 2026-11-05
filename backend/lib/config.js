require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';

// In production a missing JWT secret is a hard error: the old "secret" fallback
// lets anyone forge admin tokens.
let JWT_SECRET = process.env.JWT_SECRET;
if (isProd && !process.env.ADMIN_PASSWORD) {
  console.error('FATAL: ADMIN_PASSWORD is not set. Configure a strong admin password before production startup.');
  process.exit(1);
}

if (!JWT_SECRET) {
  if (isProd) {
    console.error('FATAL: JWT_SECRET is not set. Refusing to start in production.');
    process.exit(1);
  }
  JWT_SECRET = 'dev-only-secret-change-me';
  console.warn('⚠️  JWT_SECRET not set - using an insecure development secret.');
}

const extraOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

const staticOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000', ...extraOrigins];
const originPatterns = [/^https:\/\/[a-z0-9-]+\.onrender\.com$/i, /^https:\/\/[a-z0-9-]+\.netlify\.app$/i, /^https:\/\/[a-z0-9-]+\.vercel\.app$/i]
// While developing, also accept the frontend opened through a LAN address (e.g. testing from a phone)
if (!isProd) originPatterns.push(/^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):\d+$/);

// Used by both Express CORS and Socket.IO
function corsOrigin(origin, cb) {
  if (!origin) return cb(null, true); // mobile apps, curl, same-origin
  const clean = origin.replace(/\/$/, '');
  if (staticOrigins.includes(clean) || originPatterns.some((re) => re.test(clean))) return cb(null, true);
  return cb(new Error(`Origin ${origin} not allowed by CORS`));
}

module.exports = {
  isProd,
  JWT_SECRET,
  PORT: process.env.PORT || 5000,
  corsOrigin,
  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || 'admin@nts.rw').toLowerCase(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'Admin123',
  // Trainer and admin privileges are assigned by an administrator after vetting.
  ALLOWED_SELF_ROLES: ['STUDENT', 'PARENT', 'EMPLOYER', 'GUEST'],
  ROLES: ['STUDENT', 'TRAINER', 'ADMIN', 'EMPLOYER', 'PARENT', 'GUEST'],
  ACCOUNT_STATUSES: ['ACTIVE', 'INACTIVE', 'DELETED'],
};
