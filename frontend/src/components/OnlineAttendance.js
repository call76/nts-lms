// Online-class attendance UI: student check-in, trainer sessions + verification, absence excuses.
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FaVideo, FaCheckCircle, FaExclamationTriangle, FaDownload, FaLock, FaPlus } from 'react-icons/fa';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Card, CardHeader, Badge, EmptyState, Skeleton, btnPrimary, btnGhost, inputCls, cx } from './ui';
import { fmtDate } from '../services/format';

const err = (e, f = 'Something went wrong') => toast.error(e.response?.data?.error || f);
const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
const statusTone = { OPEN: 'brand', CLOSED: 'amber', VERIFIED: 'blue', PENDING: 'amber', APPROVED: 'brand', REJECTED: 'rose' };

/* ------------------------------- student ------------------------------- */
export const StudentCheckIn = () => {
  const [rows, setRows] = useState(null);
  const [codes, setCodes] = useState({});
  const load = useCallback(() => api.get('/school/sessions').then((r) => setRows(r.data)).catch(() => setRows([])), []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const checkIn = async (id) => {
    try { await api.post(`/school/sessions/${id}/checkin`, { code: codes[id] || '' }); toast.success('Checked in! Your teacher will verify it.'); load(); } catch (e) { err(e, 'Check-in failed'); }
  };
  if (!rows) return <Skeleton className="h-40" />;
  if (!rows.length) return <Card><EmptyState icon={FaVideo} title="No online classes yet" text="When your teacher opens attendance for an online class, it appears here. Enter the code shown in class to check in." /></Card>;
  return (
    <div className="space-y-4">
      {rows.map((s) => (
        <Card key={s.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">{s.title}</h3>
              <p className="text-xs text-slate-500 dark:text-gray-400">{fmtDate(s.startsAt, true)}{s.open ? ` · check-in open until ${clock(s.opensUntil)}` : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              {s.meetingLink && s.open && <a href={s.meetingLink} target="_blank" rel="noreferrer" className={btnGhost}><FaVideo /> Join class</a>}
              <Badge tone={s.checkedInAt ? 'brand' : s.open ? 'amber' : 'slate'}>{s.checkedInAt ? `Checked in ${clock(s.checkedInAt)}` : s.open ? 'Open' : 'Closed'}</Badge>
            </div>
          </div>
          {s.open && !s.checkedInAt && (
            <div className="mt-4 flex flex-wrap gap-2">
              <input className={cx(inputCls, 'sm:w-56')} inputMode="numeric" maxLength={5} placeholder="Code from your teacher" value={codes[s.id] || ''} onChange={(e) => setCodes({ ...codes, [s.id]: e.target.value })} />
              <button onClick={() => checkIn(s.id)} className={btnPrimary}><FaCheckCircle /> Check in</button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};

/* ------------------------------- trainer / admin ------------------------------- */
const csv = (title, rows) => {
  const lines = [['Student', 'Checked in', 'Minutes after start', 'Counted as'], ...rows.map((r) => [r.fullName, r.checkedInAt ? clock(r.checkedInAt) : 'no check-in', r.minutesAfterStart ?? '', r.attended ? (r.late ? 'Late' : 'Present') : 'Absent'])];
  const blob = new Blob([lines.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `attendance-${title.replace(/\W+/g, '-').toLowerCase()}.csv`; a.click();
};

const Review = ({ id, onDone }) => {
  const [data, setData] = useState(null);
  const [attended, setAttended] = useState({});
  const [shareParents, setShareParents] = useState(false);
  const [shareAdmin, setShareAdmin] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get(`/school/sessions/${id}`).then((r) => {
    setData(r.data);
    setAttended((prev) => { const next = { ...prev }; r.data.students.forEach((s) => { if (next[s.id] === undefined) next[s.id] = Boolean(s.checkedInAt) && s.decision !== 'REJECTED'; }); return next; });
    if (r.data.session.status === 'VERIFIED') { setShareParents(r.data.session.sharedWithParents); setShareAdmin(r.data.session.sharedWithAdmin); }
  }).catch((e) => err(e, 'Could not load the session')), [id]);
  useEffect(() => { load(); const t = setInterval(() => { if (!busy) load(); }, 10000); return () => clearInterval(t); }, [load, busy]);

  if (!data) return <Skeleton className="h-40" />;
  const { session, students } = data;
  const rows = students.map((s) => ({ ...s, attended: Boolean(attended[s.id]) && Boolean(s.checkedInAt) }));
  const present = rows.filter((r) => r.attended).length;
  const suspicious = rows.filter((r) => r.suspicious).length;

  const verify = async () => {
    setBusy(true);
    try {
      const decisions = students.filter((s) => s.checkedInAt).map((s) => ({ studentId: s.id, attended: Boolean(attended[s.id]) }));
      const r = await api.post(`/school/sessions/${id}/verify`, { decisions, shareWithParents: shareParents, shareWithAdmin: shareAdmin });
      toast.success(`Verified: ${r.data.result.present + r.data.result.late} attended, ${r.data.result.absent} absent`);
      onDone();
    } catch (e) { err(e, 'Could not verify'); }
    setBusy(false);
  };
  const close = async () => { try { await api.post(`/school/sessions/${id}/close`); toast.success('Check-in closed'); load(); } catch (e) { err(e); } };

  return (
    <Card className="mt-3 border-nts-green-200 p-5 dark:border-nts-green-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white">{session.title}</h3>
          <p className="text-xs text-slate-500 dark:text-gray-400">{session.class?.department} · {session.class?.name} · {present} of {students.length} counted as present{suspicious ? ` · ${suspicious} to double-check` : ''}</p>
        </div>
        {session.code && session.status === 'OPEN' && (
          <div className="rounded-xl bg-nts-green-50 px-4 py-2 text-center dark:bg-nts-green-900/30"><p className="text-[10px] font-semibold uppercase text-slate-500">Show this code in class</p><p className="font-mono text-2xl font-extrabold tracking-widest text-nts-green-700 dark:text-nts-green-200">{session.code}</p></div>
        )}
      </div>

      <ul className="mt-4 divide-y divide-slate-100 dark:divide-gray-700">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 dark:text-gray-100">{r.fullName}</p>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                {r.checkedInAt ? `Checked in ${clock(r.checkedInAt)} (${r.minutesAfterStart} min after start)` : 'Did not check in → absent'}
                {r.late && !r.suspicious && ' · late'}
              </p>
              {r.suspicious && <p className="flex items-center gap-1 text-xs font-semibold text-amber-600"><FaExclamationTriangle /> Checked in very late — was this student really in class?</p>}
            </div>
            {r.checkedInAt ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(attended[r.id])} onChange={(e) => setAttended({ ...attended, [r.id]: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
                <span className={attended[r.id] ? 'font-semibold text-emerald-700 dark:text-emerald-300' : 'text-rose-600'}>{attended[r.id] ? 'Attended' : 'Did not attend'}</span>
              </label>
            ) : <Badge tone="rose">Absent</Badge>}
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-xl bg-slate-50 p-4 dark:bg-gray-900/40">
        <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-white">Who receives this result?</p>
        <label className="mb-1.5 flex items-start gap-2 text-sm text-slate-700 dark:text-gray-300"><input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-600" checked={shareParents} onChange={(e) => setShareParents(e.target.checked)} /><span>Parents — each parent is told if their child attended, the time they joined, or that they were absent</span></label>
        <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-gray-300"><input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-600" checked={shareAdmin} onChange={(e) => setShareAdmin(e.target.checked)} /><span>Admin — a summary report appears in the admin's attendance page</span></label>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><FaLock /> If neither is ticked, only you and the student see this record.</p>
      </div>

      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          <button onClick={() => csv(session.title, rows)} className={btnGhost}><FaDownload /> CSV</button>
          {session.status === 'OPEN' && <button onClick={close} className={btnGhost}>Close check-in</button>}
        </div>
        <button onClick={verify} disabled={busy} className={btnPrimary}><FaCheckCircle /> {session.status === 'VERIFIED' ? 'Update & re-send' : 'Verify attendance'}</button>
      </div>
    </Card>
  );
};

export const StaffSessions = () => {
  const { user } = useAuthStore();
  const [classes, setClasses] = useState([]);
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ classGroupId: '', title: '', meetingLink: '', windowMinutes: 30 });

  const load = useCallback(() => api.get('/school/sessions').then((r) => setRows(r.data)).catch(() => setRows([])), []);
  useEffect(() => { load(); api.get('/school/attendance/classes').then((r) => { setClasses(r.data); setF((x) => ({ ...x, classGroupId: r.data[0]?.id || '' })); }).catch(() => {}); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    try { const r = await api.post('/school/sessions', f); toast.success('Attendance is open. Students were notified.'); setShow(false); setF({ ...f, title: '' }); await load(); setOpen(r.data.id); } catch (x) { err(x, 'Could not open attendance'); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Online class attendance" subtitle="Open a session, show the code in your online class, then verify who really attended." action={<button onClick={() => setShow(!show)} className={btnPrimary}><FaPlus /> New session</button>} />
        {show && (
          <form onSubmit={create} className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
            <select className={inputCls} value={f.classGroupId} onChange={(e) => setF({ ...f, classGroupId: e.target.value })} required>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.department || 'Class'} · {c.name}</option>)}
            </select>
            <input className={inputCls} placeholder="Title (e.g. Databases - normalisation)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
            <input className={inputCls} placeholder="Meeting link (Meet / Zoom / Teams) — optional" value={f.meetingLink} onChange={(e) => setF({ ...f, meetingLink: e.target.value })} />
            <select className={inputCls} value={f.windowMinutes} onChange={(e) => setF({ ...f, windowMinutes: e.target.value })}>
              {[10, 15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>Check-in open for {m} minutes</option>)}
            </select>
            <div className="sm:col-span-2"><button className={btnPrimary}>Open attendance</button></div>
          </form>
        )}
      </Card>

      {!rows && <Skeleton className="h-32" />}
      {rows && rows.length === 0 && <Card><EmptyState icon={FaVideo} title="No sessions yet" text="Create one when your online class starts." /></Card>}
      {rows?.map((s) => (
        <div key={s.id}>
          <button onClick={() => setOpen(open === s.id ? null : s.id)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900 dark:text-white">{s.title}</p>
              <p className="text-xs text-slate-500 dark:text-gray-400">{s.class?.department} · {s.class?.name} · {fmtDate(s.startsAt, true)}{user.role === 'ADMIN' && s.trainer ? ` · ${s.trainer.fullName}` : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="slate">{s.checkinCount} checked in</Badge>
              {s.sharedWithParents && <Badge tone="violet">parents</Badge>}
              {s.sharedWithAdmin && <Badge tone="sky">admin</Badge>}
              <Badge tone={statusTone[s.status]}>{s.status.toLowerCase()}</Badge>
            </div>
          </button>
          {open === s.id && <Review id={s.id} onDone={() => { load(); }} />}
        </div>
      ))}
    </div>
  );
};

/* ------------------------------- excuses ------------------------------- */
export const Excuses = () => {
  const { user } = useAuthStore();
  const staff = ['TRAINER', 'ADMIN'].includes(user.role);
  const [rows, setRows] = useState(null);
  const [children, setChildren] = useState([]);
  const [f, setF] = useState({ studentId: '', date: new Date().toISOString().slice(0, 10), reason: '' });
  const load = useCallback(() => api.get('/school/excuses').then((r) => setRows(r.data)).catch(() => setRows([])), []);
  useEffect(() => {
    load();
    if (user.role === 'PARENT') api.get('/parents/children').then((r) => { setChildren(r.data); setF((x) => ({ ...x, studentId: r.data[0]?.id || '' })); }).catch(() => {});
  }, [load, user.role]);

  const submit = async (e) => {
    e.preventDefault();
    try { await api.post('/school/excuses', f); toast.success('Excuse sent to the teachers'); setF({ ...f, reason: '' }); load(); } catch (x) { err(x); }
  };
  const decide = async (id, action) => { try { await api.put(`/school/excuses/${id}`, { action }); load(); } catch (x) { err(x); } };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {!staff && (
        <Card>
          <CardHeader title="Explain an absence" subtitle="A teacher will approve or reject it. Approved days count as excused." />
          <form onSubmit={submit} className="space-y-3 px-5 pb-5">
            {user.role === 'PARENT' && (
              <select className={inputCls} value={f.studentId} onChange={(e) => setF({ ...f, studentId: e.target.value })} required>
                {children.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
              </select>
            )}
            <input type="date" className={inputCls} value={f.date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setF({ ...f, date: e.target.value })} required />
            <textarea className={inputCls} rows={3} placeholder="Reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required />
            <button className={btnPrimary}>Send</button>
          </form>
        </Card>
      )}
      <Card className={staff ? 'md:col-span-2' : ''}>
        <CardHeader title={staff ? 'Excuse requests' : 'My requests'} />
        <ul className="divide-y divide-slate-100 px-5 pb-3 dark:divide-gray-700">
          {rows === null && <li className="py-3"><Skeleton className="h-10" /></li>}
          {rows?.length === 0 && <li className="py-6 text-center text-sm text-slate-500">Nothing here yet.</li>}
          {rows?.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div className="min-w-0"><p className="font-medium text-slate-800 dark:text-gray-100">{r.studentName} · {fmtDate(r.date)}</p><p className="text-slate-500 dark:text-gray-400">{r.reason}</p></div>
              <div className="flex items-center gap-2">
                <Badge tone={statusTone[r.status]}>{r.status.toLowerCase()}</Badge>
                {staff && r.status === 'PENDING' && <><button onClick={() => decide(r.id, 'approve')} className={btnPrimary}>Approve</button><button onClick={() => decide(r.id, 'reject')} className={btnGhost}>Reject</button></>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};
