// "I am not a robot" check without any external service: the server hands out a small
// question plus a signed token; the answer is verified together with the token.
// Turn it off with HUMAN_CHECK=off in .env (e.g. for automated tests).
const crypto = require('crypto');
const SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'nts-dev-secret';
const TTL_MS = 10 * 60 * 1000;
const used = new Map(); // token -> expiry (one answer per token)

const sign = (payload) => crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
const enabled = () => String(process.env.HUMAN_CHECK || 'on').toLowerCase() !== 'off';

function makeChallenge() {
  const kind = crypto.randomInt(0, 3);
  const a = crypto.randomInt(2, 12); const b = crypto.randomInt(2, 10);
  let question; let answer;
  if (kind === 0) { question = `What is ${a} + ${b}?`; answer = a + b; }
  else if (kind === 1) { const big = a + b + 3; question = `What is ${big} − ${b}?`; answer = big - b; }
  else { const x = crypto.randomInt(2, 6); const y = crypto.randomInt(2, 6); question = `What is ${x} × ${y}?`; answer = x * y; }
  const exp = Date.now() + TTL_MS;
  const nonce = crypto.randomBytes(6).toString('hex');
  const body = `${answer}.${exp}.${nonce}`;
  // the token never contains the plain answer: it is hashed with the secret
  const token = `${exp}.${nonce}.${sign(body)}`;
  return { question, token };
}

function verify(token, answer) {
  if (!enabled()) return true;
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return false;
  const [exp, nonce, sig] = parts;
  if (!Number(exp) || Number(exp) < Date.now()) return false;
  if (used.has(token)) return false;
  const expected = sign(`${String(answer).trim()}.${exp}.${nonce}`);
  const ok = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (ok) {
    used.set(token, Number(exp));
    if (used.size > 5000) for (const [k, v] of used) if (v < Date.now()) used.delete(k);
  }
  return ok;
}

// express middleware: reads humanToken / humanAnswer from body or query
function requireHuman(req, res, next) {
  const src = { ...(req.query || {}), ...(req.body || {}) };
  if (verify(src.humanToken, src.humanAnswer)) return next();
  return res.status(400).json({ error: 'Please answer the “I am not a robot” question correctly.', code: 'HUMAN_CHECK' });
}

module.exports = { makeChallenge, verify, requireHuman, enabled };
