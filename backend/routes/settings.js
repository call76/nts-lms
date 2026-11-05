const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const prisma = require('../lib/prisma');
const { asyncHandler } = require('../lib/http');
const { authenticate, requireAdmin } = require('../lib/auth');
const defaults = require('../lib/siteDefaults.json');

const router = express.Router();
const KEY = 'site';
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Item shapes for list fields (their defaults can be empty, e.g. videos)
const ITEM_SHAPES = {
  authSlides: { image: '', title: '', subtitle: '' },
  gallery: '',
  promoSlides: { image: '', tag: '', title: '', text: '', to: '', cta: '', active: true },
  videos: { title: '', url: '', description: '' },
  items: { id: '', label: '', visible: true, roles: '' }, // menu overrides (order = order of the list)
  custom: { label: '', to: '', icon: '', roles: '', newTab: false }, // extra menu links added by the admin
  faqs: { q: '', a: '', roles: '' },
};
const MAX_ITEMS = 60;

const cleanString = (v, max = 2000) => {
  if (typeof v !== 'string') return '';
  const s = v.trim().slice(0, max);
  return /^\s*(javascript|data:text|vbscript):/i.test(s) ? '' : s;
};

// Keep only keys known in the defaults and coerce types, so the admin form can never
// store arbitrary data (or script URLs) in the settings row.
function sanitize(input, template) {
  if (typeof template === 'string') return cleanString(input);
  if (typeof template === 'boolean') return input === true || input === 'true';
  if (Array.isArray(template)) return template;
  const out = {};
  const src = input && typeof input === 'object' ? input : {};
  for (const key of Object.keys(template)) {
    const t = template[key];
    if (Array.isArray(t)) {
      const shape = ITEM_SHAPES[key];
      const list = Array.isArray(src[key]) ? src[key].slice(0, MAX_ITEMS) : t;
      out[key] = list.map((item) => sanitize(item, shape)).filter((item) => (typeof item === 'string' ? item : true));
    } else if (t && typeof t === 'object') {
      out[key] = sanitize(src[key], t);
    } else {
      out[key] = key in src ? sanitize(src[key], t) : t;
    }
  }
  return out;
}

function deepMerge(base, over) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return over === undefined ? base : over;
  const out = { ...base };
  if (over && typeof over === 'object') {
    for (const k of Object.keys(over)) out[k] = k in base ? deepMerge(base[k], over[k]) : over[k];
  }
  return out;
}

async function readStored() {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
    return row ? JSON.parse(row.value) : {};
  } catch (e) {
    console.warn('⚠️  Could not read site settings (run `npm run migrate`):', e.message);
    return {};
  }
}

// Public: the welcome page, logo and colours are needed before anyone logs in
router.get('/', asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(deepMerge(defaults, await readStored()));
}));

router.put('/', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const body = req.body && req.body.settings ? req.body.settings : req.body;
  const clean = sanitize(body, defaults);
  if (!/^#[0-9a-f]{6}$/i.test(clean.theme.primary)) clean.theme.primary = defaults.theme.primary;
  if (!/^#[0-9a-f]{6}$/i.test(clean.theme.accent)) clean.theme.accent = defaults.theme.accent;
  // V6.2 system builder: allow-lists for style choices, safe links, bounded custom CSS
  const pick = (v, list, fb) => (list.includes(v) ? v : fb);
  clean.system.font = pick(clean.system.font, ['system', 'serif', 'humanist', 'rounded', 'mono'], 'system');
  clean.system.radius = pick(clean.system.radius, ['sharp', 'soft', 'round'], 'round');
  clean.system.sidebar = pick(clean.system.sidebar, ['navy', 'brand', 'dark', 'light'], 'navy');
  const rawCss = typeof body?.system?.customCss === 'string' ? body.system.customCss : '';
  clean.system.customCss = rawCss.replace(/<\/?style[^>]*>/gi, '').replace(/@import[^;]*;?/gi, '').replace(/expression\s*\(|javascript:|behavior\s*:/gi, '').slice(0, 8000);
  const ROLES = ['ADMIN', 'TRAINER', 'STUDENT', 'PARENT', 'EMPLOYER', 'GUEST'];
  const cleanRoles = (v) => String(v || '').split(',').map((r) => r.trim().toUpperCase()).filter((r) => ROLES.includes(r)).join(',');
  clean.menu.items = clean.menu.items.filter((i) => /^[a-z0-9_-]{1,40}$/i.test(i.id)).map((i) => ({ ...i, label: i.label.slice(0, 40), roles: cleanRoles(i.roles) }));
  clean.menu.custom = clean.menu.custom
    .filter((i) => i.label && /^(\/|https?:\/\/)/i.test(i.to))
    .map((i) => ({ ...i, label: i.label.slice(0, 40), icon: i.icon.slice(0, 30), roles: cleanRoles(i.roles) }));
  clean.help.faqs = clean.help.faqs.filter((f) => f.q && f.a).map((f) => ({ ...f, roles: cleanRoles(f.roles) }));
  if (!prisma.siteSetting) return res.status(500).json({ error: 'Database is not updated yet. Stop the server, run "npm run migrate" and start again.' });
  await prisma.siteSetting.upsert({
    where: { key: KEY },
    update: { value: JSON.stringify(clean) },
    create: { key: KEY, value: JSON.stringify(clean) },
  });
  res.json(clean);
}));

router.post('/reset', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  if (prisma.siteSetting) await prisma.siteSetting.deleteMany({ where: { key: KEY } });
  res.json(defaults);
}));

// Guest-only AI feature flag. AI remains disabled until explicitly enabled by Admin.
router.get('/guest-ai', authenticate, requireAdmin, asyncHandler(async (_req, res) => {
  const row = await prisma.siteSetting.findUnique({ where: { key: 'guest_ai_enabled' } });
  res.json({ enabled: row?.value === 'true' });
}));
router.put('/guest-ai', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const enabled = req.body.enabled === true;
  await prisma.siteSetting.upsert({ where: { key: 'guest_ai_enabled' }, update: { value: String(enabled) }, create: { key: 'guest_ai_enabled', value: String(enabled) } });
  res.json({ enabled });
}));

// ---- Media (admin only) ----
const MEDIA_MIME = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|ogg|quicktime))$/i;
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(MEDIA_MIME.test(file.mimetype) ? null : new Error('Only images (JPG, PNG, WEBP, GIF) and videos (MP4, WEBM) are allowed'), MEDIA_MIME.test(file.mimetype)),
});

// Returns a relative path (/uploads/..) so it keeps working when the site moves to another domain
router.post('/upload', authenticate, requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received' });
  res.json({ path: `/uploads/${req.file.filename}`, mimetype: req.file.mimetype, name: req.file.originalname });
});

const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const VID_EXT = new Set(['.mp4', '.webm', '.ogg', '.mov']);
router.get('/media', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const files = fs.readdirSync(uploadDir)
    .map((name) => {
      const ext = path.extname(name).toLowerCase();
      const kind = IMG_EXT.has(ext) ? 'image' : VID_EXT.has(ext) ? 'video' : null;
      if (!kind) return null;
      const stat = fs.statSync(path.join(uploadDir, name));
      return { path: `/uploads/${name}`, kind, size: stat.size, time: stat.mtimeMs };
    })
    .filter(Boolean)
    .sort((a, b) => b.time - a.time)
    .slice(0, 300);
  res.json(files);
}));

module.exports = router;
