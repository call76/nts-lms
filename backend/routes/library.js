// V6.2 School library: books, notes, past papers, videos. Everything is UPLOADED from the device
// (no pasted links). Main files live in private_uploads/library and are only served to logged-in
// users through GET /:id/file; cover images live in /uploads so <img> tags can show them.
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const prisma = require('../lib/prisma');
const { asyncHandler, str } = require('../lib/http');
const { authenticate } = require('../lib/auth');

const router = express.Router();
router.use(authenticate);

const publicDir = path.join(__dirname, '..', 'uploads');
const privateDir = path.join(__dirname, '..', 'private_uploads', 'library');
fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(privateDir, { recursive: true });

const FILE_EXT = new Set(['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.epub', '.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm', '.mov', '.mp3', '.wav', '.m4a', '.zip']);
const COVER_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MIME = {
  '.pdf': 'application/pdf', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain', '.epub': 'application/epub+zip', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.zip': 'application/zip',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, file.fieldname === 'cover' ? publicDir : privateDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(10).toString('hex')}${path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '')}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const ok = file.fieldname === 'cover' ? COVER_EXT.has(ext) : file.fieldname === 'file' && FILE_EXT.has(ext);
    cb(ok ? null : new Error(file.fieldname === 'cover' ? 'The cover must be a JPG, PNG or WEBP image' : 'This file type is not allowed in the library'), ok);
  },
});

const staff = (req, res, next) => (['ADMIN', 'TRAINER'].includes(req.user.role) ? next() : res.status(403).json({ error: 'Only trainers and admin can add library files' }));
const unlink = (p) => { try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch (e) { /* ignore */ } };
const diskPath = (fileUrl) => path.join(privateDir, path.basename(String(fileUrl || '')));
const coverPath = (coverUrl) => (coverUrl && /^\/uploads\//.test(coverUrl) ? path.join(publicDir, path.basename(coverUrl)) : null);
const isStaff = (u) => ['ADMIN', 'TRAINER'].includes(u.role);

const view = (r) => ({
  id: r.id, title: r.title, author: r.author, category: r.category, description: r.description,
  fileName: r.fileName, fileType: r.fileType, sizeBytes: r.sizeBytes, coverUrl: r.coverUrl,
  uploaderId: r.uploaderId, uploaderName: r.uploaderName, downloads: r.downloads, published: r.published, createdAt: r.createdAt,
});

router.get('/', asyncHandler(async (req, res) => {
  const q = str(req.query.q, 100);
  const category = str(req.query.category, 60);
  const where = {};
  if (!isStaff(req.user)) where.published = true;
  if (category && category !== 'All') where.category = category;
  if (q) where.OR = [{ title: { contains: q } }, { author: { contains: q } }, { description: { contains: q } }];
  const [rows, cats] = await Promise.all([
    prisma.libraryItem.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300 }),
    prisma.libraryItem.groupBy({ by: ['category'], _count: { _all: true }, where: isStaff(req.user) ? {} : { published: true } }),
  ]);
  res.json({
    items: rows.map(view),
    categories: cats.map((c) => ({ name: c.category, count: c._count._all })).sort((a, b) => a.name.localeCompare(b.name)),
    canManage: isStaff(req.user),
  });
}));

router.post('/', staff, upload.fields([{ name: 'file', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), asyncHandler(async (req, res) => {
  const file = req.files?.file?.[0];
  const cover = req.files?.cover?.[0];
  const cleanup = () => { unlink(file?.path); unlink(cover?.path); };
  if (!file) { cleanup(); return res.status(400).json({ error: 'Choose a file from your device to upload' }); }
  const title = str(req.body.title, 180) || file.originalname.replace(/\.[^.]+$/, '');
  const ext = path.extname(file.originalname).toLowerCase();
  const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { fullName: true } });
  const row = await prisma.libraryItem.create({
    data: {
      title,
      author: str(req.body.author, 120) || null,
      category: str(req.body.category, 60) || 'General',
      description: str(req.body.description, 2000) || null,
      fileUrl: path.basename(file.path),
      fileName: file.originalname.slice(0, 200),
      fileType: MIME[ext] || 'application/octet-stream',
      sizeBytes: file.size,
      coverUrl: cover ? `/uploads/${path.basename(cover.path)}` : null,
      uploaderId: req.user.id,
      uploaderName: me?.fullName || null,
      published: req.body.published !== 'false',
    },
  });
  res.status(201).json(view(row));
}));

router.put('/:id', staff, asyncHandler(async (req, res) => {
  const row = await prisma.libraryItem.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: 'Library item not found' });
  if (req.user.role !== 'ADMIN' && row.uploaderId !== req.user.id) return res.status(403).json({ error: 'You can only edit your own library files' });
  const data = {};
  if (req.body.title !== undefined) { data.title = str(req.body.title, 180); if (!data.title) return res.status(400).json({ error: 'Title is required' }); }
  if (req.body.author !== undefined) data.author = str(req.body.author, 120) || null;
  if (req.body.category !== undefined) data.category = str(req.body.category, 60) || 'General';
  if (req.body.description !== undefined) data.description = str(req.body.description, 2000) || null;
  if (req.body.published !== undefined) data.published = req.body.published === true || req.body.published === 'true';
  res.json(view(await prisma.libraryItem.update({ where: { id: row.id }, data })));
}));

router.delete('/:id', staff, asyncHandler(async (req, res) => {
  const row = await prisma.libraryItem.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: 'Library item not found' });
  if (req.user.role !== 'ADMIN' && row.uploaderId !== req.user.id) return res.status(403).json({ error: 'You can only delete your own library files' });
  await prisma.libraryItem.delete({ where: { id: row.id } });
  unlink(diskPath(row.fileUrl));
  unlink(coverPath(row.coverUrl));
  res.json({ success: true });
}));

// Authenticated download / preview. ?inline=1 opens it in the browser (PDF, image, video, audio).
router.get('/:id/file', asyncHandler(async (req, res) => {
  const row = await prisma.libraryItem.findUnique({ where: { id: req.params.id } });
  if (!row || (!row.published && !isStaff(req.user))) return res.status(404).json({ error: 'Library item not found' });
  const file = diskPath(row.fileUrl);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'The file is missing on the server. Ask the uploader to upload it again.' });
  const inline = req.query.inline === '1';
  if (!inline) prisma.libraryItem.update({ where: { id: row.id }, data: { downloads: { increment: 1 } } }).catch(() => {});
  res.setHeader('Content-Type', row.fileType || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(row.fileName)}`);
  fs.createReadStream(file).pipe(res);
}));

module.exports = router;
