// Admin: decide which classes each trainer teaches, and what each trainer may edit.
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FaChalkboardTeacher, FaSave } from 'react-icons/fa';
import api from '../services/api';
import { Card, CardHeader, Skeleton, EmptyState, PageHeader, btnPrimary } from '../components/ui';

export default function AdminTeaching() {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState('');
  const load = useCallback(() => api.get('/admin/teaching').then((r) => {
    setData(r.data);
    setDraft(Object.fromEntries(r.data.trainers.map((t) => [t.id, { classIds: t.classIds, canEditInternships: t.canEditInternships, canEditEvents: t.canEditEvents }])));
  }).catch((e) => { toast.error(e.response?.data?.error || 'Could not load'); setData({ trainers: [], classes: [] }); }), []);
  useEffect(() => { load(); }, [load]);

  const toggleClass = (tid, cid) => setDraft((d) => { const cur = d[tid].classIds; return { ...d, [tid]: { ...d[tid], classIds: cur.includes(cid) ? cur.filter((x) => x !== cid) : [...cur, cid] } }; });
  const flag = (tid, k) => setDraft((d) => ({ ...d, [tid]: { ...d[tid], [k]: !d[tid][k] } }));
  const save = async (tid) => { setSaving(tid); try { await api.put(`/admin/teaching/${tid}`, draft[tid]); toast.success('Saved'); load(); } catch (e) { toast.error(e.response?.data?.error || 'Could not save'); } setSaving(''); };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <PageHeader icon={FaChalkboardTeacher} title="Teaching assignments" subtitle="Give each trainer their classes. A trainer only sees the students, joins and notes of those classes." />
      {!data && <Skeleton className="h-48" />}
      {data && data.trainers.length === 0 && <Card><EmptyState icon={FaChalkboardTeacher} title="No trainers yet" text="Create trainer accounts in the Admin panel first." /></Card>}
      <div className="space-y-4">
        {data?.trainers.map((t) => (
          <Card key={t.id}>
            <CardHeader title={t.fullName} subtitle={`${t.email}${t.department ? ` · ${t.department}` : ''}`} action={<button disabled={saving === t.id} onClick={() => save(t.id)} className={btnPrimary}><FaSave /> {saving === t.id ? 'Saving…' : 'Save'}</button>} />
            <div className="px-5 pb-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Classes this trainer teaches</p>
              {data.classes.length === 0 ? <p className="text-sm text-slate-500">No classes yet. They appear when students register.</p> : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data.classes.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 p-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={draft[t.id]?.classIds.includes(c.id)} onChange={() => toggleClass(t.id, c.id)} /><span className="min-w-0 truncate">{c.department} · {c.name}<span className="ml-1 text-xs text-slate-400">({c._count.members})</span></span></label>))}</div>)}
              {draft[t.id]?.classIds.length === 0 && <p className="mt-2 text-xs text-amber-600">No class selected: this trainer currently sees every student (or the ones of their own department).</p>}
              <div className="mt-4 flex flex-wrap gap-5 border-t border-slate-100 pt-4 text-sm dark:border-gray-700">
                <label className="flex items-center gap-2 text-slate-700 dark:text-gray-200"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={draft[t.id]?.canEditInternships || false} onChange={() => flag(t.id, 'canEditInternships')} /> Can post and edit internships</label>
                <label className="flex items-center gap-2 text-slate-700 dark:text-gray-200"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={draft[t.id]?.canEditEvents || false} onChange={() => flag(t.id, 'canEditEvents')} /> Can edit the school calendar</label>
              </div>
            </div>
          </Card>))}
      </div>
    </div>
  );
}
