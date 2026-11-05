// Attendance: teachers mark a class and write remarks; students and parents see charts and notes.
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FaCalendarCheck, FaTrash } from 'react-icons/fa';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Card, CardHeader, Badge, BarChart, StackedBar, StatCard, Skeleton, EmptyState, PageHeader, btnPrimary, inputCls, cx } from '../components/ui';
import { fmtDate } from '../services/format';
import { StudentCheckIn, StaffSessions, Excuses } from '../components/OnlineAttendance';

const STATUS = [
  { v: 'PRESENT', label: 'Present', on: 'bg-emerald-600 text-white', tone: 'brand' },
  { v: 'LATE', label: 'Late', on: 'bg-amber-500 text-white', tone: 'amber' },
  { v: 'EXCUSED', label: 'Excused', on: 'bg-sky-500 text-white', tone: 'sky' },
  { v: 'ABSENT', label: 'Absent', on: 'bg-rose-600 text-white', tone: 'rose' },
];
const remarkTone = { PRAISE: 'brand', CONCERN: 'rose', NOTE: 'slate' };
const today = () => new Date().toISOString().slice(0, 10);

export const AttendanceCharts = ({ data }) => {
  if (!data) return <Skeleton className="h-48" />;
  const t = data.totals;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader title="Attendance rate" subtitle="Last 6 months, % of days attended" />
        <div className="px-5 pb-5"><BarChart items={data.byMonth} height={140} /></div>
      </Card>
      <Card>
        <CardHeader title="Days by status" subtitle={data.counted ? `${data.counted} recorded days` : 'No records yet'} />
        <div className="px-5 pb-5"><StackedBar items={[{ label: 'Present', value: t.PRESENT }, { label: 'Late', value: t.LATE }, { label: 'Excused', value: t.EXCUSED }, { label: 'Absent', value: t.ABSENT }]} /></div>
      </Card>
    </div>
  );
};

const Remarks = ({ rows, canDelete, onDelete }) => (
  <Card>
    <CardHeader title="Teacher remarks" />
    <ul className="space-y-3 px-5 pb-5">
      {(!rows || rows.length === 0) && <li className="text-sm text-slate-500">No remarks yet.</li>}
      {rows?.map((r) => (
        <li key={r.id} className="flex items-start justify-between gap-3 text-sm">
          <div><Badge tone={remarkTone[r.type]}>{r.type === 'PRAISE' ? 'Praise' : r.type === 'CONCERN' ? 'Concern' : 'Note'}</Badge> <span className="text-slate-700 dark:text-gray-200">{r.content}</span><p className="text-xs text-slate-400">{r.trainer?.fullName} · {fmtDate(r.createdAt)}</p></div>
          {canDelete && <button onClick={() => onDelete(r.id)} className="text-slate-400 hover:text-rose-500" aria-label="Delete remark"><FaTrash /></button>}
        </li>
      ))}
    </ul>
  </Card>
);

const StaffView = () => {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState(null);
  const [saving, setSaving] = useState(false);
  const [remark, setRemark] = useState({ studentId: '', type: 'NOTE', content: '' });
  const [remarks, setRemarks] = useState([]);

  useEffect(() => { api.get('/school/attendance/classes').then((r) => { setClasses(r.data); if (r.data[0]) setClassId(r.data[0].id); }).catch(() => {}); }, []);
  const loadRows = useCallback(() => {
    if (!classId) return;
    setRows(null);
    api.get(`/school/attendance/class/${classId}`, { params: { date } }).then((r) => setRows(r.data)).catch(() => setRows([]));
  }, [classId, date]);
  useEffect(() => { loadRows(); }, [loadRows]);
  useEffect(() => { if (remark.studentId) api.get('/family/remarks', { params: { studentId: remark.studentId } }).then((r) => setRemarks(r.data)).catch(() => {}); else setRemarks([]); }, [remark.studentId]);

  const setStatus = (id, status) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  const markAll = (status) => setRows((rs) => rs.map((r) => ({ ...r, status })));
  const save = async () => {
    const records = rows.filter((r) => r.status).map((r) => ({ studentId: r.id, status: r.status, note: r.note }));
    if (!records.length) return toast.error('Mark at least one student');
    setSaving(true);
    try { await api.post('/school/attendance/mark', { date, records }); toast.success('Attendance saved. Parents of absent students were notified.'); } catch (e) { toast.error(e.response?.data?.error || 'Could not save'); }
    setSaving(false);
  };
  const addRemark = async (e) => {
    e.preventDefault();
    try { await api.post('/family/remarks', remark); toast.success('Remark sent to the student and parents'); setRemark({ ...remark, content: '' }); const r = await api.get('/family/remarks', { params: { studentId: remark.studentId } }); setRemarks(r.data); } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };
  const delRemark = async (id) => { await api.delete(`/family/remarks/${id}`).catch(() => {}); setRemarks((r) => r.filter((x) => x.id !== id)); };

  const counts = rows ? STATUS.map((s) => ({ label: s.label, value: rows.filter((r) => r.status === s.v).length })) : [];
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Mark attendance" subtitle="Choose a class and a day" />
        <div className="flex flex-wrap gap-3 px-5 pb-4">
          <select className={cx(inputCls, 'sm:w-72')} value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.length === 0 && <option value="">No classes yet</option>}
            {classes.map((c) => <option key={c.id} value={c.id}>{c.department || 'Class'} · {c.name}</option>)}
          </select>
          <input type="date" className={cx(inputCls, 'sm:w-48')} value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          <button onClick={() => markAll('PRESENT')} className="rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-gray-600 dark:text-gray-300">All present</button>
        </div>
        <div className="px-5 pb-5">
          {rows === null && <Skeleton className="h-32" />}
          {rows && rows.length === 0 && <EmptyState icon={FaCalendarCheck} title="No students in this class" text="Students join a class when they register with a department and class name." />}
          <ul className="divide-y divide-slate-100 dark:divide-gray-700">
            {rows?.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-sm font-medium text-slate-800 dark:text-gray-100">{r.fullName}</span>
                <span className="flex gap-1.5">
                  {STATUS.map((s) => <button key={s.v} onClick={() => setStatus(r.id, s.v)} className={cx('rounded-lg px-2.5 py-1 text-xs font-semibold transition', r.status === s.v ? s.on : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-700 dark:text-gray-300')}>{s.label}</button>)}
                </span>
              </li>
            ))}
          </ul>
          {rows && rows.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">{counts.map((c) => `${c.label}: ${c.value}`).join(' · ')}</p>
              <button onClick={save} disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Save attendance'}</button>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="Write a remark" subtitle="Seen by the student and their parents" />
          <form onSubmit={addRemark} className="space-y-3 px-5 pb-5">
            <select className={inputCls} value={remark.studentId} onChange={(e) => setRemark({ ...remark, studentId: e.target.value })} required>
              <option value="">Choose a student</option>
              {(rows || []).map((r) => <option key={r.id} value={r.id}>{r.fullName}</option>)}
            </select>
            <select className={inputCls} value={remark.type} onChange={(e) => setRemark({ ...remark, type: e.target.value })}>
              <option value="PRAISE">Praise</option><option value="NOTE">Note</option><option value="CONCERN">Concern</option>
            </select>
            <textarea className={inputCls} rows={3} placeholder="Remark" value={remark.content} onChange={(e) => setRemark({ ...remark, content: e.target.value })} required />
            <button className={btnPrimary}>Send remark</button>
          </form>
        </Card>
        <Remarks rows={remarks} canDelete onDelete={delRemark} />
      </div>
    </div>
  );
};

const FamilyView = ({ role }) => {
  const [children, setChildren] = useState(null);
  const [studentId, setStudentId] = useState(role === 'STUDENT' ? 'me' : '');
  const [data, setData] = useState(null);
  const [remarks, setRemarks] = useState([]);

  useEffect(() => {
    if (role !== 'PARENT') return;
    api.get('/parents/children').then((r) => { setChildren(r.data); if (r.data[0]) setStudentId(r.data[0].id); else setChildren([]); }).catch(() => setChildren([]));
  }, [role]);
  useEffect(() => {
    if (!studentId) return;
    setData(null);
    api.get(`/school/attendance/student/${studentId}`).then((r) => setData(r.data)).catch(() => setData({ totals: { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 }, byMonth: [], recent: [], counted: 0, rate: null }));
    api.get('/family/remarks', { params: { studentId } }).then((r) => setRemarks(r.data)).catch(() => setRemarks([]));
  }, [studentId]);

  if (role === 'PARENT' && children && children.length === 0) return <Card><EmptyState icon={FaCalendarCheck} title="No child linked yet" text="Your child must approve your request, or ask the administrator to link you." /></Card>;
  return (
    <div className="space-y-6">
      {role === 'PARENT' && children && children.length > 1 && (
        <select className={cx(inputCls, 'sm:w-72')} value={studentId} onChange={(e) => setStudentId(e.target.value)}>{children.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}</select>
      )}
      {data && <div className="grid gap-4 sm:grid-cols-4">
        <StatCard icon={FaCalendarCheck} label="Attendance" value={data.rate == null ? '—' : `${data.rate}%`} tone={data.rate != null && data.rate < 75 ? 'rose' : 'brand'} />
        <StatCard label="Present" value={data.totals.PRESENT} tone="brand" />
        <StatCard label="Late / Excused" value={data.totals.LATE + data.totals.EXCUSED} tone="amber" />
        <StatCard label="Absent" value={data.totals.ABSENT} tone="rose" />
      </div>}
      <AttendanceCharts data={data} />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="Recent days" />
          <ul className="space-y-2 px-5 pb-5 text-sm">
            {data?.recent?.length === 0 && <li className="text-slate-500">No records yet.</li>}
            {data?.recent?.map((r) => <li key={r.id} className="flex items-center justify-between"><span className="text-slate-600 dark:text-gray-300">{fmtDate(r.date)}{r.note ? ` · ${r.note}` : ''}</span><span className="flex items-center gap-2">{r.joinedAt && <span className="text-xs text-slate-400">joined {new Date(r.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}<Badge tone={STATUS.find((s) => s.v === r.status)?.tone}>{r.status.toLowerCase()}</Badge></span></li>)}
          </ul>
        </Card>
        <Remarks rows={remarks} />
      </div>
    </div>
  );
};

const SHARE_KINDS = [['MARKS', 'Marks'], ['CERTIFICATES', 'Certificates'], ['ATTENDANCE', 'Full attendance']];
const ShareWithParents = () => {
  const [rows, setRows] = useState(null);
  const load = useCallback(() => api.get('/parents/share-list').then((r) => setRows(r.data)).catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);
  const toggle = async (studentId, kind, enabled) => {
    setRows((rs) => rs.map((r) => (r.studentId === studentId ? { ...r, shared: { ...r.shared, [kind]: enabled } } : r)));
    try { await api.put('/parents/share', { studentId, kind, enabled }); } catch (e) { toast.error(e.response?.data?.error || 'Not allowed'); load(); }
  };
  return (
    <Card>
      <CardHeader title="What parents can see" subtitle="Parents always see which modules their child studies. Marks, certificates and the full attendance are shown only when you switch them on." />
      <div className="px-5 pb-5">
        {rows === null && <Skeleton className="h-24" />}
        {rows && rows.length === 0 && <EmptyState icon={FaCalendarCheck} title="No linked parents yet" text="When a student approves a parent request, they appear here." />}
        <ul className="divide-y divide-slate-100 dark:divide-gray-700">
          {rows?.map((r) => (
            <li key={r.studentId} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="text-sm font-semibold text-slate-900 dark:text-white">{r.studentName}{r.className ? ` · ${r.className}` : ''}</p><p className="text-xs text-slate-500">Parents: {r.parents.join(', ')}</p></div>
              <div className="flex flex-wrap gap-4">{SHARE_KINDS.map(([k, label]) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-gray-200"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={Boolean(r.shared[k])} onChange={(e) => toggle(r.studentId, k, e.target.checked)} />{label}</label>))}</div>
            </li>))}
        </ul>
      </div>
    </Card>
  );
};

const Attendance = () => {
  const { user } = useAuthStore();
  const staff = ['TRAINER', 'ADMIN'].includes(user.role);
  const tabs = staff
    ? [['online', 'Online class'], ['manual', 'Manual & remarks'], ['share', 'Parents\' access'], ['excuses', 'Excuses']]
    : user.role === 'STUDENT' ? [['checkin', 'Check in'], ['record', 'My record'], ['excuses', 'Excuses']] : [['record', 'Record'], ['excuses', 'Excuses']];
  const [tab, setTab] = useState(tabs[0][0]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <PageHeader icon={FaCalendarCheck} title="Attendance & Remarks" subtitle={staff ? 'Open online-class attendance, verify it, and decide who receives it' : 'Check in to online classes and follow the attendance record'} />
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-gray-800">
        {tabs.map(([k, label]) => <button key={k} onClick={() => setTab(k)} className={cx('whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition', tab === k ? 'bg-white text-nts-green-700 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-slate-600 dark:text-gray-300')}>{label}</button>)}
      </div>
      {tab === 'online' && <StaffSessions />}
      {tab === 'manual' && <StaffView />}
      {tab === 'share' && <ShareWithParents />}
      {tab === 'checkin' && <StudentCheckIn />}
      {tab === 'record' && <FamilyView role={user.role} />}
      {tab === 'excuses' && <Excuses />}
    </div>
  );
};

export default Attendance;
