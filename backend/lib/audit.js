const prisma = require('./prisma');

// Fire-and-forget: an audit-log failure must never break the admin action itself
function logAdmin(actorId, action, targetId = null, details = null) {
  const text = details && typeof details !== 'string' ? JSON.stringify(details) : details;
  return prisma.adminAuditLog
    .create({ data: { actorId, action, targetId, details: text ? text.slice(0, 2000) : null } })
    .catch((e) => console.warn('audit log skipped:', e.message));
}

module.exports = { logAdmin };
