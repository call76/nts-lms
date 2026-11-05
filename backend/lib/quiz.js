// V6 quiz helpers: validation and bulk import (CSV / pasted text) of questions.
const { str } = require('./http');

const safeImage = (v) => { const s = str(v, 1500); return /^(https?:\/\/|\/uploads\/)/i.test(s) ? s : null; };

// Normalises a list of questions. Blank options are dropped and the correct answer is re-mapped.
function cleanQuestions(list) {
  if (!Array.isArray(list) || !list.length) return { error: 'Add at least one question' };
  if (list.length > 200) return { error: 'A quiz can hold at most 200 questions' };
  const out = [];
  for (let n = 0; n < list.length; n++) {
    const q = list[n] || {};
    const prompt = str(q.prompt, 1000);
    if (!prompt) return { error: `Question ${n + 1}: the question text is empty` };
    if (!Array.isArray(q.options)) return { error: `Question ${n + 1}: options are missing` };
    const answer = Number(q.answerIndex);
    const options = [];
    let newAnswer = -1;
    q.options.slice(0, 8).forEach((o, i) => {
      const t = str(o, 300);
      if (t) { if (i === answer) newAnswer = options.length; options.push(t); }
    });
    if (options.length < 2) return { error: `Question ${n + 1}: give at least two answer options` };
    if (newAnswer < 0) return { error: `Question ${n + 1}: choose the correct answer` };
    out.push({ prompt, options, answerIndex: newAnswer, points: Math.min(100, Math.max(1, Math.round(Number(q.points)) || 1)), explanation: str(q.explanation, 1000) || undefined, imageUrl: safeImage(q.imageUrl) || undefined });
  }
  return { questions: out };
}

// Minimal CSV reader: quotes, escaped quotes, comma / semicolon / tab separators.
function readRows(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const first = src.split(/\r?\n/).find((l) => l.trim()) || '';
  const counts = { ',': (first.match(/,/g) || []).length, ';': (first.match(/;/g) || []).length, '\t': (first.match(/\t/g) || []).length };
  const sep = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : ',';
  const rows = []; let row = [], cur = '', quoted = false, line = 1, rowLine = 1;
  const push = () => { row.push(cur); cur = ''; };
  const endRow = () => { push(); if (row.some((c) => c.trim())) rows.push({ cells: row.map((c) => c.trim()), line: rowLine }); row = []; };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') quoted = false; else { cur += c; if (c === '\n') line++; }
    } else if (c === '"' && !cur) quoted = true;
    else if (c === sep) push();
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; endRow(); line++; rowLine = line; }
    else cur += c;
  }
  if (cur || row.length) endRow();
  return rows;
}

// Columns: question, A, B, C, D (E, F optional), answer (A-F, 1-6 or the answer text), points, explanation
function parseQuestionText(text) {
  const rows = readRows(text);
  const errors = [], questions = [];
  rows.forEach((r, idx) => {
    const c = r.cells;
    if (idx === 0 && /^(question|prompt|ikibazo|q)$/i.test(c[0] || '')) return; // header row
    if (c.length < 4) { errors.push({ line: r.line, message: 'Need: question, at least two options and the answer' }); return; }
    // Standard layout: q, A, B, C, D, answer, points, explanation
    let options, answerRaw, points, explanation;
    if (c.length >= 6) { options = c.slice(1, 5); answerRaw = c[5]; points = c[6]; explanation = c[7]; }
    else { options = [c[1], c[2]]; answerRaw = c[3]; points = c[4]; explanation = c[5]; } // true/false style: q, A, B, answer
    let ans = -1; const a = String(answerRaw || '').trim();
    if (/^[A-Fa-f]$/.test(a)) ans = a.toUpperCase().charCodeAt(0) - 65;
    else if (/^[1-6]$/.test(a)) ans = Number(a) - 1;
    else ans = options.findIndex((o) => o && o.toLowerCase() === a.toLowerCase());
    questions.push({ prompt: c[0], options, answerIndex: ans, points: Number(points) || 1, explanation, _line: r.line });
  });
  const cleaned = [];
  questions.forEach((q) => {
    const r = cleanQuestions([q]);
    if (r.error) errors.push({ line: q._line, message: r.error.replace(/^Question 1: /, '') }); else cleaned.push(r.questions[0]);
  });
  return { questions: cleaned, errors };
}

module.exports = { cleanQuestions, parseQuestionText, safeImage };
