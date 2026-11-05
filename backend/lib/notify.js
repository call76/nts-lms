const prisma = require('./prisma');
const { emitToUsers } = require('./realtime');

// Create in-app notifications (and push them live over Socket.IO). Never throws:
// a notification problem must not break the action that triggered it.
async function notifyUsers(userIds, { type = 'INFO', title, body = null, link = null }) {
  try {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (!ids.length || !title) return 0;
    const rows = ids.map((userId) => ({ userId, type, title: String(title).slice(0, 150), body: body ? String(body).slice(0, 500) : null, link }));
    for (let i = 0; i < rows.length; i += 1000) await prisma.notification.createMany({ data: rows.slice(i, i + 1000) });
    emitToUsers(ids, 'notification:new', { type, title, body, link });
    return ids.length;
  } catch (e) {
    console.warn('notify skipped:', e.message);
    return 0;
  }
}

module.exports = { notifyUsers };
