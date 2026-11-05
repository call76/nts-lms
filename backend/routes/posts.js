const express = require('express');
const prisma = require('../lib/prisma');
const { asyncHandler, str } = require('../lib/http');
const { authenticate } = require('../lib/auth');
const { emitToAllExcept } = require('../lib/realtime');

const router = express.Router();
router.use(authenticate);

const authorSelect = { id: true, fullName: true, avatar: true, role: true, isVerified: true };
const commentInclude = { author: { select: { id: true, fullName: true, avatar: true, role: true } } };
const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '😡', '🎉', '🔥'];

const postInclude = {
  author: { select: authorSelect },
  _count: { select: { likes: true, comments: { where: { isDeleted: false } } } },
};

// Decorate raw posts with like/reaction/share counts using a handful of batched
// queries (the old code ran 2 queries per post).
async function decoratePosts(posts, userId) {
  if (!posts.length) return [];
  const ids = posts.map((p) => p.id);
  const [myLikes, myReactions, allReactions, mySaves, shares] = await Promise.all([
    prisma.like.findMany({ where: { userId, postId: { in: ids } }, select: { postId: true } }),
    prisma.postReaction.findMany({ where: { userId, postId: { in: ids } }, select: { postId: true, reaction: true } }),
    prisma.postReaction.groupBy({ by: ['postId', 'reaction'], where: { postId: { in: ids } }, _count: { _all: true } }),
    prisma.savedPost.findMany({ where: { userId, postId: { in: ids } }, select: { postId: true } }),
    prisma.post.groupBy({ by: ['originalPostId'], where: { originalPostId: { in: ids }, isDeleted: false }, _count: { _all: true } }),
  ]);
  const liked = new Set(myLikes.map((l) => l.postId));
  const saved = new Set(mySaves.map((s) => s.postId));
  const mine = new Map(myReactions.map((r) => [r.postId, r.reaction]));
  const shareMap = new Map(shares.map((s) => [s.originalPostId, s._count._all]));
  const reactionMap = new Map();
  for (const r of allReactions) {
    if (!reactionMap.has(r.postId)) reactionMap.set(r.postId, {});
    reactionMap.get(r.postId)[r.reaction] = r._count._all;
  }

  return posts.map((p) => {
    const { _count, imageUrl, ...rest } = p;
    const mediaUrl = p.mediaUrl || imageUrl || null;
    return {
      ...rest,
      mediaUrl,
      mediaType: mediaUrl ? p.mediaType || 'image' : null,
      likesCount: _count?.likes ?? 0,
      commentsCount: _count?.comments ?? 0,
      sharesCount: shareMap.get(p.id) || 0,
      isLiked: liked.has(p.id),
      isSaved: saved.has(p.id),
      userReaction: mine.get(p.id) || null,
      reactions: reactionMap.get(p.id) || {},
    };
  });
}

async function loadOne(postId, userId) {
  const post = await prisma.post.findFirst({ where: { id: postId, isDeleted: false }, include: postInclude });
  if (!post) return null;
  return (await decoratePosts([post], userId))[0];
}

const canModify = (user, ownerId) => user.id === ownerId || user.role === 'ADMIN';

// ---------- Feed ----------
router.get('/feed', asyncHandler(async (req, res) => {
  const where = { isDeleted: false };
  if (req.query.before) {
    const d = new Date(req.query.before);
    if (!isNaN(d)) where.createdAt = { lt: d };
  }
  const posts = await prisma.post.findMany({ where, include: postInclude, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json(await decoratePosts(posts, req.user.id));
}));

router.get('/saved', asyncHandler(async (req, res) => {
  const saved = await prisma.savedPost.findMany({
    where: { userId: req.user.id, post: { isDeleted: false } },
    include: { post: { include: postInclude } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(await decoratePosts(saved.map((s) => s.post), req.user.id));
}));

router.get('/user/:userId', asyncHandler(async (req, res) => {
  const posts = await prisma.post.findMany({
    where: { authorId: req.params.userId, isDeleted: false },
    include: postInclude,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(await decoratePosts(posts, req.user.id));
}));

// ---------- Create / edit / delete ----------
router.post('/', asyncHandler(async (req, res) => {
  const content = str(req.body.content, 5000);
  // The frontend sends mediaUrl/mediaType; older clients sent imageUrl
  const mediaUrl = str(req.body.mediaUrl || req.body.imageUrl, 500) || null;
  const mediaType = mediaUrl ? (['image', 'video'].includes(req.body.mediaType) ? req.body.mediaType : 'image') : null;
  if (!content && !mediaUrl) return res.status(400).json({ error: 'Post cannot be empty' });

  const [post] = await prisma.$transaction([
    prisma.post.create({ data: { content, mediaUrl, mediaType, authorId: req.user.id }, include: postInclude }),
    prisma.user.update({ where: { id: req.user.id }, data: { postsCount: { increment: 1 } } }),
  ]);
  const out = (await decoratePosts([post], req.user.id))[0];
  emitToAllExcept(req.user.id, 'post:created', { ...out, isLiked: false, userReaction: null });
  res.status(201).json(out);
}));

router.put('/:postId', asyncHandler(async (req, res) => {
  const content = str(req.body.content, 5000);
  if (!content) return res.status(400).json({ error: 'Content cannot be empty' });
  const post = await prisma.post.findFirst({ where: { id: req.params.postId, isDeleted: false } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (!canModify(req.user, post.authorId)) return res.status(403).json({ error: 'Not allowed' });
  await prisma.post.update({ where: { id: post.id }, data: { content } });
  const out = await loadOne(post.id, req.user.id);
  emitToAllExcept(req.user.id, 'post:edited', { ...out, isLiked: false, userReaction: null });
  res.json(out);
}));

router.delete('/:postId', asyncHandler(async (req, res) => {
  const post = await prisma.post.findFirst({ where: { id: req.params.postId, isDeleted: false } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (!canModify(req.user, post.authorId)) return res.status(403).json({ error: 'Not allowed' });
  await prisma.$transaction([
    prisma.post.update({ where: { id: post.id }, data: { isDeleted: true, deletedAt: new Date() } }),
    prisma.user.update({ where: { id: post.authorId }, data: { postsCount: { decrement: 1 } } }),
  ]);
  emitToAllExcept(req.user.id, 'post:deleted', post.id);
  res.json({ success: true });
}));

// ---------- Likes / reactions / save / share / report ----------
router.post('/:postId/like', asyncHandler(async (req, res) => {
  const post = await prisma.post.findFirst({ where: { id: req.params.postId, isDeleted: false }, select: { id: true } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const key = { userId_postId: { userId: req.user.id, postId: post.id } };
  const existing = await prisma.like.findUnique({ where: key });
  if (existing) await prisma.like.delete({ where: key });
  else await prisma.like.create({ data: { userId: req.user.id, postId: post.id } });
  const likesCount = await prisma.like.count({ where: { postId: post.id } });
  await prisma.post.update({ where: { id: post.id }, data: { likesCount } });
  res.json({ liked: !existing, likesCount });
}));

router.post('/:postId/react', asyncHandler(async (req, res) => {
  const { reaction } = req.body;
  if (!REACTIONS.includes(reaction)) return res.status(400).json({ error: 'Invalid reaction' });
  const post = await prisma.post.findFirst({ where: { id: req.params.postId, isDeleted: false }, select: { id: true } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const key = { userId_postId: { userId: req.user.id, postId: post.id } };
  const existing = await prisma.postReaction.findUnique({ where: key });
  let current = reaction;
  if (existing && existing.reaction === reaction) {
    await prisma.postReaction.delete({ where: key }); // same emoji again = remove
    current = null;
  } else {
    await prisma.postReaction.upsert({ where: key, update: { reaction }, create: { userId: req.user.id, postId: post.id, reaction } });
  }
  const grouped = await prisma.postReaction.groupBy({ by: ['reaction'], where: { postId: post.id }, _count: { _all: true } });
  const reactions = Object.fromEntries(grouped.map((g) => [g.reaction, g._count._all]));
  res.json({ reaction: current, reactions });
}));

router.post('/:postId/save', asyncHandler(async (req, res) => {
  const post = await prisma.post.findFirst({ where: { id: req.params.postId, isDeleted: false }, select: { id: true } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const key = { userId_postId: { userId: req.user.id, postId: post.id } };
  const existing = await prisma.savedPost.findUnique({ where: key });
  if (existing) await prisma.savedPost.delete({ where: key });
  else await prisma.savedPost.create({ data: { userId: req.user.id, postId: post.id } });
  res.json({ saved: !existing });
}));

router.post('/:postId/share', asyncHandler(async (req, res) => {
  const original = await prisma.post.findFirst({ where: { id: req.params.postId, isDeleted: false } });
  if (!original) return res.status(404).json({ error: 'Post not found' });
  // Sharing a share points at the real original
  const originalId = original.originalPostId || original.id;
  const [shared] = await prisma.$transaction([
    prisma.post.create({
      data: {
        content: original.content,
        mediaUrl: original.mediaUrl || original.imageUrl,
        mediaType: original.mediaType,
        authorId: req.user.id,
        isShared: true,
        originalPostId: originalId,
      },
      include: postInclude,
    }),
    prisma.user.update({ where: { id: req.user.id }, data: { postsCount: { increment: 1 } } }),
  ]);
  await prisma.post.update({ where: { id: originalId }, data: { sharesCount: { increment: 1 } } });
  const out = (await decoratePosts([shared], req.user.id))[0];
  emitToAllExcept(req.user.id, 'post:created', { ...out, isLiked: false, userReaction: null });
  res.status(201).json(out);
}));

router.post('/:postId/report', asyncHandler(async (req, res) => {
  const post = await prisma.post.findFirst({ where: { id: req.params.postId, isDeleted: false }, select: { id: true } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  await prisma.report.upsert({
    where: { postId_reporterId: { postId: post.id, reporterId: req.user.id } },
    update: {},
    create: { postId: post.id, reporterId: req.user.id, reason: str(req.body.reason, 300) || null },
  });
  res.json({ success: true });
}));

// ---------- Comments ----------
router.get('/:postId/comments', asyncHandler(async (req, res) => {
  const comments = await prisma.comment.findMany({
    where: { postId: req.params.postId, isDeleted: false },
    include: commentInclude,
    orderBy: { createdAt: 'asc' },
  });
  res.json(comments);
}));

router.post('/:postId/comments', asyncHandler(async (req, res) => {
  const content = str(req.body.content, 2000);
  if (!content) return res.status(400).json({ error: 'Comment cannot be empty' });
  const post = await prisma.post.findFirst({ where: { id: req.params.postId, isDeleted: false }, select: { id: true } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const comment = await prisma.comment.create({
    data: { content, postId: post.id, authorId: req.user.id },
    include: commentInclude,
  });
  await prisma.post.update({ where: { id: post.id }, data: { commentsCount: { increment: 1 } } });
  emitToAllExcept(req.user.id, 'comment:added', { postId: post.id, comment });
  res.status(201).json(comment);
}));

router.put('/:postId/comments/:commentId', asyncHandler(async (req, res) => {
  const content = str(req.body.content, 2000);
  if (!content) return res.status(400).json({ error: 'Comment cannot be empty' });
  const c = await prisma.comment.findFirst({ where: { id: req.params.commentId, postId: req.params.postId, isDeleted: false } });
  if (!c) return res.status(404).json({ error: 'Comment not found' });
  if (!canModify(req.user, c.authorId)) return res.status(403).json({ error: 'Not allowed' });
  const comment = await prisma.comment.update({
    where: { id: c.id },
    data: { content, isEdited: true, editedAt: new Date() },
    include: commentInclude,
  });
  emitToAllExcept(req.user.id, 'comment:edited', { postId: c.postId, comment });
  res.json(comment);
}));

router.delete('/:postId/comments/:commentId', asyncHandler(async (req, res) => {
  const c = await prisma.comment.findFirst({ where: { id: req.params.commentId, postId: req.params.postId, isDeleted: false } });
  if (!c) return res.status(404).json({ error: 'Comment not found' });
  if (!canModify(req.user, c.authorId)) return res.status(403).json({ error: 'Not allowed' });
  await prisma.comment.update({ where: { id: c.id }, data: { isDeleted: true, deletedAt: new Date() } });
  await prisma.post.update({ where: { id: c.postId }, data: { commentsCount: { decrement: 1 } } });
  emitToAllExcept(req.user.id, 'comment:deleted', { postId: c.postId, commentId: c.id });
  res.json({ success: true });
}));

module.exports = router;
