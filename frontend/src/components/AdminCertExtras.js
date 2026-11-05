// Admin tools for certificates: questions from students, NTS Pro requests + free limit, upload of
// internship certificates that students received outside the system.
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { uploadFile } from '../services/api';
import { Badge, btnPrimary, btnGhost, inputCls, cx } from './ui';

const Box = ({ title, hint, children }) => (
  <section className="rounded-xl border bg-white p-5"><h2 className="text-lg font-bold">{title}</h2>{hint && <p className="mb-3 mt-1 text-xs text-gray-500">{hint}</p>}{children}</section>
);
const tone = (s) => (s === 'APPROVED' || s === 'ANSWERED' ? 'brand' : s === 'REJECTED' ? 'rose' : 'amber');

export function QuestionsBox() {
  const [rows, setRows] = useState([]);
  const [reply, setReply] = useState({});
  const load = useCallback(() => api.get('/support/questions').then((r) => setRows(r.data)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const send = async (id) => { try { await api.put(`/support/questions/${id}/reply`, { reply: reply[id] }); toast.success('Reply sent'); setReply({ ...reply, [id]: '' }); load(); } catch (e) { toast.error(e.response?.data?.error || 'Could not reply'); } };
  return (
    <Box title="Certificate questions" hint="Students ask about problems with their certificates. Your answer appears in their Certificate Center.">
      {rows.length === 0 && <p className="text-sm text-gray-500">No questions yet.</p>}
      <div className="space-y-3">{rows.map((q) => (
        <div key={q.id} className="rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><b>{q.subject}</b><Badge tone={tone(q.status)}>{q.status.toLowerCase()}</Badge></div>
          <p className="text-xs text-gray-500">{q.student?.fullName} · {q.student?.email}</p>
          <p className="mt-1">{q.message}</p>
          {q.reply ? <p className="mt-2 rounded bg-emerald-50 p-2 text-emerald-900"><b>Your reply:</b> {q.reply}</p> : (
            <div className="mt-2 flex gap-2"><input className={inputCls} placeholder="Write your answer…" value={reply[q.id] || ''} onChange={(e) => setReply({ ...reply, [q.id]: e.target.value })} /><button disabled={!reply[q.id]?.trim()} onClick={() => send(q.id)} className={btnPrimary}>Reply</button></div>)}
        </div>))}</div>
    </Box>
  );
}

export function ProBox() {
  const [rows, setRows] = useState([]);
  const [limit, setLimit] = useState(3);
  const [instructions, setInstructions] = useState('');
  const load = useCallback(() => api.get('/support/pro-requests').then((r) => setRows(r.data)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const decide = async (id, action) => { try { await api.put(`/support/pro-requests/${id}`, { action }); toast.success(action === 'approve' ? 'Pro activated' : 'Rejected'); load(); } catch (e) { toast.error(e.response?.data?.error || 'Failed'); } };
  const save = async (e) => { e.preventDefault(); try { await api.put('/certificates/settings', { freeLimit: Number(limit), ...(instructions ? { instructions } : {}) }); toast.success('Saved'); } catch (err) { toast.error(err.response?.data?.error || 'Could not save'); } };
  return (
    <Box title="Free certificates and NTS Pro" hint="Students get a number of free course certificates. After that they need NTS Pro (paid). Approve a request after you received the payment.">
      <form onSubmit={save} className="mb-4 grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end">
        <label className="text-sm">Free certificates<input type="number" min="0" max="50" className={cx(inputCls, 'mt-1')} value={limit} onChange={(e) => setLimit(e.target.value)} /></label>
        <label className="text-sm">Payment instructions shown to students<input className={cx(inputCls, 'mt-1')} placeholder="e.g. Pay 5,000 RWF to MoMo 0788 000 000 and send the reference" value={instructions} onChange={(e) => setInstructions(e.target.value)} /></label>
        <button className={btnPrimary}>Save</button>
      </form>
      {rows.length === 0 && <p className="text-sm text-gray-500">No Pro requests.</p>}
      <div className="space-y-2">{rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span><b>{r.student?.fullName}</b> · ref <code>{r.reference}</code> {r.student?.isPro && <Badge tone="brand">pro</Badge>}</span>
          <span className="flex items-center gap-2"><Badge tone={tone(r.status)}>{r.status.toLowerCase()}</Badge>{r.status === 'PENDING' && <><button onClick={() => decide(r.id, 'approve')} className={btnPrimary}>Activate Pro</button><button onClick={() => decide(r.id, 'reject')} className={btnGhost}>Reject</button></>}</span>
        </div>))}</div>
    </Box>
  );
}

export function InternshipUploadBox({ onDone }) {
  const [students, setStudents] = useState([]);
  const [f, setF] = useState({ studentId: '', internshipTitle: '', company: '', startDate: '', endDate: '', finalScore: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/admin/users', { params: { role: 'STUDENT', limit: 200 } }).then((r) => setStudents(r.data.users || r.data || [])).catch(() => {}); }, []);
  const submit = async (e) => {
    e.preventDefault(); if (!file) return toast.error('Choose the certificate file (PDF or image)');
    setBusy(true);
    try { const up = await uploadFile(file); await api.post('/certificates/internship/upload', { ...f, sourceFileUrl: up.url }); toast.success('Internship certificate added for the student'); setF({ studentId: '', internshipTitle: '', company: '', startDate: '', endDate: '', finalScore: '' }); setFile(null); onDone?.(); }
    catch (err) { toast.error(err.response?.data?.error || 'Upload failed'); }
    setBusy(false);
  };
  return (
    <Box title="Upload a student's internship certificate" hint="For students who finished an internship: upload the certificate they received. No application is needed.">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <select required className={inputCls} value={f.studentId} onChange={(e) => setF({ ...f, studentId: e.target.value })}><option value="">Choose student</option>{students.map((s) => <option key={s.id} value={s.id}>{s.fullName} · {s.email}</option>)}</select>
        <input required className={inputCls} placeholder="Internship title" value={f.internshipTitle} onChange={(e) => setF({ ...f, internshipTitle: e.target.value })} />
        <input required className={inputCls} placeholder="Company" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
        <input className={inputCls} type="number" min="0" max="100" placeholder="Final result % (optional)" value={f.finalScore} onChange={(e) => setF({ ...f, finalScore: e.target.value })} />
        <label className="text-xs text-gray-500">Start date<input type="date" className={cx(inputCls, 'mt-1')} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></label>
        <label className="text-xs text-gray-500">End date<input type="date" className={cx(inputCls, 'mt-1')} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></label>
        <label className="text-sm sm:col-span-2">Certificate file<input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-sm" /></label>
        <div className="sm:col-span-2"><button disabled={busy} className={btnPrimary}>{busy ? 'Uploading…' : 'Add certificate'}</button></div>
      </form>
    </Box>
  );
}
