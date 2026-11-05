import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { FaAward, FaDownload, FaQuestionCircle, FaCrown, FaPlus, FaTrash, FaShareAlt, FaSearch, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import Modal from '../components/Modal';
import { btnPrimary, btnGhost, inputCls, cx, Badge } from '../components/ui';

const tone = (s) => (s === 'ACTIVE' || s === 'APPROVED' || s === 'ANSWERED' ? 'brand' : s === 'REJECTED' || s === 'REVOKED' ? 'rose' : 'amber');
const Section = ({ title, hint, children, action }) => (
  <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{title}</h2>{hint && <p className="text-xs text-slate-500 dark:text-gray-400">{hint}</p>}</div>{action}</div>
    {children}
  </section>
);

/* ---------------- issue certificate (replaces the old prompt() boxes) ---------------- */
function IssueModal({ request, kind, onClose, onDone }) {
  const [data, setData] = useState(null);
  const [rows, setRows] = useState([]);
  const [finalScore, setFinalScore] = useState('');
  const [sigIds, setSigIds] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [busy, setBusy] = useState(false);
  const isInternship = kind === 'internship';

  useEffect(() => {
    if (isInternship) { api.get('/certificates/marks-preview', { params: { studentId: request.studentId, moduleId: 0 } }).then((r) => { setData({ ...r.data, rows: [], finalScore: null }); }).catch(() => setData({ rows: [], signatories: [], templates: [] })); return; }
    api.get('/certificates/marks-preview', { params: { studentId: request.studentId, moduleId: request.moduleId } })
      .then((r) => { setData(r.data); setRows(r.data.rows); setFinalScore(r.data.finalScore ?? ''); setSigIds(r.data.signatories.map((s) => s.id)); setTemplateId(r.data.templates.find((t) => t.isDefault)?.id || ''); })
      .catch((e) => { toast.error(e.response?.data?.error || 'Could not load marks'); setData({ rows: [], signatories: [], templates: [] }); });
  }, [request, isInternship]);
  useEffect(() => { if (data && isInternship) { setSigIds(data.signatories.map((s) => s.id)); setTemplateId(data.templates.find((t) => t.isDefault)?.id || ''); } }, [data, isInternship]);

  const setRow = (i, k, v) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const body = { assessmentRows: rows.filter((r) => r.label && r.score !== ''), finalScore: finalScore === '' ? null : Number(finalScore), signatoryIds: sigIds, templateId: templateId || undefined };
      if (isInternship) await api.post('/certificates/issue/internship', { ...body, requestId: request.id });
      else await api.post('/certificates/issue/course', { ...body, studentId: request.studentId, moduleId: request.moduleId });
      toast.success('Certificate issued'); onDone(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Could not issue the certificate'); }
    setBusy(false);
  };
  const name = isInternship ? (request.student?.fullName || 'Student') : request.student?.fullName;
  const noSig = data && data.signatories.length === 0;

  return (
    <Modal title="Issue certificate" subtitle={`${name} · ${isInternship ? request.application?.internship?.title : request.module?.name}`} onClose={onClose} wide>
      {!data ? <p className="text-sm text-slate-500">Loading the marks from the system…</p> : (
        <form onSubmit={submit} className="space-y-5">
          {noSig && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">No authorized signatory yet. Admin: open <b>Certificate Settings → Approved signatories</b> and press <b>Authorize</b>.</p>}
          <div>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold text-slate-800 dark:text-white">Marks printed on the certificate</h3><button type="button" onClick={() => setRows([...rows, { label: '', score: '', max: 100 }])} className="text-xs font-bold text-emerald-700"><FaPlus className="inline" /> Add line</button></div>
            {!isInternship && <p className="mb-2 text-xs text-slate-500">These marks come from the student's graded assignments and quizzes. You can adjust them.</p>}
            {rows.length === 0 && <p className="text-sm text-slate-500">No marks yet. Add lines if you want marks on the certificate.</p>}
            <div className="space-y-2">{rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_80px_auto] items-center gap-2">
                <input className={inputCls} placeholder="e.g. Final exam" value={r.label} onChange={(e) => setRow(i, 'label', e.target.value)} />
                <input className={inputCls} type="number" min="0" placeholder="Score" value={r.score} onChange={(e) => setRow(i, 'score', e.target.value)} />
                <input className={inputCls} type="number" min="1" placeholder="Out of" value={r.max} onChange={(e) => setRow(i, 'max', e.target.value)} />
                <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-rose-500" aria-label="Remove"><FaTrash /></button>
              </div>))}</div>
          </div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-gray-200">Final result (%)<input className={cx(inputCls, 'mt-1 sm:w-40')} type="number" min="0" max="100" value={finalScore} onChange={(e) => setFinalScore(e.target.value)} placeholder="auto" /></label>
          {data.templates.length > 0 && <label className="block text-sm font-semibold text-slate-700 dark:text-gray-200">Design<select className={cx(inputCls, 'mt-1')} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>{data.templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>)}</select></label>}
          {data.signatories.length > 0 && (
            <div><h3 className="mb-2 text-sm font-bold text-slate-800 dark:text-white">Signed by</h3>
              {data.signatories.map((s) => (
                <label key={s.id} className="mb-1.5 flex items-center gap-2 text-sm text-slate-700 dark:text-gray-200"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={sigIds.includes(s.id)} onChange={(e) => setSigIds(e.target.checked ? [...sigIds, s.id] : sigIds.filter((x) => x !== s.id))} />{s.fullName} <span className="text-slate-400">· {s.title}</span></label>))}
            </div>)}
          <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className={btnGhost}>Cancel</button><button disabled={busy || noSig || sigIds.length === 0} className={btnPrimary}>{busy ? 'Issuing…' : 'Issue certificate'}</button></div>
        </form>
      )}
    </Modal>
  );
}

/* ---------------- approve / reject with a note ---------------- */
function ReviewModal({ item, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (status) => {
    setBusy(true);
    try { await api.patch(`/certificates/requests/${item.type}/${item.id}/review`, { status, note }); toast.success(`Request ${status.toLowerCase()}`); onDone(); onClose(); }
    catch (e) { toast.error(e.response?.data?.error || 'Review failed'); }
    setBusy(false);
  };
  return (
    <Modal title="Review request" subtitle={item.label} onClose={onClose} footer={<><button onClick={onClose} className={btnGhost}>Cancel</button><button disabled={busy} onClick={() => go('REJECTED')} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Reject</button><button disabled={busy} onClick={() => go('APPROVED')} className={btnPrimary}>Approve</button></>}>
      <label className="block text-sm font-semibold text-slate-700 dark:text-gray-200">Note for the student (optional)<textarea rows={3} className={cx(inputCls, 'mt-1')} value={note} onChange={(e) => setNote(e.target.value)} /></label>
    </Modal>
  );
}

export default function CertificateCenter() {
  const { user } = useAuthStore();
  const manager = ['ADMIN', 'TRAINER'].includes(user.role);
  const admin = user.role === 'ADMIN';
  const [mine, setMine] = useState({ courses: [], internships: [] });
  const [requests, setRequests] = useState({ courses: [], internships: [] });
  const [enrollments, setEnrollments] = useState([]);
  const [apps, setApps] = useState([]);
  const [plan, setPlan] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [issue, setIssue] = useState(null);
  const [review, setReview] = useState(null);
  const [q, setQ] = useState({ subject: '', message: '' });
  const [ref, setRef] = useState('');

  const load = useCallback(async () => {
    try {
      const reqs = [api.get('/certificates/mine'), api.get('/certificates/requests'), api.get('/support/questions')];
      if (!manager) reqs.push(api.get('/learning/enrollments'), api.get('/my-applications'), api.get('/certificates/plan'));
      const [m, r, qs, e, a, p] = await Promise.all(reqs);
      setMine(m.data); setRequests(r.data); setQuestions(qs.data);
      if (!manager) { setEnrollments(e.data.filter((x) => x.userId === user.id && x.progress >= 100 && x.status === 'COMPLETED')); setApps(a.data || []); setPlan(p.data); }
    } catch (err) { toast.error(err.response?.data?.error || 'Could not load certificates'); }
    setLoading(false);
  }, [manager, user.id]);
  useEffect(() => { load(); }, [load]);

  const requestCourse = async (moduleId) => { try { await api.post('/certificates/requests/course', { moduleId }); toast.success('Certificate request sent'); load(); } catch (e) { toast.error(e.response?.data?.error || 'Request failed'); if (e.response?.data?.code === 'PRO_REQUIRED') document.getElementById('pro-card')?.scrollIntoView({ behavior: 'smooth' }); } };
  const requestInternship = async (applicationId) => { try { await api.post('/certificates/requests/internship', { applicationId }); toast.success('Request sent'); load(); } catch (e) { toast.error(e.response?.data?.error || 'Request failed'); } };
  const open = async (type, id) => { const win = window.open('about:blank', '_blank'); try { const res = await api.get(`/certificates/${type}/${id}/print`, { responseType: 'blob' }); const url = URL.createObjectURL(new Blob([res.data], { type: 'text/html' })); if (win) win.location.href = url; else window.location.href = url; } catch (e) { if (win) win.close(); toast.error(e.response?.data?.error || e.response?.data || 'Could not open the certificate'); } };
  const ask = async (e) => { e.preventDefault(); try { await api.post('/support/questions', q); toast.success('Your question was sent to the admin'); setQ({ subject: '', message: '' }); load(); } catch (err) { toast.error(err.response?.data?.error || 'Could not send'); } };
  const sendPro = async (e) => { e.preventDefault(); try { await api.post('/support/pro-requests', { reference: ref }); toast.success('Sent. The admin will activate your Pro plan.'); setRef(''); load(); } catch (err) { toast.error(err.response?.data?.error || 'Could not send'); } };

  if (loading) return <div className="mx-auto max-w-6xl p-6 text-slate-500">Loading certificate center…</div>;
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-7">
      <header className="relative min-h-[9rem] overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950 via-blue-800 to-blue-600 p-6 text-white shadow-lg md:p-8">
        <img src="/images/v6-graduates.webp" alt="" className="absolute right-0 top-0 h-full w-3/5 object-cover sm:w-1/2" style={{ WebkitMaskImage: 'linear-gradient(to right, transparent, #000 45%)', maskImage: 'linear-gradient(to right, transparent, #000 45%)' }} />
        <div className="relative max-w-[65%]">
          <h1 className="flex items-center gap-3 text-2xl font-extrabold md:text-3xl"><FaAward className="text-yellow-300" /> Certificate <span className="text-yellow-300">Generation & Verification</span></h1>
          <p className="mt-2 text-sm text-blue-100">Get your certificate, download it, share it and verify its authenticity.</p>
        </div>
      </header>

      <VerifyPanel />

      {!manager && plan && (
        <section id="pro-card" className={cx('rounded-2xl border p-5', plan.isPro ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/10' : 'border-slate-200 bg-white dark:border-gray-700 dark:bg-gray-800')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900 dark:text-white"><FaCrown className="text-amber-500" /> {plan.isPro ? 'NTS Pro — unlimited certificates' : 'Free plan'}</h2>
              {!plan.isPro && <p className="text-sm text-slate-600 dark:text-gray-300">You have used <b>{plan.used}</b> of <b>{plan.limit}</b> free course certificates. Upgrade to NTS Pro to earn more.</p>}</div>
            {!plan.isPro && <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-amber-500" style={{ width: `${Math.min(100, (plan.used / Math.max(1, plan.limit)) * 100)}%` }} /></div>}
          </div>
          {!plan.isPro && (plan.pendingRequest ? <p className="mt-3 rounded-xl bg-sky-50 p-3 text-sm text-sky-800">Your Pro request is waiting for the admin.</p> : (
            <form onSubmit={sendPro} className="mt-3 space-y-2"><p className="text-sm text-slate-600 dark:text-gray-300">{plan.instructions}</p>
              <div className="flex flex-wrap gap-2"><input required className={cx(inputCls, 'sm:w-72')} placeholder="Payment reference" value={ref} onChange={(e) => setRef(e.target.value)} /><button className={btnPrimary}>Send payment reference</button></div></form>))}
        </section>
      )}

      {!manager && (
        <Section title="Completed courses" hint="Finish a course, then request your certificate.">
          {enrollments.length === 0 ? <p className="text-sm text-slate-500">No completed courses are ready for certification yet.</p> : <div className="divide-y divide-slate-100 dark:divide-gray-700">{enrollments.map((e) => {
            const request = requests.courses.find((r) => r.moduleId === e.moduleId); const issued = mine.courses.find((c) => c.moduleId === e.moduleId && c.status === 'ACTIVE');
            return <div key={e.id} className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center"><div><b className="text-slate-900 dark:text-white">{e.module?.name}</b><p className="text-xs text-slate-500">{e.module?.trade?.name} · {issued ? 'Certificate issued' : request ? `Request: ${request.status}${request.note ? ` — ${request.note}` : ''}` : 'Completed'}</p></div>
              {!issued && (!request || request.status === 'REJECTED') && <button onClick={() => requestCourse(e.moduleId)} className={btnPrimary}>Request certificate</button>}</div>; })}</div>}
        </Section>)}

      {!manager && (
        <Section title="Completed internships">
          {apps.filter((a) => a.status === 'COMPLETED').length === 0 ? <p className="text-sm text-slate-500">No completed internships are ready for certification.</p> : <div className="divide-y divide-slate-100 dark:divide-gray-700">{apps.filter((a) => a.status === 'COMPLETED').map((a) => {
            const request = requests.internships.find((r) => r.applicationId === a.id); const issued = mine.internships.find((c) => c.applicationId === a.id && c.status === 'ACTIVE');
            return <div key={a.id} className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center"><div><b className="text-slate-900 dark:text-white">{a.internship?.title}</b><p className="text-xs text-slate-500">{a.internship?.company} · {issued ? 'Certificate issued' : request ? `Request: ${request.status}` : 'Completed'}</p></div>
              {!issued && (!request || request.status === 'REJECTED') && <button onClick={() => requestInternship(a.id)} className={btnPrimary}>Request certificate</button>}</div>; })}</div>}
        </Section>)}

      <Section title="My certificates" hint={manager ? '' : 'Download your certificate as PDF or image, or print it.'}>
        {mine.courses.length + mine.internships.length === 0 ? <p className="text-sm text-slate-500">No certificates issued yet.</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {mine.courses.map((c) => <CertCard key={c.id} code={c.code} title={c.module?.name} sub={`${c.code} · ${new Date(c.issuedAt).toLocaleDateString()}`} status={c.status} onOpen={() => open('course', c.id)} />)}
            {mine.internships.map((c) => <CertCard key={c.id} code={c.code} title={c.internshipTitle} sub={`${c.company} · ${c.code}`} status={c.status} onOpen={() => (c.sourceFileUrl ? window.open(c.sourceFileUrl, '_blank', 'noopener') : open('internship', c.id))} file={Boolean(c.sourceFileUrl)} />)}
          </div>)}
      </Section>

      {admin && <div className="text-right"><a href="/admin/certificates" className={btnGhost}>Manage templates, signatories, questions & Pro →</a></div>}

      {manager && (<>
        <Section title="Course certificate requests">
          {requests.courses.length === 0 ? <p className="text-sm text-slate-500">No requests.</p> : <div className="space-y-3">{requests.courses.map((r) => (
            <div key={r.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-gray-700 lg:flex-row lg:items-center">
              <div><b className="text-slate-900 dark:text-white">{r.student?.fullName}</b><p className="text-sm text-slate-600 dark:text-gray-300">{r.module?.name} · {r.module?.trade?.name}</p><Badge tone={tone(r.status)}>{r.status.toLowerCase()}</Badge></div>
              {r.status === 'PENDING' && <button onClick={() => setReview({ type: 'course', id: r.id, label: `${r.student?.fullName} · ${r.module?.name}` })} className={btnPrimary}>Review</button>}
              {r.status === 'APPROVED' && r.certificate?.status !== 'ACTIVE' && <button onClick={() => setIssue({ kind: 'course', request: r })} className={btnPrimary}>Issue certificate</button>}
            </div>))}</div>}
        </Section>
        <Section title="Internship certificate requests">
          {requests.internships.length === 0 ? <p className="text-sm text-slate-500">No requests.</p> : <div className="space-y-3">{requests.internships.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-gray-700">
              <div><b className="text-slate-900 dark:text-white">{r.student?.fullName || 'Student'} · {r.application?.internship?.title || 'Internship'}</b><p className="text-xs text-slate-500">{r.application?.internship?.company}</p><Badge tone={tone(r.status)}>{r.status.toLowerCase()}</Badge></div>
              {admin && r.status === 'PENDING' && <button onClick={() => setReview({ type: 'internship', id: r.id, label: r.student?.fullName })} className={btnPrimary}>Review</button>}
              {admin && r.status === 'APPROVED' && r.certificate?.status !== 'ACTIVE' && <button onClick={() => setIssue({ kind: 'internship', request: r })} className={btnPrimary}>Issue certificate</button>}
            </div>))}</div>}
        </Section></>)}

      {!manager && (
        <Section title="Problem with a certificate?" hint="Ask the admin. You will get the answer here." action={<FaQuestionCircle className="text-slate-300" />}>
          <form onSubmit={ask} className="space-y-2"><input required className={inputCls} placeholder="Subject (e.g. wrong name on my certificate)" value={q.subject} onChange={(e) => setQ({ ...q, subject: e.target.value })} /><textarea required rows={3} className={inputCls} placeholder="Explain the problem" value={q.message} onChange={(e) => setQ({ ...q, message: e.target.value })} /><button className={btnPrimary}>Send to admin</button></form>
          <ul className="mt-4 space-y-3">{questions.map((x) => (
            <li key={x.id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-gray-700"><div className="flex items-center justify-between gap-2"><b className="text-slate-900 dark:text-white">{x.subject}</b><Badge tone={tone(x.status)}>{x.status.toLowerCase()}</Badge></div><p className="mt-1 text-slate-600 dark:text-gray-300">{x.message}</p>{x.reply && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100"><b>Admin:</b> {x.reply}</p>}</li>))}</ul>
        </Section>)}

      {issue && <IssueModal request={issue.request} kind={issue.kind} onClose={() => setIssue(null)} onDone={load} />}
      {review && <ReviewModal item={review} onClose={() => setReview(null)} onDone={load} />}
    </main>
  );
}

function VerifyPanel() {
  const [code, setCode] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const check = async (e) => {
    e.preventDefault(); const c = code.trim(); if (!c) return;
    setBusy(true); setRes(null);
    try { const r = await api.get(`/certificates/verify/${encodeURIComponent(c)}`); setRes(r.data); }
    catch (err) { setRes(err.response?.data || { valid: false, error: 'Could not verify' }); }
    setBusy(false);
  };
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="bg-gradient-to-r from-blue-800 to-blue-600 px-5 py-3 font-extrabold text-white">Verify Certificate</div>
      <div className="grid gap-4 p-5 md:grid-cols-2">
        <form onSubmit={check} className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-gray-300">Enter the Certificate ID printed on the certificate (or open its QR code) to check that it is genuine.</p>
          <input className={inputCls} placeholder="e.g. NTS-2026-001234" value={code} onChange={(e) => setCode(e.target.value)} />
          <button disabled={busy || !code.trim()} className={cx(btnPrimary, 'w-full justify-center')}><FaSearch /> {busy ? 'Checking…' : 'Verify Certificate'}</button>
        </form>
        <div>
          {!res && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-gray-900">The result will appear here.</p>}
          {res && (res.valid
            ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="flex items-center gap-2 text-lg font-extrabold"><FaCheckCircle className="text-emerald-600" /> Certificate is Valid!</p><p className="mt-2"><b>Student:</b> {res.student}</p><p><b>Course:</b> {res.program}</p>{res.company && <p><b>Company:</b> {res.company}</p>}<p><b>Issue date:</b> {res.issuedAt ? new Date(res.issuedAt).toLocaleDateString() : '—'}</p><p><b>Certificate ID:</b> {res.code}</p></div>
            : <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p className="flex items-center gap-2 text-lg font-extrabold"><FaTimesCircle /> {res.status === 'REVOKED' ? 'Certificate was revoked' : 'Certificate not valid'}</p><p className="mt-1">{res.message || res.error || 'No active certificate has this ID.'}</p></div>)}
        </div>
      </div>
    </section>
  );
}

const shareCert = async (code, title) => {
  const url = `${window.location.origin}/verify/${code}`;
  try {
    if (navigator.share) await navigator.share({ title: `${title} certificate`, text: 'My NTS certificate', url });
    else { await navigator.clipboard.writeText(url); toast.success('Verification link copied'); }
  } catch (e) { /* user cancelled */ }
};

function CertCard({ title, sub, status, onOpen, file, code }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-gray-700">
      <div className="flex justify-between gap-2"><b className="text-slate-900 dark:text-white">{title}</b><Badge tone={tone(status)}>{status.toLowerCase()}</Badge></div>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
      {status === 'ACTIVE' && <div className="mt-3 flex flex-wrap gap-2"><button onClick={onOpen} className={btnPrimary}><FaDownload /> {file ? 'Open certificate' : 'Download / Print'}</button>{code && <button onClick={() => shareCert(code, title)} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700"><FaShareAlt /> Share</button>}</div>}
    </div>
  );
}
