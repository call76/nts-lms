// V6 Campus hub: analytics, practical skills, internship logbook, fees, timetable and AI tutor.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaChartLine, FaTools, FaBook, FaMoneyBillWave, FaCalendarAlt, FaRobot, FaTrash, FaPrint, FaFileCsv, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';
import api, { uploadFile } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { downloadCsv } from '../components/LearningExtras';
import { btnPrimary, btnGhost, inputCls, cx } from '../components/ui';

const Box = ({ title, action, children, className = '' }) => (
  <section className={cx('rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800', className)}>
    {(title || action) && <div className="mb-3 flex flex-wrap items-center justify-between gap-2">{title && <h3 className="font-extrabold text-slate-900 dark:text-white">{title}</h3>}{action}</div>}
    {children}
  </section>
);
const Tile = ({ label, value, tone = 'slate' }) => <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-gray-900"><div className={cx('text-2xl font-black', tone === 'rose' ? 'text-rose-600' : tone === 'green' ? 'text-emerald-700' : 'text-slate-900 dark:text-white')}>{value ?? '—'}</div><div className="text-xs text-slate-500">{label}</div></div>;
const Bar = ({ v, tone }) => <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700"><div className={cx('h-full', tone || (v < 50 ? 'bg-rose-500' : 'bg-emerald-600'))} style={{ width: `${Math.min(100, v || 0)}%` }} /></div>;
const err = (e, fb) => toast.error(e.response?.data?.error || fb);
const money = (n) => `${Number(n || 0).toLocaleString()} RWF`;
const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/* ------------------------------ analytics ------------------------------ */
function Analytics({ role }) {
  const [d, setD] = useState(null);
  useEffect(() => { api.get(role === 'STUDENT' ? '/v6/analytics/me' : '/v6/analytics/overview').then((r) => setD(r.data)).catch((e) => err(e, 'Could not load analytics')); }, [role]);
  if (!d) return <p className="py-10 text-center text-slate-500">Loading…</p>;
  if (role === 'STUDENT') return (
    <Box title="My performance">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Tile label="Average mark" value={d.average != null ? `${d.average}%` : null} /><Tile label="Course progress" value={d.progress != null ? `${d.progress}%` : null} /><Tile label="Attendance" value={d.attendance != null ? `${d.attendance}%` : null} /><Tile label="Class rank" value={d.rank ? `${d.rank} / ${d.outOf}` : null} /></div>
      {d.risks.length > 0 && <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><FaExclamationTriangle className="mt-0.5 shrink-0" /> Needs attention: {d.risks.join(', ')}. Talk to your trainer if you need help.</p>}
    </Box>
  );
  const s = d.summary;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5"><Tile label="Students" value={s.students} /><Tile label="Average" value={s.average != null ? `${s.average}%` : null} /><Tile label="Passing" value={s.passing} tone="green" /><Tile label="Failing" value={s.failing} tone="rose" /><Tile label="At risk" value={s.atRisk} tone="rose" /></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Box title="Students at risk" action={<button className={btnGhost} onClick={() => downloadCsv('/v6/analytics/overview?format=csv', 'student-performance.csv')}><FaFileCsv /> Weekly report (CSV)</button>}>
          {!d.atRisk.length ? <p className="text-sm text-slate-500">Nobody is at risk right now.</p> : <ul className="space-y-2">{d.atRisk.slice(0, 12).map((r) => <li key={r.id} className="rounded-lg bg-rose-50 p-2 text-xs dark:bg-rose-950/20"><b>{r.fullName}</b> <span className="text-slate-500">{r.className}</span><div className="text-rose-700">{r.risks.join(' · ')}{r.average != null && ` · avg ${r.average}%`}{r.attendance != null && ` · attendance ${r.attendance}%`}</div></li>)}</ul>}
        </Box>
        <Box title="Modules students find hard">
          {!d.hardModules.length ? <p className="text-sm text-slate-500">No quiz results yet.</p> : <ul className="space-y-3">{d.hardModules.map((m) => <li key={m.id} className="text-xs"><div className="flex justify-between"><span>{m.code} · {m.name}</span><b>{m.average}%</b></div><Bar v={m.average} /></li>)}</ul>}
        </Box>
      </div>
      <Box title="Top students"><ol className="grid gap-1 sm:grid-cols-2">{d.top.map((r, i) => <li key={r.id} className="flex justify-between rounded-lg bg-slate-50 p-2 text-xs dark:bg-gray-900"><span>{i + 1}. {r.fullName}</span><b>{r.average}%</b></li>)}{!d.top.length && <p className="text-sm text-slate-500">No marks yet.</p>}</ol></Box>
    </div>
  );
}

/* ------------------------------ practical skills ------------------------------ */
function Skills({ role, user }) {
  const staff = ['ADMIN', 'TRAINER'].includes(role);
  const [mods, setMods] = useState([]);
  const [rows, setRows] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [f, setF] = useState({ moduleId: '', code: '', title: '', criteria: '' });
  const [open, setOpen] = useState(null);
  const [checked, setChecked] = useState([]);
  const [comment, setComment] = useState('');
  const [file, setFile] = useState(null);
  const load = useCallback(async () => {
    try {
      if (staff) { const [c, m] = await Promise.all([api.get('/v6/competencies'), api.get('/learning/modules')]); setMods(m.data); setRows(c.data.map((x) => ({ ...x, status: null }))); }
      else { const r = await api.get('/v6/competencies/portfolio'); setRows(r.data.rows); setMods([{ total: r.data.total, competent: r.data.competent }]); }
    } catch (e) { err(e, 'Could not load skills'); }
  }, [staff]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (staff) api.get('/v6/analytics/overview').then((r) => setStudents(r.data.students)).catch(() => {}); }, [staff]);
  const add = async (e) => { e.preventDefault(); try { await api.post('/v6/competencies', f); toast.success('Competency added'); setF({ moduleId: '', code: '', title: '', criteria: '' }); load(); } catch (x) { err(x, 'Could not add'); } };
  const del = async (id) => { if (!window.confirm('Delete this competency and its assessments?')) return; try { await api.delete(`/v6/competencies/${id}`); load(); } catch (x) { err(x, 'Could not delete'); } };
  const save = async () => {
    if (!studentId) return toast.error('Choose a student first');
    try { const up = file ? await uploadFile(file) : null; await api.post(`/v6/competencies/${open.id}/assess`, { studentId, checked, comment, evidenceUrl: up?.url }); toast.success('Assessment saved'); setOpen(null); setChecked([]); setComment(''); setFile(null); }
    catch (x) { err(x, 'Could not save'); }
  };
  if (!staff) return (
    <Box title="My skills portfolio">
      <p className="mb-3 text-sm text-slate-500">Competent in <b>{mods[0]?.competent || 0}</b> of {mods[0]?.total || 0} competencies.</p>
      <ul className="space-y-2">{rows.map((r) => <li key={r.id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-gray-700"><div className="flex flex-wrap justify-between gap-2"><span className="font-bold">{r.code} · {r.title}</span><span className={cx('rounded-full px-2 py-0.5 text-xs font-bold', r.status === 'COMPETENT' ? 'bg-emerald-100 text-emerald-800' : r.status === 'NOT_YET' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600')}>{r.status === 'COMPETENT' ? 'Competent' : r.status === 'NOT_YET' ? 'Not yet competent' : 'Not assessed'}</span></div><p className="text-xs text-slate-500">{r.module} · {r.checked.length}/{r.criteria.length} criteria</p>{r.comment && <p className="mt-1 text-xs italic">{r.comment}</p>}{r.evidenceUrl && <a href={r.evidenceUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-700">View my evidence</a>}</li>)}{!rows.length && <p className="text-sm text-slate-500">Your trainer has not defined competencies yet.</p>}</ul>
    </Box>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Box title="New competency (checklist)">
        <form onSubmit={add} className="space-y-2">
          <select required className={inputCls} value={f.moduleId} onChange={(e) => setF({ ...f, moduleId: e.target.value })}><option value="">Module…</option>{mods.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}</select>
          <div className="grid grid-cols-3 gap-2"><input required className={inputCls} placeholder="Code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /><input required className={cx(inputCls, 'col-span-2')} placeholder="Competency title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <textarea required rows={5} className={inputCls} placeholder={'Performance criteria, one per line\nWears safety equipment\nUses the tool correctly'} value={f.criteria} onChange={(e) => setF({ ...f, criteria: e.target.value })} />
          <button className={btnPrimary}>Add competency</button>
        </form>
      </Box>
      <Box title="Assess a student">
        <select className={cx(inputCls, 'mb-3')} value={studentId} onChange={(e) => setStudentId(e.target.value)}><option value="">Choose student…</option>{students.map((s) => <option key={s.id} value={s.id}>{s.fullName} {s.className ? `(${s.className})` : ''}</option>)}</select>
        <ul className="space-y-2">{rows.map((c) => (
          <li key={c.id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-gray-700">
            <div className="flex items-start justify-between gap-2"><div><b>{c.code} · {c.title}</b><p className="text-xs text-slate-500">{c.module}</p></div><div className="flex gap-3 text-xs font-bold"><button onClick={() => { setOpen(open?.id === c.id ? null : c); setChecked([]); }} className="text-emerald-700">Assess</button>{(role === 'ADMIN' || c.createdById === user.id) && <button onClick={() => del(c.id)} className="text-rose-600"><FaTrash /></button>}</div></div>
            {open?.id === c.id && <div className="mt-2 space-y-1">{c.criteria.map((cr, i) => <label key={i} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={checked.includes(i)} onChange={(e) => setChecked(e.target.checked ? [...checked, i] : checked.filter((x) => x !== i))} /> {cr}</label>)}
              <textarea rows={2} className={cx(inputCls, 'mt-2 text-xs')} placeholder="Comment" value={comment} onChange={(e) => setComment(e.target.value)} />
              <label className="block text-xs text-slate-500">Photo / video / document of the practical work<input type="file" accept="image/*,video/mp4,video/webm,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-1 w-full text-xs" /></label>
              <button onClick={save} className={btnPrimary}>Save · {checked.length === c.criteria.length ? 'Competent' : 'Not yet competent'}</button></div>}
          </li>))}{!rows.length && <p className="text-sm text-slate-500">No competencies yet.</p>}</ul>
      </Box>
    </div>
  );
}

/* ------------------------------ internship logbook ------------------------------ */
const STARS = ['punctuality', 'skills', 'teamwork', 'attitude'];
function Logbook({ role }) {
  const [apps, setApps] = useState([]);
  const [sel, setSel] = useState(null);
  const [logs, setLogs] = useState([]);
  const [f, setF] = useState({ logDate: new Date().toISOString().slice(0, 10), hours: 8, activities: '' });
  const [ev, setEv] = useState({ punctuality: 4, skills: 4, teamwork: 4, attitude: 4, comment: '' });
  const reviewer = role !== 'STUDENT';
  const loadApps = useCallback(() => api.get('/v6/logbook/applications').then((r) => setApps(r.data)).catch((e) => err(e, 'Could not load internships')), []);
  useEffect(() => { loadApps(); }, [loadApps]);
  const open = async (a) => { setSel(a); setLogs([]); try { const [l, e] = await Promise.all([api.get(`/v6/logbook/${a.id}`), api.get(`/v6/logbook/${a.id}/evaluation`)]); setLogs(l.data); if (e.data) setEv({ punctuality: e.data.punctuality, skills: e.data.skills, teamwork: e.data.teamwork, attitude: e.data.attitude, comment: e.data.comment || '' }); } catch (x) { err(x, 'Could not open logbook'); } };
  const refresh = async () => { await loadApps(); if (sel) { const l = await api.get(`/v6/logbook/${sel.id}`); setLogs(l.data); } };
  const add = async (e) => { e.preventDefault(); try { await api.post(`/v6/logbook/${sel.id}`, f); toast.success('Entry saved'); setF({ ...f, activities: '' }); refresh(); } catch (x) { err(x, 'Could not save'); } };
  const review = async (id, status) => { const comment = status === 'REJECTED' ? window.prompt('Why is it rejected?') || '' : ''; try { await api.patch(`/v6/logbook/entry/${id}/review`, { status, comment }); refresh(); } catch (x) { err(x, 'Could not review'); } };
  const del = async (id) => { try { await api.delete(`/v6/logbook/entry/${id}`); refresh(); } catch (x) { err(x, 'Could not delete'); } };
  const evaluate = async () => { try { await api.post(`/v6/logbook/${sel.id}/evaluation`, ev); toast.success('Evaluation saved'); loadApps(); } catch (x) { err(x, 'Could not save'); } };
  return (
    <div className="grid gap-4 lg:grid-cols-[.8fr_1.4fr]">
      <Box title="Internships">
        <ul className="space-y-2">{apps.map((a) => <li key={a.id}><button onClick={() => open(a)} className={cx('w-full rounded-xl border p-3 text-left text-sm', sel?.id === a.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-gray-700')}><b>{a.internship.title}</b><span className="block text-xs text-slate-500">{a.internship.company}{reviewer && ` · ${a.student.fullName}`}</span><span className="text-[11px] text-slate-500">{a.logs} entries · {a.hours}h approved{a.pending > 0 && ` · ${a.pending} to review`}{a.evaluation && ' · evaluated'}</span></button></li>)}{!apps.length && <p className="text-sm text-slate-500">{reviewer ? 'No approved internships yet.' : 'Your logbook opens once an internship application is approved.'}</p>}</ul>
      </Box>
      <Box title={sel ? `Logbook: ${sel.internship.title}` : 'Logbook'}>
        {!sel ? <p className="text-sm text-slate-500">Choose an internship.</p> : <>
          {role === 'STUDENT' && ['APPROVED', 'IN_PROGRESS'].includes(sel.status) && <form onSubmit={add} className="mb-4 grid gap-2 sm:grid-cols-3"><input type="date" required className={inputCls} value={f.logDate} onChange={(e) => setF({ ...f, logDate: e.target.value })} /><input type="number" min="0.5" max="16" step="0.5" className={inputCls} value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} placeholder="Hours" /><button className={btnPrimary}>Add entry</button><textarea required rows={3} className={cx(inputCls, 'sm:col-span-3')} placeholder="What did you do today? What did you learn?" value={f.activities} onChange={(e) => setF({ ...f, activities: e.target.value })} /></form>}
          <ul className="space-y-2">{logs.map((l) => <li key={l.id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-gray-700"><div className="flex flex-wrap justify-between gap-2"><b>{new Date(l.logDate).toLocaleDateString()} · {l.hours}h</b><span className={cx('rounded-full px-2 py-0.5 text-xs font-bold', l.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : l.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800')}>{l.status}</span></div><p className="mt-1 whitespace-pre-wrap text-xs text-slate-600 dark:text-gray-300">{l.activities}</p>{l.reviewComment && <p className="mt-1 text-xs italic text-rose-700">{l.reviewComment}</p>}
            <div className="mt-2 flex gap-3 text-xs font-bold">{reviewer && l.status === 'SUBMITTED' && <><button onClick={() => review(l.id, 'APPROVED')} className="text-emerald-700"><FaCheckCircle className="inline" /> Approve</button><button onClick={() => review(l.id, 'REJECTED')} className="text-rose-600">Reject</button></>}{role === 'STUDENT' && l.status === 'SUBMITTED' && <button onClick={() => del(l.id)} className="text-rose-600"><FaTrash className="inline" /> Delete</button>}</div></li>)}{!logs.length && <p className="text-sm text-slate-500">No entries yet.</p>}</ul>
          {(reviewer || sel.evaluation) && <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-gray-900"><p className="mb-2 text-sm font-extrabold">Employer / supervisor evaluation</p><div className="grid grid-cols-2 gap-2">{STARS.map((k) => <label key={k} className="text-xs capitalize">{k} (1-5)<input type="number" min="1" max="5" disabled={!reviewer} className={inputCls} value={ev[k]} onChange={(e) => setEv({ ...ev, [k]: e.target.value })} /></label>)}</div><textarea rows={2} disabled={!reviewer} className={cx(inputCls, 'mt-2 text-xs')} placeholder="Feedback" value={ev.comment} onChange={(e) => setEv({ ...ev, comment: e.target.value })} />{reviewer && <button onClick={evaluate} className={cx(btnPrimary, 'mt-2')}>Save evaluation</button>}</div>}
        </>}
      </Box>
    </div>
  );
}

/* ------------------------------ fees ------------------------------ */
function Fees({ role }) {
  const admin = role === 'ADMIN';
  const [items, setItems] = useState([]);
  const [sum, setSum] = useState(null);
  const [mine, setMine] = useState(null);
  const [classes, setClasses] = useState([]);
  const [f, setF] = useState({ title: '', amount: '', dueDate: '', classGroupId: '' });
  const [p, setP] = useState({ studentId: '', feeItemId: '', amount: '', method: 'CASH', reference: '' });
  const load = useCallback(async () => {
    try {
      const it = await api.get('/v6/fees/items'); setItems(it.data);
      if (admin) { const [s, t] = await Promise.all([api.get('/v6/fees/summary'), api.get('/v6/timetable')]); setSum(s.data); setClasses(t.data.classes); }
      else { const m = await api.get('/v6/fees/mine'); setMine(m.data); }
    } catch (e) { err(e, 'Could not load fees'); }
  }, [admin]);
  useEffect(() => { load(); }, [load]);
  const addItem = async (e) => { e.preventDefault(); try { await api.post('/v6/fees/items', f); setF({ title: '', amount: '', dueDate: '', classGroupId: '' }); toast.success('Fee created'); load(); } catch (x) { err(x, 'Could not create'); } };
  const pay = async (e) => { e.preventDefault(); try { const r = await api.post('/v6/fees/payments', p); toast.success(`Receipt ${r.data.receiptNo}`); setP({ ...p, amount: '', reference: '' }); load(); } catch (x) { err(x, 'Could not record'); } };
  const remind = async () => { try { const r = await api.post('/v6/fees/remind'); toast.success(`${r.data.reminded} reminder(s) sent`); } catch (x) { err(x, 'Could not send'); } };
  const receipt = async (id) => {
    try {
      const { data: r } = await api.get(`/v6/fees/receipt/${id}`);
      const w = window.open('', '_blank'); if (!w) return toast.error('Allow pop-ups to print the receipt');
      const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      w.document.write(`<title>${esc(r.receiptNo)}</title><body style="font-family:sans-serif;max-width:420px;margin:30px auto"><h2>NTS Receipt</h2><p><b>${esc(r.receiptNo)}</b></p><p>Student: ${esc(r.student?.fullName)} ${esc(r.student?.className || '')}</p><p>For: ${esc(r.item)}</p><p>Amount: <b>${Number(r.amount).toLocaleString()} RWF</b> (${esc(r.method)})</p><p>Date: ${new Date(r.paidAt).toLocaleString()}</p></body>`);
      w.document.close(); w.print();
    } catch (x) { err(x, 'Could not open receipt'); }
  };
  if (!admin) return !mine ? <p className="py-10 text-center text-slate-500">Loading…</p> : (
    <div className="space-y-4">
      {mine.balances.map((b) => <Box key={b.student.id} title={b.student.fullName}><div className="grid grid-cols-3 gap-3"><Tile label="Due" value={money(b.due)} /><Tile label="Paid" value={money(b.paid)} tone="green" /><Tile label="Balance" value={money(b.balance)} tone={b.balance ? 'rose' : 'green'} /></div></Box>)}
      <Box title="Payments"><ul className="space-y-2">{mine.payments.map((x) => <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 text-xs dark:bg-gray-900"><span>{new Date(x.paidAt).toLocaleDateString()} · {x.item} · <b>{money(x.amount)}</b></span><button onClick={() => receipt(x.id)} className="font-bold text-blue-700"><FaPrint className="inline" /> {x.receiptNo}</button></li>)}{!mine.payments.length && <p className="text-sm text-slate-500">No payments yet.</p>}</ul></Box>
    </div>
  );
  return (
    <div className="space-y-4">
      {sum && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Tile label="Expected" value={money(sum.totals.due)} /><Tile label="Collected" value={money(sum.totals.paid)} tone="green" /><Tile label="Outstanding" value={money(sum.totals.balance)} tone="rose" /><Tile label="Students owing" value={sum.totals.withBalance} /></div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Box title="New fee"><form onSubmit={addItem} className="space-y-2"><input required className={inputCls} placeholder="Title (e.g. Term 1 tuition)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /><div className="grid grid-cols-2 gap-2"><input required type="number" min="1" className={inputCls} placeholder="Amount RWF" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /><input type="date" className={inputCls} value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></div><select className={inputCls} value={f.classGroupId} onChange={(e) => setF({ ...f, classGroupId: e.target.value })}><option value="">All students</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className={btnPrimary}>Create fee</button></form></Box>
        <Box title="Record a payment"><form onSubmit={pay} className="space-y-2"><select required className={inputCls} value={p.studentId} onChange={(e) => setP({ ...p, studentId: e.target.value })}><option value="">Student…</option>{sum?.rows.map((r) => <option key={r.student.id} value={r.student.id}>{r.student.fullName} · owes {money(r.balance)}</option>)}</select><select required className={inputCls} value={p.feeItemId} onChange={(e) => setP({ ...p, feeItemId: e.target.value })}><option value="">Fee…</option>{items.map((i) => <option key={i.id} value={i.id}>{i.title} · {money(i.amount)}</option>)}</select><div className="grid grid-cols-2 gap-2"><input required type="number" min="1" className={inputCls} placeholder="Amount" value={p.amount} onChange={(e) => setP({ ...p, amount: e.target.value })} /><select className={inputCls} value={p.method} onChange={(e) => setP({ ...p, method: e.target.value })}><option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile Money</option><option value="BANK">Bank</option></select></div><input className={inputCls} placeholder="Reference (optional)" value={p.reference} onChange={(e) => setP({ ...p, reference: e.target.value })} /><button className={btnPrimary}>Save payment & receipt</button></form></Box>
      </div>
      <Box title="Balances" action={<div className="flex gap-2"><button className={btnGhost} onClick={remind}>Send reminders</button><button className={btnGhost} onClick={() => downloadCsv('/v6/fees/summary?format=csv', 'fees-report.csv')}><FaFileCsv /> CSV</button></div>}>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-slate-500"><tr><th>Student</th><th>Due</th><th>Paid</th><th>Balance</th></tr></thead><tbody>{sum?.rows.slice(0, 100).map((r) => <tr key={r.student.id} className="border-t border-slate-100 dark:border-gray-700"><td className="py-1.5">{r.student.fullName}<span className="block text-[10px] text-slate-400">{r.student.className}</span></td><td>{money(r.due)}</td><td>{money(r.paid)}</td><td className={r.balance ? 'font-bold text-rose-600' : 'text-emerald-700'}>{money(r.balance)}{r.overdue && ' ⚠'}</td></tr>)}</tbody></table></div>
      </Box>
    </div>
  );
}

/* ------------------------------ timetable ------------------------------ */
function Timetable({ role }) {
  const admin = role === 'ADMIN';
  const [d, setD] = useState({ slots: [], classes: [] });
  const [trainers, setTrainers] = useState([]);
  const [cls, setCls] = useState('');
  const [f, setF] = useState({ classGroupId: '', day: 1, startTime: '08:00', endTime: '09:00', subject: '', trainerId: '', room: '' });
  const load = useCallback(() => api.get('/v6/timetable', { params: cls ? { classGroupId: cls, all: 1 } : {} }).then((r) => setD(r.data)).catch((e) => err(e, 'Could not load timetable')), [cls]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (admin) api.get('/admin/users', { params: { role: 'TRAINER', limit: 100 } }).then((r) => setTrainers((r.data.users || r.data || []).filter((u) => u.role === 'TRAINER'))).catch(() => {}); }, [admin]);
  const add = async (e) => { e.preventDefault(); try { await api.post('/v6/timetable', f); toast.success('Lesson added'); setF({ ...f, subject: '' }); load(); } catch (x) { err(x, 'Could not add'); } };
  const del = async (id) => { if (!window.confirm('Remove this lesson?')) return; try { await api.delete(`/v6/timetable/${id}`); load(); } catch (x) { err(x, 'Could not remove'); } };
  const byDay = useMemo(() => [1, 2, 3, 4, 5, 6, 7].map((n) => ({ n, slots: d.slots.filter((s) => s.day === n) })).filter((x) => x.slots.length), [d.slots]);
  return (
    <div className="space-y-4">
      {['ADMIN', 'TRAINER'].includes(role) && <select className={cx(inputCls, 'max-w-xs')} value={cls} onChange={(e) => setCls(e.target.value)}><option value="">{role === 'TRAINER' ? 'My lessons' : 'All classes'}</option>{d.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
      {admin && <Box title="Add a lesson"><form onSubmit={add} className="grid gap-2 sm:grid-cols-4"><select required className={inputCls} value={f.classGroupId} onChange={(e) => setF({ ...f, classGroupId: e.target.value })}><option value="">Class…</option>{d.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select className={inputCls} value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })}>{DAYS.slice(1).map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</select><input type="time" required className={inputCls} value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} /><input type="time" required className={inputCls} value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} /><input required className={inputCls} placeholder="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /><select className={inputCls} value={f.trainerId} onChange={(e) => setF({ ...f, trainerId: e.target.value })}><option value="">Trainer…</option>{trainers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select><input className={inputCls} placeholder="Room" value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} /><button className={btnPrimary}>Add</button></form><p className="mt-2 text-xs text-slate-500">Clashes of class, trainer or room are blocked automatically. Students and parents are notified of changes.</p></Box>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{byDay.map(({ n, slots }) => <Box key={n} title={DAYS[n]}><ul className="space-y-2">{slots.map((s) => <li key={s.id} className="rounded-lg bg-slate-50 p-2 text-xs dark:bg-gray-900"><b>{s.startTime}–{s.endTime}</b> · {s.subject}<span className="block text-slate-500">{[s.className, s.trainer, s.room && `Room ${s.room}`].filter(Boolean).join(' · ')}</span>{admin && <button onClick={() => del(s.id)} className="mt-1 font-bold text-rose-600"><FaTrash className="inline" /> Remove</button>}</li>)}</ul></Box>)}{!byDay.length && <p className="text-sm text-slate-500">No lessons on the timetable yet.</p>}</div>
    </div>
  );
}

/* ------------------------------ AI tutor ------------------------------ */
function Tutor({ role }) {
  const [q, setQ] = useState('');
  const [lang, setLang] = useState('rw');
  const [mode, setMode] = useState('explain');
  const [a, setA] = useState('');
  const [busy, setBusy] = useState(false);
  const ask = async (e) => { e.preventDefault(); setBusy(true); setA(''); try { const r = await api.post('/v6/ai/tutor', { question: q, language: lang, mode }); setA(r.data.answer); } catch (x) { err(x, 'AI is not available'); } setBusy(false); };
  return (
    <Box title="NTS AI learning assistant">
      <form onSubmit={ask} className="space-y-2">
        <div className="flex flex-wrap gap-2"><select className={cx(inputCls, 'w-auto')} value={lang} onChange={(e) => setLang(e.target.value)}><option value="rw">Kinyarwanda</option><option value="en">English</option><option value="fr">Français</option></select><select className={cx(inputCls, 'w-auto')} value={mode} onChange={(e) => setMode(e.target.value)}><option value="explain">Explain a topic</option><option value="quiz">Make practice questions</option>{role !== 'STUDENT' && <option value="lesson">Plan a lesson</option>}</select></div>
        <textarea required rows={3} className={inputCls} placeholder="Ask about a topic…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button disabled={busy} className={btnPrimary}>{busy ? 'Thinking…' : 'Ask'}</button>
      </form>
      {a && <div className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm dark:bg-gray-900">{a}</div>}
      <p className="mt-3 text-[11px] text-slate-500">The assistant helps you learn. It never gives marks or certificate decisions; check important answers with your trainer.</p>
    </Box>
  );
}

/* ------------------------------ page ------------------------------ */
export default function Campus() {
  const { user } = useAuthStore();
  const role = user?.role;
  const tabs = [
    ['analytics', 'Analytics', FaChartLine, ['ADMIN', 'TRAINER', 'STUDENT']],
    ['skills', 'Practical skills', FaTools, ['ADMIN', 'TRAINER', 'STUDENT']],
    ['logbook', 'Internship logbook', FaBook, ['ADMIN', 'TRAINER', 'STUDENT', 'EMPLOYER']],
    ['fees', 'Fees', FaMoneyBillWave, ['ADMIN', 'STUDENT', 'PARENT']],
    ['timetable', 'Timetable', FaCalendarAlt, ['ADMIN', 'TRAINER', 'STUDENT', 'PARENT']],
    ['tutor', 'AI assistant', FaRobot, ['ADMIN', 'TRAINER', 'STUDENT']],
  ].filter((t) => t[3].includes(role));
  const loc = useLocation();
  const navigate = useNavigate();
  const tab = (loc.hash || '').slice(1);
  const current = tabs.find((t) => t[0] === tab) ? tab : tabs[0]?.[0];
  const pick = (k) => navigate({ hash: `#${k}` }, { replace: true });
  return (
    <main className="mx-auto max-w-6xl px-3 py-6 sm:px-6">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white">Campus tools</h1>
      <p className="mb-4 text-sm text-slate-500">Performance, practical skills, internships, fees and timetable in one place.</p>
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">{tabs.map(([k, label, Icon]) => <button key={k} onClick={() => pick(k)} className={cx('inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold', current === k ? 'bg-emerald-700 text-white' : 'bg-white text-slate-600 shadow-sm dark:bg-gray-800 dark:text-gray-200')}><Icon /> {label}</button>)}</div>
      {current === 'analytics' && <Analytics role={role} />}
      {current === 'skills' && <Skills role={role} user={user} />}
      {current === 'logbook' && <Logbook role={role} />}
      {current === 'fees' && <Fees role={role} />}
      {current === 'timetable' && <Timetable role={role} />}
      {current === 'tutor' && <Tutor role={role} />}
    </main>
  );
}
