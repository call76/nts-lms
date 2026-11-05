const express = require('express');
const prisma = require('../lib/prisma');
const { asyncHandler, str } = require('../lib/http');
const { authenticate } = require('../lib/auth');
const { emitToUsers, isOnline } = require('../lib/realtime');

const router = express.Router();
router.use(authenticate);

const userCard = { id: true, fullName: true, avatar: true, role: true };
const participantInclude = { include: { user: { select: userCard } } };
const senderInclude = { select: { id: true, fullName: true, avatar: true } };
const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '😡', '🎉', '🔥'];

// Load a chat only if the current user belongs to it
async function getMemberChat(chatId, userId) {
  if (!chatId) return null;
  return prisma.chat.findFirst({
    where: { id: chatId, participants: { some: { userId } } },
    include: { participants: participantInclude },
  });
}
const otherIds = (chat, me) => chat.participants.map((p) => p.userId).filter((id) => id !== me);

// ---------- Chat list ----------
router.get('/', asyncHandler(async (req, res) => {
  const chats = await prisma.chat.findMany({
    where: { participants: { some: { userId: req.user.id } } },
    include: {
      participants: participantInclude,
      messages: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  // Real unread totals (the last-message preview alone can only ever show 0 or 1)
  const unread = await prisma.message.groupBy({
    by: ['chatId'],
    where: { chatId: { in: chats.map((c) => c.id) }, senderId: { not: req.user.id }, isRead: false, isDeleted: false },
    _count: { _all: true },
  });
  const unreadMap = new Map(unread.map((u) => [u.chatId, u._count._all]));
  const out = chats
    .map((c) => ({ ...c, unreadCount: unreadMap.get(c.id) || 0 }))
    .sort((a, b) => new Date(b.messages[0]?.createdAt || b.createdAt) - new Date(a.messages[0]?.createdAt || a.createdAt));
  res.json(out);
}));

router.get('/search', asyncHandler(async (req, res) => {
  const q = str(req.query.q, 60);
  if (q.length < 2) return res.json([]);
  const users = await prisma.user.findMany({
    where: { id: { not: req.user.id }, isVerified: true, fullName: { contains: q } },
    select: userCard,
    take: 20,
  });
  res.json(users);
}));

// ---------- Create chats ----------
router.post('/private/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (userId === req.user.id) return res.status(400).json({ error: 'You cannot chat with yourself' });
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) return res.status(404).json({ error: 'User not found' });

  let chat = await prisma.chat.findFirst({
    where: {
      isGroup: false,
      AND: [{ participants: { some: { userId: req.user.id } } }, { participants: { some: { userId } } }],
    },
    include: { participants: participantInclude },
  });
  if (!chat) {
    chat = await prisma.chat.create({
      data: { isGroup: false, participants: { create: [{ userId: req.user.id }, { userId }] } },
      include: { participants: participantInclude },
    });
  }
  res.json(chat);
}));

router.post('/group', asyncHandler(async (req, res) => {
  const name = str(req.body.name, 80);
  const members = Array.isArray(req.body.members) ? [...new Set(req.body.members.filter((m) => typeof m === 'string'))] : [];
  if (!name) return res.status(400).json({ error: 'Group name is required' });
  const valid = await prisma.user.findMany({ where: { id: { in: members.filter((m) => m !== req.user.id) } }, select: { id: true } });
  if (valid.length === 0) return res.status(400).json({ error: 'Add at least one member' });
  const chat = await prisma.chat.create({
    data: {
      name,
      isGroup: true,
      participants: { create: [{ userId: req.user.id }, ...valid.map((u) => ({ userId: u.id }))] },
    },
    include: { participants: participantInclude },
  });
  emitToUsers(otherIds(chat, req.user.id), 'chat:created', chat);
  res.status(201).json(chat);
}));

// ---------- Messages ----------
router.post('/messages', asyncHandler(async (req, res) => {
  const content = str(req.body.content, 5000);
  const fileUrl = str(req.body.fileUrl, 500) || null;
  if (!content && !fileUrl) return res.status(400).json({ error: 'Message cannot be empty' });

  let chat = null;
  if (req.body.chatId) {
    chat = await getMemberChat(req.body.chatId, req.user.id);
    if (!chat) return res.status(403).json({ error: 'You are not part of this chat' });
  } else if (req.body.receiverId) {
    // Convenience: send straight to a user, creating the private chat if needed
    const target = await prisma.user.findUnique({ where: { id: String(req.body.receiverId) }, select: { id: true } });
    if (!target || target.id === req.user.id) return res.status(400).json({ error: 'Invalid receiver' });
    chat = await prisma.chat.findFirst({
      where: { isGroup: false, AND: [{ participants: { some: { userId: req.user.id } } }, { participants: { some: { userId: target.id } } }] },
      include: { participants: participantInclude },
    });
    if (!chat) {
      chat = await prisma.chat.create({
        data: { isGroup: false, participants: { create: [{ userId: req.user.id }, { userId: target.id }] } },
        include: { participants: participantInclude },
      });
    }
  } else {
    return res.status(400).json({ error: 'chatId is required' });
  }

  const recipients = otherIds(chat, req.user.id);
  // For 1:1 chats derive the receiver from the chat, never from the client
  const receiverId = chat.isGroup ? null : recipients[0] || null;

  let replyToId = null;
  if (req.body.replyToId) {
    const parent = await prisma.message.findFirst({ where: { id: String(req.body.replyToId), chatId: chat.id }, select: { id: true } });
    replyToId = parent?.id || null;
  }

  const message = await prisma.message.create({
    data: {
      content,
      senderId: req.user.id,
      receiverId,
      chatId: chat.id,
      fileUrl,
      fileType: str(req.body.fileType, 100) || null,
      fileName: str(req.body.fileName, 255) || null,
      replyToId,
      isRead: false,
      deliveredAt: receiverId && isOnline(receiverId) ? new Date() : null,
    },
    include: { sender: senderInclude },
  });
  emitToUsers(recipients, 'message:received', message);
  res.status(201).json(message);
}));

router.get('/:chatId/messages', asyncHandler(async (req, res) => {
  const chat = await getMemberChat(req.params.chatId, req.user.id);
  if (!chat) return res.status(403).json({ error: 'You are not part of this chat' });
  // Latest 300, returned oldest-first
  const rows = await prisma.message.findMany({
    where: { chatId: chat.id, isDeleted: false },
    include: { sender: senderInclude },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json({ messages: rows.reverse() });
}));

async function getMessageForMember(messageId, userId) {
  const msg = await prisma.message.findFirst({ where: { id: messageId, isDeleted: false } });
  if (!msg) return {};
  const chat = await getMemberChat(msg.chatId, userId);
  return chat ? { msg, chat } : {};
}

const markRead = asyncHandler(async (req, res) => {
  const { msg, chat } = await getMessageForMember(req.params.messageId, req.user.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  if (msg.senderId === req.user.id || msg.isRead) return res.json({ success: true });
  await prisma.message.update({ where: { id: msg.id }, data: { isRead: true, readAt: new Date() } });
  emitToUsers([msg.senderId], 'message:read', { messageId: msg.id, chatId: chat.id });
  res.json({ success: true });
});
router.post('/messages/:messageId/read', markRead);
router.put('/messages/:messageId/read', markRead); // kept for backward compatibility

router.post('/messages/:messageId/react', asyncHandler(async (req, res) => {
  const { msg, chat } = await getMessageForMember(req.params.messageId, req.user.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  if (!REACTIONS.includes(req.body.reaction)) return res.status(400).json({ error: 'Invalid reaction' });
  const reaction = msg.reaction === req.body.reaction ? null : req.body.reaction;
  await prisma.message.update({ where: { id: msg.id }, data: { reaction } });
  emitToUsers(otherIds(chat, req.user.id), 'message:reacted', { messageId: msg.id, reaction, chatId: chat.id });
  res.json({ messageId: msg.id, reaction });
}));

router.put('/messages/:messageId', asyncHandler(async (req, res) => {
  const content = str(req.body.content, 5000);
  if (!content) return res.status(400).json({ error: 'Message cannot be empty' });
  const { msg, chat } = await getMessageForMember(req.params.messageId, req.user.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  if (msg.senderId !== req.user.id) return res.status(403).json({ error: 'You can only edit your own messages' });
  const updated = await prisma.message.update({
    where: { id: msg.id },
    data: { content, isEdited: true, editedAt: new Date() },
    include: { sender: senderInclude },
  });
  emitToUsers(otherIds(chat, req.user.id), 'message:updated', updated);
  res.json(updated);
}));

router.delete('/messages/:messageId', asyncHandler(async (req, res) => {
  const { msg, chat } = await getMessageForMember(req.params.messageId, req.user.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  if (msg.senderId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Not allowed' });
  await prisma.message.update({ where: { id: msg.id }, data: { isDeleted: true, deletedBy: req.user.id } });
  emitToUsers(otherIds(chat, req.user.id), 'message:deleted', { messageId: msg.id, chatId: chat.id });
  res.json({ success: true });
}));

module.exports = router;
