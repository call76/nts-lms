// Learning Studio building blocks that replace the old browser prompt() boxes.
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { FaCheckCircle, FaTimesCircle, FaDownload, FaBookmark, FaExternalLinkAlt, FaPlay, FaClock, FaAward, FaExclamationTriangle } from 'react-icons/fa';
import api, { uploadFile } from '../services/api';
import { asset } from '../services/assets';
import Modal from './Modal';
import { btnPrimary, btnGhost, inputCls, cx } from './ui';

/* ------------------------------ quiz player ------------------------------ */
export function QuizPlayer({ quiz, onClose, onDone }) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(quiz.timeLimit ? quiz.timeLimit * 60 : null);
  const q = quiz.questions[i];
  const last = i === quiz.questions.length - 1;
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const filled = Array.from({ length: quiz.questions.length }, (_, n) => (answersRef.current[n] === undefined ? null : answersRef.current[n]));
      const r = await api.post(`/learning/quizzes/${quiz.id}/attempt`, { answers: filled });
      setResult(r.data); onDone?.(r.data);
      if (r.data.certificateIssued) toast.success('🎓 Certificate issued!');
    }
    catch (e) { toast.error(e.response?.data?.error || 'Quiz failed'); if (['WATCH_VIDEO_FIRST', 'NO_ATTEMPTS_LEFT'].includes(e.response?.data?.code)) onClose(); }
    setBusy(false);
  };
  const submitRef = useRef(submit);
  submitRef.current = submit;

  // countdown: the quiz is sent automatically when the time is over
  useEffect(() => {
    if (left === null || result) return undefined;
    if (left <= 0) { toast('Time is over. Your answers were sent.'); submitRef.current(); return undefined; }
    const t = setTimeout(() => setLeft((x) => (x === null ? x : x - 1)), 1000);
    return () => clearTimeout(t);
  }, [left, result]);
  const clock = left === null ? null : `${String(Math.floor(Math.max(0, left) / 3600)).padStart(2, '0')}:${String(Math.floor((Math.max(0, left) % 3600) / 60)).padStart(2, '0')}:${String(Math.max(0, left) % 60).padStart(2, '0')}`;

  if (result) {
    return (
      <Modal title={result.passed ? 'Well done! 🎉' : 'Keep trying'} subtitle={quiz.title} onClose={onClose} wide footer={<button onClick={onClose} className={btnPrimary}>Close</button>}>
        <div className="mb-5 flex items-center gap-4 rounded-2xl bg-slate-50 p-4 dark:bg-gray-800">
          <div className={cx('grid h-20 w-20 place-items-center rounded-full text-2xl font-black text-white', result.passed ? 'bg-emerald-600' : 'bg-rose-500')}>{result.score}%</div>
          <div><p className="font-bold text-slate-900 dark:text-white">{result.passed ? 'You passed this quiz' : 'You did not reach the pass mark'}</p><p className="text-sm text-slate-500">Pass mark: {result.passMark}%{result.attemptsLeft != null && ` · Attempts left: ${result.attemptsLeft}`}</p></div>
        </div>
        {result.certificateIssued && <Link to="/certificates" onClick={onClose} className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"><FaAward /> Module completed. Your certificate is ready — open Certificates →</Link>}
        {result.moduleCompleted && !result.certificateIssued && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">Module completed 🎉 Your certificate will be issued as soon as it is approved.</p>}
        {!result.review && <p className="text-sm text-slate-500">The trainer chose not to show the correct answers for this quiz.</p>}
        <ul className="space-y-3">
          {result.review?.map((r, n) => {
            const ok = r.yourAnswer === r.correctIndex;
            return (
              <li key={n} className="rounded-xl border border-slate-200 p-3 dark:border-gray-700">
                <p className="flex items-start gap-2 text-sm font-semibold text-slate-900 dark:text-white">{ok ? <FaCheckCircle className="mt-0.5 shrink-0 text-emerald-600" /> : <FaTimesCircle className="mt-0.5 shrink-0 text-rose-500" />}<span>{n + 1}. {r.prompt}</span></p>
                {!ok && <p className="mt-1 pl-6 text-xs text-rose-600">Your answer: {r.yourAnswer == null ? 'none' : r.options[r.yourAnswer]}</p>}
                <p className="mt-0.5 pl-6 text-xs text-emerald-700 dark:text-emerald-300">Correct answer: {r.options[r.correctIndex]}</p>
                {r.explanation && <p className="mt-0.5 pl-6 text-xs italic text-slate-500">{r.explanation}</p>}
              </li>
            );
          })}
        </ul>
      </Modal>
    );
  }

  const answered = quiz.questions.map((_, n) => answers[n] !== undefined && answers[n] !== null);
  const doneCount = answered.filter(Boolean).length;
  const trySubmit = () => {
    const missing = quiz.questions.length - doneCount;
    if (missing > 0 && !window.confirm(`${missing} question(s) are not answered. Submit anyway?`)) return;
    submit();
  };
  const leave = () => { if (doneCount && !window.confirm('Leave the exam? Your answers will be lost.')) return; onClose(); };
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-50 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl p-3 sm:p-5">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-950 via-blue-800 to-blue-700 p-4 text-white shadow-lg sm:p-5">
          <img src="/images/v6-keyboard.webp" alt="" className="hidden h-14 w-14 rounded-xl object-cover sm:block" />
          <div className="min-w-0 flex-1"><h2 className="truncate text-lg font-extrabold sm:text-2xl">{quiz.title}</h2><p className="text-xs text-blue-100 sm:text-sm">Test your knowledge{quiz.timeLimit ? `. You have ${quiz.timeLimit} minutes to complete this exam.` : '. Take your time and answer carefully.'}</p></div>
          <span className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold"><FaCheckCircle className="mr-1 inline" />Questions: {quiz.questions.length}</span>
          {quiz.timeLimit && <span className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-sm font-bold"><FaClock className="mr-1 inline" />Time: {quiz.timeLimit} min</span>}
          <button type="button" onClick={leave} className="rounded-full bg-white/15 px-3 py-2 text-xs font-bold hover:bg-white/25">Exit</button>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-4 rounded-t-2xl bg-gradient-to-r from-blue-800 to-blue-600 px-5 py-3 text-white">
              <span className="text-lg font-extrabold">Question {i + 1} of {quiz.questions.length}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${((i + 1) / quiz.questions.length) * 100}%` }} /></div>
              <span className="text-lg font-extrabold">{Math.round(((i + 1) / quiz.questions.length) * 100)}%</span>
            </div>
            <div className="p-5">
              <p className="mb-4 text-lg font-extrabold text-slate-900 dark:text-white">{i + 1}. {q.prompt}</p>
              <div className={cx('grid gap-4', q.imageUrl && 'md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]')}>
                {q.imageUrl && <img src={asset(q.imageUrl)} alt="" className="max-h-72 w-full rounded-xl border border-slate-200 bg-blue-50 object-contain dark:border-gray-700" />}
                <div className="space-y-2.5">
                  {q.options.map((o, n) => (
                    <button key={n} type="button" onClick={() => { const a = [...answers]; a[i] = n; setAnswers(a); }}
                      className={cx('flex w-full items-center gap-3 rounded-xl border-2 p-3.5 text-left text-base transition', answers[i] === n ? 'border-blue-600 bg-blue-50 font-bold text-blue-900 dark:bg-blue-900/30 dark:text-blue-100' : 'border-slate-200 text-slate-700 hover:border-blue-300 dark:border-gray-700 dark:text-gray-200')}>
                      <span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-full border-2', answers[i] === n ? 'border-blue-600' : 'border-slate-300')}>{answers[i] === n && <span className="h-3 w-3 rounded-full bg-blue-600" />}</span>
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-between gap-3 border-t border-slate-100 p-4 dark:border-gray-700">
              <button type="button" disabled={i === 0} onClick={() => setI(i - 1)} className="rounded-xl border-2 border-blue-600 px-5 py-2.5 text-sm font-extrabold text-blue-700 disabled:opacity-40">← Previous</button>
              {last
                ? <button type="button" disabled={busy} onClick={trySubmit} className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:opacity-60">{busy ? 'Sending…' : 'Submit exam'}</button>
                : <button type="button" onClick={() => setI(i + 1)} className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-extrabold text-white hover:bg-blue-700">Next Question →</button>}
            </div>
          </section>
          <aside className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center gap-2 bg-red-600 px-4 py-2.5 font-extrabold text-white"><FaClock /> {clock ? 'Time Remaining' : 'No time limit'}</div>
              {clock && <><p className={cx('py-3 text-center font-mono text-4xl font-black', left <= 60 ? 'text-red-600' : 'text-red-500')}>{clock}</p>
              <p className="mx-3 mb-3 flex items-start gap-2 rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-700"><FaExclamationTriangle className="mt-0.5 shrink-0" /> Please complete the exam before time runs out.</p></>}
              {!clock && <p className="p-4 text-sm text-slate-500">Answered {doneCount} of {quiz.questions.length}.</p>}
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="bg-blue-700 px-4 py-2.5 font-extrabold text-white">Question Navigator</div>
              <div className="grid grid-cols-5 gap-2 p-4">
                {quiz.questions.map((_, n) => <button key={n} type="button" onClick={() => setI(n)} className={cx('h-10 rounded-lg text-sm font-extrabold', n === i ? 'bg-blue-600 text-white' : answered[n] ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 dark:bg-gray-700 dark:text-gray-200')}>{n + 1}</button>)}
              </div>
              <div className="flex flex-wrap gap-3 px-4 pb-4 text-[11px] font-semibold text-slate-600 dark:text-gray-300"><span><i className="mr-1 inline-block h-3 w-3 rounded bg-blue-600 align-middle" />Current</span><span><i className="mr-1 inline-block h-3 w-3 rounded bg-emerald-500 align-middle" />Answered</span><span><i className="mr-1 inline-block h-3 w-3 rounded bg-slate-200 align-middle" />Not Answered</span></div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <p className="mb-2 font-extrabold text-blue-800 dark:text-blue-200">Exam Instructions</p>
              {['Read each question carefully.', 'Choose the best answer.', 'You can go back and change your answers.', 'Click Submit when done.'].map((t) => <p key={t} className="flex items-start gap-2 py-0.5 text-sm text-slate-700 dark:text-gray-200"><FaCheckCircle className="mt-0.5 shrink-0 text-emerald-600" />{t}</p>)}
              {quiz.maxAttempts && <p className="mt-2 text-xs text-slate-500">Attempts allowed: {quiz.maxAttempts}</p>}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export function SubmitModal({ assignment, onClose, onDone }) {
  const [answer, setAnswer] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const up = file ? await uploadFile(file) : null;
      await api.post(`/learning/assignments/${assignment.id}/submit`, { answer, fileUrl: up?.url || '' });
      toast.success('Assignment submitted'); onDone?.(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Submission failed'); }
    setBusy(false);
  };
  return (
    <Modal title={`Submit: ${assignment.title}`} subtitle={`Maximum score ${assignment.maxScore}`} onClose={onClose}>
      <form onSubmit={send} className="space-y-4">
        <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-gray-800 dark:text-gray-300">{assignment.instructions}</p>
        {assignment.attachmentUrl && <a href={asset(assignment.attachmentUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><FaDownload /> Assignment file</a>}
        <textarea className={inputCls} rows={6} placeholder="Write your answer here…" value={answer} onChange={(e) => setAnswer(e.target.value)} />
        <div><label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300">Or attach your work (optional)</label><input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm" /></div>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className={btnGhost}>Cancel</button><button disabled={busy || (!answer.trim() && !file)} className={btnPrimary}>{busy ? 'Sending…' : 'Submit work'}</button></div>
      </form>
    </Modal>
  );
}

/* ------------------------------ grade modal ------------------------------ */
export function GradeModal({ submission, onClose, onDone }) {
  const max = submission.assignment?.maxScore || 100;
  const [score, setScore] = useState(submission.score ?? '');
  const [feedback, setFeedback] = useState(submission.feedback || '');
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.patch(`/learning/submissions/${submission.id}/grade`, { score: Number(score), feedback }); toast.success('Graded'); onDone?.(); onClose(); }
    catch (err) { toast.error(err.response?.data?.error || 'Could not grade'); }
    setBusy(false);
  };
  return (
    <Modal title={`Grade ${submission.student?.fullName || 'student'}`} subtitle={submission.assignment?.title} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-gray-800 dark:text-gray-200"><p className="whitespace-pre-wrap">{submission.answer || '(no text answer)'}</p>{submission.fileUrl && <a href={asset(submission.fileUrl)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 font-semibold text-blue-700"><FaExternalLinkAlt /> Open attached file</a>}</div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-gray-200">Score (0 – {max})<input required type="number" min="0" max={max} step="0.5" value={score} onChange={(e) => setScore(e.target.value)} className={cx(inputCls, 'mt-1')} /></label>
        <label className="block text-sm font-semibold text-slate-700 dark:text-gray-200">Feedback<textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} className={cx(inputCls, 'mt-1')} placeholder="What went well? What to improve?" /></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className={btnGhost}>Cancel</button><button disabled={busy} className={btnPrimary}>{busy ? 'Saving…' : 'Save grade'}</button></div>
      </form>
    </Modal>
  );
}

/* ------------------------------ lesson video (tracks watching) ------------------------------ */
const embedUrl = (u) => {
  const yt = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = u.match(/vimeo\.com\/(\d+)/);
  return vm ? `https://player.vimeo.com/video/${vm[1]}` : null;
};
const isFileVideo = (u) => /\.(mp4|webm|ogg|mov)(\?|$)/i.test(u);

export function LessonVideo({ lesson, isStudent, onWatched }) {
  const [pct, setPct] = useState(lesson.view?.watchedPct || 0);
  const [done, setDone] = useState(Boolean(lesson.view?.completedAt));
  const last = useRef(0);
  const url = asset(lesson.videoUrl); // uploaded videos are stored as /uploads/... and resolved against the backend
  const embed = embedUrl(url);
  const report = async (p, completed = false) => {
    if (!isStudent) return;
    try { const r = await api.post(`/learning/lessons/${lesson.id}/progress`, { pct: p, completed }); if (r.data.completedAt && !done) { setDone(true); toast.success('Video finished. You can now answer its questions.'); onWatched?.(); } } catch (e) { /* ignore */ }
  };
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-gray-700">
      {isFileVideo(url) ? (
        <video src={url} controls controlsList="nodownload" className="aspect-video w-full bg-black"
          onTimeUpdate={(e) => { const v = e.currentTarget; if (!v.duration) return; const p = Math.round((v.currentTime / v.duration) * 100); setPct((o) => Math.max(o, p)); if (p - last.current >= 10) { last.current = p; report(p); } }}
          onEnded={() => { setPct(100); report(100, true); }} />
      ) : embed ? (
        <iframe title={lesson.title} src={embed} className="aspect-video w-full" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      ) : (
        <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-4 text-sm font-semibold text-emerald-700"><FaPlay /> Open video ↗</a>
      )}
      {isStudent && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2 text-xs dark:bg-gray-800">
          <span className={done ? 'font-bold text-emerald-700' : 'text-slate-500'}>{done ? '✓ Video watched' : `Watched ${pct}%`}</span>
          {!done && !isFileVideo(url) && <button onClick={() => report(100, true)} className="rounded-lg bg-emerald-700 px-3 py-1.5 font-bold text-white">I finished watching</button>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ file actions: open / download / keep ------------------------------ */
export function SaveNoteButton({ title, url, source = 'lesson' }) {
  const [saved, setSaved] = useState(false);
  const save = async () => { try { await api.post('/learning/saved', { title, url, source }); setSaved(true); toast.success('Saved in My library'); } catch (e) { toast.error(e.response?.data?.error || 'Could not save'); } };
  return <button type="button" onClick={save} disabled={saved} className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 disabled:opacity-60"><FaBookmark /> {saved ? 'Saved' : 'Keep in my library'}</button>;
}

// Fetches a protected file and opens it in a tab (view) or saves it to the computer (download).
export async function fetchFile(file, mode) {
  const r = await api.get(`/resources/${file.id}/file`, { responseType: 'blob' });
  const url = URL.createObjectURL(r.data);
  if (mode === 'download') { const a = document.createElement('a'); a.href = url; a.download = file.originalName; document.body.appendChild(a); a.click(); a.remove(); }
  else window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}
