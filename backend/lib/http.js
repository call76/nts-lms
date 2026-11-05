// Wrap async route handlers so a rejected promise becomes a 500 instead of crashing Node
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Tiny in-memory rate limiter (no extra dependency). Good enough for one instance.
function rateLimit({ windowMs = 60_000, max = 20, message = 'Too many requests, please try again later' } = {}) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs).unref();

  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) return res.status(429).json({ error: message });
    next();
  };
}

const str = (v, max = 5000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const normEmail = (v) => str(v, 254).toLowerCase();
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

module.exports = { asyncHandler, rateLimit, str, normEmail, isEmail };
