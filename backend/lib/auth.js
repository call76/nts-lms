const jwt = require('jsonwebtoken');
const prisma = require('./prisma');
const { JWT_SECRET } = require('./config');

const signToken = (user) =>
  jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

// Fields that are safe to send to the browser (never passwordHash)
const publicUser = (u) => ({
  isPro: Boolean(u.isPro),
  canEditInternships: Boolean(u.canEditInternships),
  canEditEvents: Boolean(u.canEditEvents),
  id: u.id,
  fullName: u.fullName,
  email: u.email,
  role: u.role,
  avatar: u.avatar,
  bio: u.bio,
  phone: u.phone,
  school: u.school,
  schoolType: u.schoolType,
  department: u.department,
  className: u.className,
  verificationStatus: u.verificationStatus,
  isVerified: u.isVerified,
  status: u.status,
  isActive: u.isActive,
  lastLoginAt: u.lastLoginAt,
  mustChangePassword: u.mustChangePassword,
  postsCount: u.postsCount,
  followersCount: u.followersCount,
  followingCount: u.followingCount,
  createdAt: u.createdAt,
});

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  try {
    // Re-read the user so deleted users / role changes take effect immediately
    const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { id: true, email: true, role: true, isActive: true, deletedAt: true } });
    if (!user || user.deletedAt) return res.status(401).json({ error: 'User no longer exists' });
    // Deactivation takes effect immediately, even for a token that is still valid
    if (!user.isActive) return res.status(401).json({ error: 'Your account is deactivated. Contact the administrator.', code: 'ACCOUNT_DISABLED' });
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
  next();
};

module.exports = { signToken, publicUser, authenticate, requireAdmin };
