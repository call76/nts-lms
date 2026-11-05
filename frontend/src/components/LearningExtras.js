// V6 learning extras: question import, quiz settings, results, live progress, lesson discussion, module reviews.
import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { FaFileCsv, FaUpload, FaChartBar, FaCheckCircle, FaRegCircle, FaStar, FaRegStar, FaTrash, FaComments, FaAward, FaSyncAlt, FaDownload } from 'react-icons/fa';
import api from '../services/api';
import { asset } from '../services/assets';
import Modal from './Modal';
import { LessonVideo, SaveNoteButton } from './LearningParts';
import { btnPrimary, btnGhost, inputCls, cx } from './ui';

const TEMPLATE = 'question,A,B,C,D,answer,points,explanation\n"What does HTML stand for?",HyperText Markup Language,High Tech Modern Language,Home Tool Markup Language,None of these,A,1,"HTML is the standard markup language of web pages"\n"RAM is volatile memory",True,False,,,A,1,\n';

// download a protected CSV (needs the auth header, so a plain <a href> would not work)
export async function downloadCsv(url, fallbackName) {
  try {
    const r = await api.get(url, { responseType: 'blob' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = fallbackName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  } catch (e) { toast.error(e.response?.data?.error || 'Download failed'); }
}

/* ---------------- import questions from CSV / pasted text ---------------- */
export function QuizImporter({ onImport }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const readFile = async (f) => { if (!f) return; if (f.size > 500000) return toast.error('File too large (max 500 KB)'); setText(await f.text()); setResult(null); };
  const preview = async () => {
    setBusy(true);
    try { const r = await api.post('/learning/quizzes/parse', { text }); setResult(r.data); if (!r.data.questions.length) toast.error('No valid question found'); }
    catch (e) { toast.error(e.response?.data?.error || 'Could not read the questions'); }
    setBusy(false);
  };
  const add = () => { onImport(result.questions); toast.success(`${result.questions.length} question(s) added`); setText(''); setResult(null); setOpen(false); };
  const template = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + TEMPLATE], { type: 'text/csv' })); a.download = 'questions-template.csv'; a.click(); };

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-3 ml-2 inline-flex items-center gap-2 rounded-lg border border-violet-600 px-3 py-2 text-sm font-bold text-violet-700"><FaFileCsv /> Import many questions (CSV)</button>;
  return (
    <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900 dark:bg-violet-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-violet-800 dark:text-violet-200"><FaFileCsv className="mr-1 inline" /> Upload many questions at once</p>
        <button type="button" onClick={template} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"><FaDownload /> Download template</button>
      </div>
      <p className="mt-1 text-xs text-slate-500">Columns: question, A, B, C, D, answer (A–D), points, explanation. Save an Excel sheet as CSV, or paste the rows below.</p>
      <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => readFile(e.target.files?.[0])} className="mt-2 w-full text-sm" />
      <textarea rows={5} value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} placeholder="…or paste your questions here" className={cx(inputCls, 'mt-2 font-mono text-xs')} />
      {result && (
        <div className="mt-2 rounded-lg bg-white p-2 text-xs dark:bg-gray-800">
          <p className="font-bold text-emerald-700">{result.questions.length} valid question(s)</p>
          {result.errors.slice(0, 6).map((er, i) => <p key={i} className="text-rose-600">Line {er.line}: {er.message}</p>)}
          {result.errors.length > 6 && <p className="text-rose-600">…and {result.errors.length - 6} more problems</p>}
        </div>
      )}
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>Cancel</button>
        <button type="button" disabled={busy || !text.trim()} onClick={preview} className={btnGhost}>{busy ? 'Checking…' : 'Check questions'}</button>
        <button type="button" disabled={!result?.questions?.length} onClick={add} className={btnPrimary}><FaUpload /> Add {result?.questions?.length || ''} to this quiz</button>
      </div>
    </div>
  );
}

/* ---------------- quiz settings (time limit, attempts, show answers) ---------------- */
export function QuizSettingsFields({ quiz, setQuiz }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      <label className="text-xs font-bold text-slate-600">Time limit (minutes)<input type="number" min="0" placeholder="No limit" value={quiz.timeLimit ?? ''} onChange={(e) => setQuiz({ ...quiz, timeLimit: e.target.value })} className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-800 dark:text-white" /></label>
      <label className="text-xs font-bold text-slate-600">Attempts allowed<input type="number" min="0" placeholder="Unlimited" value={quiz.maxAttempts ?? ''} onChange={(e) => setQuiz({ ...quiz, maxAttempts: e.target.value })} className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-800 dark:text-white" /></label>
      <label className="col-span-2 flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={quiz.showAnswers !== false} onChange={(e) => setQuiz({ ...quiz, showAnswers: e.target.checked })} /> Show the correct answers after the student submits</label>
    </div>
  );
}

/* ---------------- results of one quiz (staff) ---------------- */
export function QuizResultsModal({ quizId, onClose }) {
  const [d, setD] = useState(null);
  useEffect(() => { api.get(`/learning/quizzes/${quizId}/results`).then((r) => setD(r.data)).catch((e) => { toast.error(e.response?.data?.error || 'Could not load results'); onClose(); }); }, [quizId]); // eslint-disable-line
  return (
    <Modal title="Quiz results" subtitle={d?.quiz?.title} onClose={onClose} wide footer={<><button onClick={() => downloadCsv(`/learning/quizzes/${quizId}/results?format=csv`, 'quiz-results.csv')} className={btnGhost}><FaFileCsv /> Export CSV</button><button onClick={onClose} className={btnPrimary}>Close</button></>}>
      {!d ? <p className="py-8 text-center text-slate-500">Loading…</p> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Students', d.summary.students], ['Attempts', d.summary.attempts], ['Average', `${d.summary.average}%`], ['Pass rate', `${d.summary.passRate}%`]].map(([l, v]) => <div key={l} className="rounded-xl bg-slate-50 p-3 text-center dark:bg-gray-800"><div className="text-xl font-black text-slate-900 dark:text-white">{v}</div><div className="text-xs text-slate-500">{l}</div></div>)}
          </div>
          <h4 className="mb-2 mt-5 text-sm font-extrabold text-slate-900 dark:text-white"><FaChartBar className="mr-1 inline" /> Which questions were hard?</h4>
          <ul className="space-y-2">
            {d.questions.map((q, i) => (
              <li key={i} className="text-xs"><div className="flex justify-between gap-2"><span className="truncate text-slate-700 dark:text-gray-200">{i + 1}. {q.prompt}</span><span className="shrink-0 font-bold">{q.correctRate == null ? '—' : `${q.correctRate}% correct`}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700"><div className={cx('h-full', (q.correctRate ?? 0) < 50 ? 'bg-rose-500' : 'bg-emerald-600')} style={{ width: `${q.correctRate || 0}%` }} /></div></li>
            ))}
          </ul>
          <h4 className="mb-2 mt-5 text-sm font-extrabold text-slate-900 dark:text-white">Students</h4>
          {!d.students.length ? <p className="text-sm text-slate-500">Nobody has taken this quiz yet.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="py-1">Student</th><th>Best</th><th>Result</th><th>Tries</th></tr></thead><tbody>
              {d.students.map((s) => <tr key={s.student.id} className="border-t border-slate-100 dark:border-gray-700"><td className="py-1.5">{s.student.fullName}<span className="block text-[10px] text-slate-400">{s.student.className || s.student.email}</span></td><td className="font-bold">{Math.round(s.best)}%</td><td className={s.passed ? 'font-bold text-emerald-700' : 'font-bold text-rose-600'}>{s.passed ? 'Passed' : 'Not yet'}</td><td>{s.tries}</td></tr>)}
            </tbody></table></div>
          )}
        </>
      )}
    </Modal>
  );
}

/* ---------------- student's live progress in a module ---------------- */
export function ModuleProgress({ moduleId, refreshKey, onCertificate }) {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get(`/learning/modules/${moduleId}/progress`).then((r) => setD(r.data)).catch(() => setD(null)), [moduleId]);
  useEffect(() => { load(); }, [load, refreshKey]);
  if (!d || !d.enrolled) return null;
  const recheck = async () => {
    setBusy(true);
    try { const r = await api.post(`/learning/modules/${moduleId}/recheck`); if (r.data.certificateIssued) toast.success('Your certificate is ready!'); else if (r.data.complete) toast('Module complete. The certificate will be issued once an authorized signatory exists.'); else toast('Keep going: finish the remaining items.'); await load(); onCertificate?.(); }
    catch (e) { toast.error(e.response?.data?.error || 'Could not check'); }
    setBusy(false);
  };
  const label = { VIDEO: 'Watch video', QUIZ: 'Pass quiz', ASSIGNMENT: 'Assignment (optional)' };
  return (
    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-extrabold text-emerald-900 dark:text-emerald-100">Your progress: {d.progress}%</p>
        <div className="flex items-center gap-2">
          {d.certificate && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800"><FaAward /> Certificate earned</span>}
          <button type="button" onClick={recheck} disabled={busy} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 dark:text-emerald-200"><FaSyncAlt className={busy ? 'animate-spin' : ''} /> Re-check</button>
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white dark:bg-gray-800"><div className="h-full bg-emerald-600 transition-all" style={{ width: `${d.progress}%` }} /></div>
      {d.items.length > 0 && <ul className="mt-3 grid gap-1 sm:grid-cols-2">{d.items.map((i) => <li key={`${i.type}${i.id}`} className={cx('flex items-center gap-2 text-xs', i.done ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-600 dark:text-gray-300')}>{i.done ? <FaCheckCircle className="shrink-0" /> : <FaRegCircle className="shrink-0" />}<span className="truncate">{label[i.type]}: {i.title}</span></li>)}</ul>}
      {!d.certificate && <p className="mt-2 text-[11px] text-slate-500">Watch every video and pass every quiz to get your certificate automatically.</p>}
    </div>
  );
}

/* ---------------- discussion under a lesson ---------------- */
export function LessonDiscussion({ lessonId, me }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const load = useCallback(() => api.get(`/learning/lessons/${lessonId}/comments`).then((r) => setRows(r.data)).catch(() => setRows([])), [lessonId]);
  useEffect(() => { if (open && rows === null) load(); }, [open, rows, load]);
  const send = async (e) => {
    e.preventDefault(); if (!text.trim()) return;
    try { await api.post(`/learning/lessons/${lessonId}/comments`, { body: text, parentId: replyTo }); setText(''); setReplyTo(null); await load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Could not send'); }
  };
  const remove = async (id) => { if (!window.confirm('Delete this message?')) return; try { await api.delete(`/learning/comments/${id}`); await load(); } catch (e) { toast.error(e.response?.data?.error || 'Could not delete'); } };
  const top = (rows || []).filter((r) => !r.parentId);
  const Row = ({ r, child }) => (
    <div className={cx('rounded-lg p-2 text-xs', child ? 'ml-6 bg-white dark:bg-gray-900' : 'bg-slate-50 dark:bg-gray-800')}>
      <div className="flex items-center justify-between gap-2"><span className="font-bold text-slate-800 dark:text-gray-100">{r.author?.fullName || 'User'}{r.author?.role !== 'STUDENT' && r.author?.role && <span className="ml-1 rounded bg-emerald-100 px-1 text-[10px] text-emerald-800">{r.author.role === 'ADMIN' ? 'Admin' : 'Trainer'}</span>}</span><span className="text-[10px] text-slate-400">{new Date(r.createdAt).toLocaleString()}</span></div>
      <p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-gray-300">{r.body}</p>
      <div className="mt-1 flex gap-3 font-bold">{!child && <button type="button" onClick={() => setReplyTo(r.id)} className="text-blue-700">Reply</button>}{(r.userId === me?.id || ['ADMIN', 'TRAINER'].includes(me?.role)) && <button type="button" onClick={() => remove(r.id)} className="text-rose-600"><FaTrash className="inline" /> Delete</button>}</div>
    </div>
  );
  return (
    <div className="mt-3 border-t border-slate-100 pt-2 dark:border-gray-800">
      <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-gray-300"><FaComments /> {open ? 'Hide discussion' : 'Ask a question / discussion'}{rows && rows.length > 0 && ` (${rows.length})`}</button>
      {open && (
        <div className="mt-2 space-y-2">
          {rows === null && <p className="text-xs text-slate-500">Loading…</p>}
          {top.map((r) => <div key={r.id} className="space-y-1.5"><Row r={r} />{rows.filter((c) => c.parentId === r.id).map((c) => <Row key={c.id} r={c} child />)}</div>)}
          {rows && !rows.length && <p className="text-xs text-slate-500">No questions yet. Be the first to ask.</p>}
          <form onSubmit={send} className="flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={replyTo ? 'Write a reply…' : 'Ask your trainer or classmates…'} className={cx(inputCls, 'flex-1 !py-2 text-xs')} />
            {replyTo && <button type="button" onClick={() => setReplyTo(null)} className={btnGhost}>Cancel</button>}
            <button disabled={!text.trim()} className={btnPrimary}>Send</button>
          </form>
        </div>
      )}
    </div>
  );
}

/* ---------------- rating of a module ---------------- */
export function ModuleReviews({ moduleId, isStudent, enrolled }) {
  const [d, setD] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const load = useCallback(() => api.get(`/learning/modules/${moduleId}/reviews`).then((r) => { setD(r.data); if (r.data.mine) { setRating(r.data.mine.rating); setComment(r.data.mine.comment || ''); } }).catch(() => setD(null)), [moduleId]);
  useEffect(() => { setD(null); setRating(0); setComment(''); load(); }, [load]);
  const save = async () => { try { await api.post(`/learning/modules/${moduleId}/reviews`, { rating, comment }); toast.success('Thank you for your rating'); await load(); } catch (e) { toast.error(e.response?.data?.error || 'Could not save'); } };
  const remove = async (id) => { try { await api.delete(`/learning/reviews/${id}`); setRating(0); setComment(''); await load(); } catch (e) { toast.error(e.response?.data?.error || 'Could not delete'); } };
  if (!d) return null;
  const Stars = ({ value, onPick }) => <span className="inline-flex">{[1, 2, 3, 4, 5].map((n) => { const Ic = n <= value ? FaStar : FaRegStar; return <button key={n} type="button" disabled={!onPick} onClick={() => onPick?.(n)} className="text-amber-500"><Ic /></button>; })}</span>;
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 p-4 dark:border-gray-700">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-extrabold text-slate-900 dark:text-white">Ratings & feedback</h3><span className="text-sm">{d.average ? <><Stars value={Math.round(d.average)} /> <b>{d.average}</b> <span className="text-xs text-slate-500">({d.count})</span></> : <span className="text-xs text-slate-500">No ratings yet</span>}</span></div>
      {isStudent && enrolled && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-gray-800"><p className="text-xs font-bold text-slate-600 dark:text-gray-300">Your rating</p><Stars value={rating} onPick={setRating} />
          <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What did you like? What can be improved? (optional)" className={cx(inputCls, 'mt-2 text-xs')} />
          <div className="mt-2 flex justify-end gap-2">{d.mine && <button type="button" onClick={() => remove(d.mine.id)} className={btnGhost}>Remove</button>}<button type="button" disabled={!rating} onClick={save} className={btnPrimary}>{d.mine ? 'Update' : 'Submit'}</button></div></div>
      )}
      <ul className="mt-3 space-y-2">{d.reviews.filter((r) => r.comment).slice(0, 6).map((r) => <li key={r.id} className="rounded-lg bg-slate-50 p-2 text-xs dark:bg-gray-800"><b>{r.student}</b> <Stars value={r.rating} /><p className="mt-0.5 text-slate-600 dark:text-gray-300">{r.comment}</p></li>)}</ul>
    </div>
  );
}

/* ---------------- student lesson player: video + tabs + course playlist (v6.0 design) ---------------- */
const THUMBS = ['/images/v6-th-computer.webp', '/images/v6-th-network.webp', '/images/v6-th-web.webp', '/images/v6-th-db.webp'];
const TABS = ['Lesson Details', 'Resources', 'Quiz', 'Notes', 'Discussion'];
export function LessonPlayer({ detail, quizzes = [], attempt, user, onWatched }) {
  const lessons = detail.lessons || [];
  const firstOpen = Math.max(0, lessons.findIndex((l) => !l.view?.completedAt));
  const [idx, setIdx] = useState(firstOpen);
  const [tab, setTab] = useState('Lesson Details');
  const [note, setNote] = useState('');
  const lesson = lessons[Math.min(idx, lessons.length - 1)];
  const lid = lesson?.id;
  useEffect(() => { setIdx(firstOpen); }, [detail.id]); // eslint-disable-line
  useEffect(() => { if (!lid) return; try { setNote(localStorage.getItem(`nts-note:${user?.id}:${lid}`) || ''); } catch (e) { setNote(''); } }, [lid, user?.id]);
  if (!lesson) return <p className="text-sm text-slate-500">No published lessons yet.</p>;
  const done = lessons.filter((l) => l.view?.completedAt).length;
  const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  const lessonQuizzes = quizzes.filter((q) => q.lessonId === lesson.id);
  const moduleQuizzes = quizzes.filter((q) => !q.lessonId);
  const saveNote = (v) => { setNote(v); try { localStorage.setItem(`nts-note:${user?.id}:${lid}`, v); } catch (e) { /* storage blocked */ } };
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black dark:border-gray-700">
          {lesson.videoUrl
            ? <LessonVideo key={lesson.id} lesson={lesson} isStudent onWatched={onWatched} />
            : <div className="relative"><img src="/images/v6-lesson.webp" alt="" className="h-56 w-full object-cover opacity-80 sm:h-72" /><p className="absolute inset-x-0 bottom-4 text-center text-sm font-bold text-white">Reading lesson: use the tabs below</p></div>}
        </div>
        <div className="mt-3 flex flex-wrap gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-gray-800">
          {TABS.map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={cx('rounded-lg px-4 py-2 text-sm font-bold', tab === t ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-700')}>{t}</button>)}
        </div>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          {tab === 'Lesson Details' && (
            <div className="flex gap-4">
              <img src={THUMBS[idx % THUMBS.length]} alt="" className="hidden h-24 w-36 rounded-xl object-cover sm:block" />
              <div className="min-w-0"><h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{idx + 1}. {lesson.title}</h3>
                <p className="text-xs font-semibold text-slate-500">Course: {detail.name} · {lesson.videoUrl ? (lesson.view?.completedAt ? 'Video watched ✓' : `Video watched ${Math.round(lesson.view?.watchedPct || 0)}%`) : 'Reading lesson'}</p>
                {lesson.content ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-gray-300">{lesson.content}</p> : <p className="mt-2 text-sm text-slate-500">Watch the video, then continue to the next lesson.</p>}</div>
            </div>)}
          {tab === 'Resources' && (lesson.resourceUrl
            ? <div className="flex flex-wrap items-center gap-4"><a className="text-sm font-bold text-blue-700" href={asset(lesson.resourceUrl)} target="_blank" rel="noreferrer">Open note</a><a className="text-sm font-bold text-emerald-700" href={asset(lesson.resourceUrl)} download target="_blank" rel="noreferrer">Download</a><SaveNoteButton title={lesson.title} url={lesson.resourceUrl} /></div>
            : <p className="text-sm text-slate-500">No files for this lesson.</p>)}
          {tab === 'Quiz' && (
            <div className="space-y-2">
              {[...lessonQuizzes, ...moduleQuizzes].map((q) => <div key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 dark:border-gray-700"><div><p className="font-bold text-slate-900 dark:text-white">{q.title}</p><p className="text-xs text-slate-500">{q.questions?.length || 0} questions · pass mark {q.passMark}%{q.timeLimit ? ` · ${q.timeLimit} min` : ''}</p></div><button type="button" onClick={() => attempt(q)} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">Start quiz</button></div>)}
              {!lessonQuizzes.length && !moduleQuizzes.length && <p className="text-sm text-slate-500">No quiz for this module yet.</p>}
            </div>)}
          {tab === 'Notes' && <div><textarea rows={5} value={note} onChange={(e) => saveNote(e.target.value)} placeholder="Write your own notes for this lesson. They are saved on this device." className={cx(inputCls, 'text-sm')} /><p className="mt-1 text-[11px] text-slate-400">Saved automatically on this device.</p></div>}
          {tab === 'Discussion' && <LessonDiscussion key={lesson.id} lessonId={lesson.id} me={user} />}
        </div>
      </div>
      <aside className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between bg-gradient-to-r from-blue-800 to-blue-600 px-4 py-3 font-extrabold text-white"><span>Course Playlist</span><span>{Math.min(idx + 1, lessons.length)} / {lessons.length}</span></div>
          <ul className="max-h-[26rem] divide-y divide-slate-100 overflow-y-auto dark:divide-gray-700">
            {lessons.map((l, n) => (
              <li key={l.id}><button type="button" onClick={() => { setIdx(n); setTab('Lesson Details'); }} className={cx('flex w-full items-center gap-3 p-3 text-left', n === idx ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-gray-700/50')}>
                <span className="w-4 text-center text-xs font-bold text-slate-400">{n + 1}</span>
                <img src={THUMBS[n % THUMBS.length]} alt="" className="h-10 w-14 shrink-0 rounded-lg object-cover" loading="lazy" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-white">{l.title}</span>
                {l.view?.completedAt ? <FaCheckCircle className="shrink-0 text-emerald-600" /> : l.videoUrl ? <span className="text-[11px] font-bold text-slate-400">{Math.round(l.view?.watchedPct || 0)}%</span> : null}
              </button></li>))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between"><p className="font-extrabold text-slate-900 dark:text-white">Your Progress</p><b className="text-lg">{pct}%</b></div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} /></div>
          <p className="mt-1 text-xs text-slate-500">{done} of {lessons.length} lessons completed</p>
          {idx < lessons.length - 1 && <button type="button" onClick={() => { setIdx(idx + 1); setTab('Lesson Details'); }} className="mt-3 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-extrabold text-white hover:bg-blue-700">Next Lesson →</button>}
        </div>
      </aside>
    </div>
  );
}
