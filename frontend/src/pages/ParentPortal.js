import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaChild, FaAward, FaClipboardCheck, FaQuestionCircle, FaComments, FaCalendarCheck } from 'react-icons/fa';
import api from '../services/api';
import { Card, CardHeader, Badge, ProgressBar, Avatar, EmptyState, Skeleton, PageHeader, BarChart, StackedBar, btnPrimary, btnGhost } from '../components/ui';
import { fmtDate } from '../services/format';

const pctTone = (p) => (p >= 70 ? 'brand' : p >= 50 ? 'amber' : 'rose');

const Child = ({ c }) => {
  const progress = c.enrollments.length ? Math.round(c.enrollments.reduce((a, e) => a + e.progress, 0) / c.enrollments.length) : 0;
  return (
    <Card className="overflow-hidden fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-nts-green-50 to-transparent p-5 dark:border-gray-700 dark:from-nts-green-900/20">
        <div className="flex items-center gap-4">
          <Avatar name={c.fullName} size={56} />
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{c.fullName}</h2>
            <p className="text-sm text-slate-500 dark:text-gray-400">{[c.className, c.department, c.school].filter(Boolean).join(' · ')}</p>
            <Badge tone="slate" className="mt-1">{c.relationship}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/family?student=${c.id}`} className={btnPrimary}><FaComments /> Talk to a teacher{c.openThreads ? ` (${c.openThreads})` : ''}</Link>
          <Link to="/attendance" className={btnGhost}><FaCalendarCheck /> Attendance</Link>
        </div>
        <div className="w-full sm:w-56">
          <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500 dark:text-gray-400"><span>Overall progress</span><span>{progress}%</span></div>
          <ProgressBar value={progress} />
        </div>
      </div>

      <div className="grid gap-6 border-b border-slate-100 p-5 dark:border-gray-700 md:grid-cols-3">
        <section>
          <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-white">Course progress (%)</h3>
          {c.enrollments.length === 0 ? <p className="text-sm text-slate-500">No courses yet.</p> : <BarChart items={c.enrollments.map((e) => ({ label: e.module?.code || '—', value: e.progress }))} height={110} />}
        </section>
        <section>
          <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-white">Quiz scores (%)</h3>
          {!c.shared?.MARKS ? <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-gray-800">🔒 Marks have not been shared by the teacher yet.</p> : c.quizAttempts.length === 0 ? <p className="text-sm text-slate-500">No quizzes yet.</p> : <BarChart tone="blue" items={[...c.quizAttempts].reverse().map((q, i) => ({ label: `Q${i + 1}`, value: q.total ? Math.round((q.score / q.total) * 100) : 0 }))} height={110} />}
        </section>
        <section>
          <h3 className="mb-3 flex items-center justify-between text-sm font-bold text-slate-800 dark:text-white"><span>Attendance</span><span className="text-xs font-semibold text-slate-500">{c.attendance?.rate == null ? 'no records' : `${c.attendance.rate}%`}</span></h3>
          {c.attendance?.counted ? <StackedBar items={[{ label: 'Present', value: c.attendance.totals.PRESENT }, { label: 'Late', value: c.attendance.totals.LATE }, { label: 'Excused', value: c.attendance.totals.EXCUSED }, { label: 'Absent', value: c.attendance.totals.ABSENT }]} /> : <p className="text-sm text-slate-500">Attendance has not been recorded yet.</p>}
        </section>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-2">
        <section>
          <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-white">Modules your child studies</h3>
          {c.enrollments.length === 0 && <p className="text-sm text-slate-500">Not enrolled in any course yet.</p>}
          <div className="space-y-3">
            {c.enrollments.map((e, i) => (
              <div key={i}>
                <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate text-slate-700 dark:text-gray-200">{e.module?.name}</span><span className="shrink-0 text-xs font-semibold text-slate-500">{e.progress}%</span></div>
                <ProgressBar value={e.progress} tone={e.progress >= 100 ? 'brand' : 'blue'} />
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white"><FaClipboardCheck className="text-slate-400" /> Recent assignments</h3>
          {c.assignmentSubmissions.length === 0 && <p className="text-sm text-slate-500">No submissions yet.</p>}
          <ul className="space-y-2">
            {c.assignmentSubmissions.map((s, i) => {
              const pct = s.score == null ? null : Math.round((s.score / (s.assignment?.maxScore || 100)) * 100);
              return (
                <li key={i} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-slate-700 dark:text-gray-200">{s.assignment?.title}</span>
                  {pct == null ? <Badge tone="slate">Awaiting grade</Badge> : <Badge tone={pctTone(pct)}>{s.score}/{s.assignment?.maxScore}</Badge>}
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white"><FaQuestionCircle className="text-slate-400" /> Recent quizzes</h3>
          {c.quizAttempts.length === 0 && <p className="text-sm text-slate-500">No quiz attempts yet.</p>}
          <ul className="space-y-2">
            {c.quizAttempts.map((q, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500 dark:text-gray-400">{fmtDate(q.createdAt)}</span>
                <Badge tone={q.passed ? 'brand' : 'rose'}>{q.score}/{q.total} · {q.passed ? 'Passed' : 'Not passed'}</Badge>
              </li>
            ))}
          </ul>
        </section>

        <section className="md:col-span-2">
          <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-white">Teacher remarks</h3>
          {(!c.remarks || c.remarks.length === 0) && <p className="text-sm text-slate-500">No remarks yet.</p>}
          <ul className="space-y-2">
            {c.remarks?.map((r) => <li key={r.id} className="text-sm"><Badge tone={r.type === 'PRAISE' ? 'brand' : r.type === 'CONCERN' ? 'rose' : 'slate'}>{r.type.toLowerCase()}</Badge> <span className="text-slate-700 dark:text-gray-200">{r.content}</span> <span className="text-xs text-slate-400">— {r.trainer?.fullName}</span></li>)}
          </ul>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white"><FaAward className="text-slate-400" /> Certificates</h3>
          {c.certificates.length === 0 && <p className="text-sm text-slate-500">No certificates yet.</p>}
          <ul className="space-y-2">
            {c.certificates.map((x) => (
              <li key={x.code} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-slate-700 dark:text-gray-200">{x.module?.name}</span>
                <Badge tone={x.status === 'ACTIVE' ? 'brand' : 'amber'}>{x.status === 'ACTIVE' ? fmtDate(x.issuedAt) : x.status}</Badge>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Card>
  );
};

const ParentPortal = () => {
  const [children, setChildren] = useState(null);
  const [pending, setPending] = useState([]);
  useEffect(() => { api.get('/parents/requests').then((r) => setPending(r.data)).catch(() => {}); }, []);
  useEffect(() => { api.get('/parents/children').then((r) => setChildren(r.data)).catch(() => setChildren([])); }, []);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <PageHeader icon={FaChild} title="Parent Portal" subtitle="Follow how your children are doing" />
      {children === null && <div className="space-y-4"><Skeleton className="h-64" /></div>}
      {pending.length > 0 && <Card className="mb-4 border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/10 dark:text-amber-200">Waiting for approval from: {pending.map((x) => x.student?.fullName).join(', ')}. Your child approves the request in their Parents & Teachers page.</Card>}
      {children && children.length === 0 && <Card><CardHeader title="No student linked yet" /><EmptyState icon={FaChild} title="Nothing to show" text="Ask your child to approve your request, or ask the school administrator to link your account." /></Card>}
      <div className="space-y-6">{children?.map((c) => <Child key={c.id} c={c} />)}</div>
    </div>
  );
};

export default ParentPortal;
