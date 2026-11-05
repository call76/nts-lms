// Holds the Socket.IO instance so route files can emit events without circular imports
let io = null;
const onlineCounts = new Map(); // userId -> number of open sockets

module.exports = {
  setIO(instance) {
    io = instance;
  },
  getIO: () => io,
  emitToUser(userId, event, payload) {
    if (io && userId) io.to(`user:${userId}`).emit(event, payload);
  },
  emitToUsers(userIds, event, payload) {
    if (!io) return;
    [...new Set(userIds)].filter(Boolean).forEach((id) => io.to(`user:${id}`).emit(event, payload));
  },
  // Emit to everyone except one user (so authors don't get their own post twice)
  emitToAllExcept(userId, event, payload) {
    if (io) io.except(`user:${userId}`).emit(event, payload);
  },
  onlineCounts,
  isOnline: (id) => (onlineCounts.get(id) || 0) > 0,
};
