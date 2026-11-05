import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FaSearch, FaPlus, FaTrash, FaEdit, FaQuestionCircle, FaCheckCircle, FaClipboardCheck, FaCopy, FaTimes } from 'react-icons/fa';
import api from '../services/api';
import PageHero from '../components/PageHero';
import Modal from '../components/Modal';
import { Card, Badge, EmptyState, Skeleton, btnPrimary, btnGhost, inputCls, cx } from '../components/ui';

const LEVELS = { EASY: 'brand', MEDIUM: 'amber', HARD: 'rose' };
const blank = () => ({ prompt: '', options: ['', '', '', ''], answerIndex: 0, points: 1, topic: '', difficulty: 'MEDIUM', moduleId: '', explanation: '' });

function QuestionForm({ item, modules, topics, onClose, onSaved }) {
  const [f, setF] = useState(item ? { ...item, moduleId: item.moduleId || '', topic: item.topic || '', explanation: item.explanation || '' } : blank());
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setOpt = (i, v) => set('options', f.options.map((o, k) => (k === i ? v : o)));
  const removeOpt = (i) => { set('options', f.options.filter((_, k) => k !== i)); if (f.answerIndex >= i && f.answerIndex > 0) set('answerIndex', f.answerIndex - 1); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...f, moduleId: f.moduleId || null };
      if (item) await api.put(`/bank/${item.id}`, body); else await api.post('/bank', body);
      toast.success(item ? 'Question updated' : 'Question saved to the bank');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Could not save the question'); } finally { setBusy(false); }
  };

  return (
    <Modal wide title={item ? 'Edit question' : 'New question'} onClose={onClose}
      footer={<><button type="button" className={btnGhost} onClick={onClose}>Cancel</button><button form="q-form" disabled={busy} className={btnPrimary}>{busy ? 'Saving…' : 'Save question'}</button></>}>
      <form id="q-form" onSubmit={submit} className="space-y-4">
        <textarea required rows={3} value={f.prompt} onChange={(e) => set('prompt', e.target.value)} placeholder="Question text *" className={inputCls} />
        <div>
          <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-gray-200">Answer options — select the correct one</p>
          <div className="space-y-2">
            {f.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="correct" checked={f.answerIndex === i} onChange={() => set('answerIndex', i)} className="h-4 w-4 accent-emerald-600" aria-label={`Option ${i + 1} is correct`} />
                <input value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + i)}`} className={inputCls} />
                {f.options.length > 2 && <button type="button" onClick={() => removeOpt(i)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Remove option"><FaTimes /></button>}
              </div>
            ))}
          </div>
          {f.options.length < 6 && <button type="button" onClick={() => set('options', [...f.options, ''])} className="mt-2 text-xs font-bold text-blue-700 hover:underline">+ Add option</button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={f.moduleId} onChange={(e) => set('moduleId', e.target.value)} className={inputCls}>
            <option value="">Module (optional)</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
          </select>
          <input list="bank-topics" value={f.topic} onChange={(e) => set('topic', e.target.value)} placeholder="Topic (e.g. Networking)" className={inputCls} />
          <datalist id="bank-topics">{topics.map((t) => <option key={t.name} value={t.name} />)}</datalist>
          <select value={f.difficulty} onChange={(e) => set('difficulty', e.target.value)} className={inputCls}>
            <option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option>
          </select>
          <input type="number" min="1" max="100" value={f.points} onChange={(e) => set('points', e.target.value)} placeholder="Points" className={inputCls} />
        </div>
        <textarea rows={2} value={f.explanation} onChange={(e) => set('explanation', e.target.value)} placeholder="Explanation shown after answering (optional)" className={inputCls} />
      </form>
    </Modal>
  );
}

function BuildQuiz({ ids, modules, onClose, onDone }) {
  const [f, setF] = useState({ moduleId: '', title: '', passMark: 50, timeLimit: '', maxAttempts: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post('/bank/build-quiz', { ...f, questionIds: ids });
      toast.success(`Quiz published with ${r.data.questions} questions`);
      onDone();
    } catch (err) { toast.error(err.response?.data?.error || 'Could not create the quiz'); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Create quiz from ${ids.length} question${ids.length > 1 ? 's' : ''}`} onClose={onClose}
      footer={<><button type="button" className={btnGhost} onClick={onClose}>Cancel</button><button form="b-form" disabled={busy} className={btnPrimary}>{busy ? 'Publishing…' : 'Publish quiz'}</button></>}>
      <form id="b-form" onSubmit={submit} className="space-y-3">
        <select required value={f.moduleId} onChange={(e) => setF({ ...f, moduleId: e.target.value })} className={inputCls}>
          <option value="">Choose module *</option>
          {modules.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
        </select>
        <input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Quiz title *" className={inputCls} />
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-slate-600">Pass mark %<input type="number" min="0" max="100" value={f.passMark} onChange={(e) => setF({ ...f, passMark: e.target.value })} className={`${inputCls} mt-1`} /></label>
          <label className="text-xs font-semibold text-slate-600">Time limit (min)<input type="number" min="1" value={f.timeLimit} onChange={(e) => setF({ ...f, timeLimit: e.target.value })} placeholder="None" className={`${inputCls} mt-1`} /></label>
          <label className="text-xs font-semibold text-slate-600">Max attempts<input type="number" min="1" value={f.maxAttempts} onChange={(e) => setF({ ...f, maxAttempts: e.target.value })} placeholder="Unlimited" className={`${inputCls} mt-1`} /></label>
        </div>
      </form>
    </Modal>
  );
}

function CopyFromQuiz({ onClose, onDone }) {
  const [quizzes, setQuizzes] = useState(null);
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/learning/quizzes').then((r) => setQuizzes(r.data)).catch(() => setQuizzes([])); }, []);
  const go = async () => {
    if (!id) return toast.error('Choose a quiz');
    setBusy(true);
    try { const r = await api.post(`/bank/from-quiz/${id}`); toast.success(`${r.data.added} question(s) copied${r.data.skipped ? `, ${r.data.skipped} already in the bank` : ''}`); onDone(); }
    catch (e) { toast.error(e.response?.data?.error || 'Could not copy'); } finally { setBusy(false); }
  };
  return (
    <Modal title="Copy questions from a quiz" subtitle="Questions already in your bank are skipped." onClose={onClose}
      footer={<><button className={btnGhost} onClick={onClose}>Cancel</button><button onClick={go} disabled={busy} className={btnPrimary}>{busy ? 'Copying…' : 'Copy questions'}</button></>}>
      {quizzes === null ? <Skeleton className="h-10" /> : (
        <select value={id} onChange={(e) => setId(e.target.value)} className={inputCls}>
          <option value="">Choose a quiz</option>
          {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title} ({q.questions?.length || 0} questions)</option>)}
        </select>
      )}
    </Modal>
  );
}

export default function QuestionBank() {
  const [data, setData] = useState(null);
  const [modules, setModules] = useState([]);
  const [filters, setFilters] = useState({ q: '', topic: '', difficulty: '', moduleId: '' });
  const [picked, setPicked] = useState([]);
  const [modal, setModal] = useState(null); // 'new' | item | 'build' | 'copy'

  const load = useCallback(async () => {
    try { setData((await api.get('/bank', { params: filters })).data); }
    catch (e) { toast.error(e.response?.data?.error || 'Could not load the question bank'); setData({ items: [], total: 0, topics: [] }); }
  }, [filters]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { api.get('/learning/modules').then((r) => setModules(r.data || [])).catch(() => {}); }, []);

  const moduleName = useMemo(() => Object.fromEntries(modules.map((m) => [m.id, m.code])), [modules]);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const remove = async (q) => {
    if (!window.confirm('Delete this question from the bank? Quizzes already built from it are not changed.')) return;
    try { await api.delete(`/bank/${q.id}`); setPicked((p) => p.filter((x) => x !== q.id)); load(); } catch (e) { toast.error(e.response?.data?.error || 'Could not delete'); }
  };
  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6">
      <PageHero slot="bankHero" title="Question Bank" subtitle="Write once, reuse in every quiz and exam">
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => setModal('new')} className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-4 py-2 text-sm font-extrabold text-blue-950 shadow hover:bg-yellow-300"><FaPlus /> New question</button>
          <button onClick={() => setModal('copy')} className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25"><FaCopy /> Copy from quiz</button>
        </div>
      </PageHero>

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px_160px_200px]">
        <div className="relative"><FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={filters.q} onChange={(e) => setF('q', e.target.value)} placeholder="Search questions…" className={`${inputCls} pl-10`} /></div>
        <select value={filters.topic} onChange={(e) => setF('topic', e.target.value)} className={inputCls}><option value="">All topics</option>{(data?.topics || []).map((t) => <option key={t.name} value={t.name}>{t.name} ({t.count})</option>)}</select>
        <select value={filters.difficulty} onChange={(e) => setF('difficulty', e.target.value)} className={inputCls}><option value="">Any difficulty</option><option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option></select>
        <select value={filters.moduleId} onChange={(e) => setF('moduleId', e.target.value)} className={inputCls}><option value="">All modules</option>{modules.map((m) => <option key={m.id} value={m.id}>{m.code}</option>)}</select>
      </div>

      {picked.length > 0 && (
        <div className="sticky top-16 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-blue-700 px-4 py-3 text-white shadow-lg">
          <p className="text-sm font-bold">{picked.length} selected</p>
          <div className="flex gap-2">
            <button onClick={() => setPicked([])} className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold hover:bg-white/25">Clear</button>
            <button onClick={() => setModal('build')} className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-extrabold text-blue-950 hover:bg-yellow-300"><FaClipboardCheck /> Create quiz</button>
          </div>
        </div>
      )}

      {!data && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>}
      {data && data.items.length === 0 && <Card><EmptyState icon={FaQuestionCircle} title="No questions found" text="Add a question, or copy the questions of an existing quiz into the bank." /></Card>}

      <div className="space-y-3">
        {(data?.items || []).map((q) => (
          <Card key={q.id} className={cx('p-4', picked.includes(q.id) && 'ring-2 ring-blue-500')}>
            <div className="flex gap-3">
              <input type="checkbox" checked={picked.includes(q.id)} onChange={() => toggle(q.id)} className="mt-1 h-4 w-4 accent-blue-700" aria-label="Select question" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={LEVELS[q.difficulty] || 'slate'}>{q.difficulty.toLowerCase()}</Badge>
                  {q.topic && <Badge tone="brand">{q.topic}</Badge>}
                  {q.moduleId && <Badge tone="slate">{moduleName[q.moduleId] || `Module ${q.moduleId}`}</Badge>}
                  <span className="text-[11px] text-slate-400">{q.points} pt</span>
                </div>
                <p className="mt-2 font-semibold text-slate-900 dark:text-white">{q.prompt}</p>
                <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {q.options.map((o, i) => (
                    <li key={i} className={cx('flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm', i === q.answerIndex ? 'bg-emerald-50 font-semibold text-emerald-800' : 'bg-slate-50 text-slate-700 dark:bg-gray-800 dark:text-gray-300')}>
                      {i === q.answerIndex ? <FaCheckCircle className="shrink-0" /> : <span className="w-3.5 shrink-0 text-center text-[11px] font-bold text-slate-400">{String.fromCharCode(65 + i)}</span>}{o}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button onClick={() => setModal(q)} className="rounded-lg p-2 text-blue-700 hover:bg-blue-50" aria-label="Edit"><FaEdit /></button>
                <button onClick={() => remove(q)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Delete"><FaTrash /></button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {(modal === 'new' || (modal && typeof modal === 'object')) && <QuestionForm item={modal === 'new' ? null : modal} modules={modules} topics={data?.topics || []} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal === 'build' && <BuildQuiz ids={picked} modules={modules} onClose={() => setModal(null)} onDone={() => { setModal(null); setPicked([]); }} />}
      {modal === 'copy' && <CopyFromQuiz onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
    </div>
  );
}
