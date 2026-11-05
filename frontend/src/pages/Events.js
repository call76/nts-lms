import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FaCalendarAlt, FaMapMarkerAlt, FaPlus, FaTrash } from 'react-icons/fa';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Card, CardHeader, Badge, EmptyState, Skeleton, PageHeader, btnPrimary, btnGhost, inputCls } from '../components/ui';

const AUD = ['ALL', 'STUDENT', 'TRAINER', 'PARENT', 'EMPLOYER', 'GUEST'];

const DateChip = ({ iso }) => {
  const d = new Date(iso);
  return (
    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-nts-green-50 text-nts-green-700 dark:bg-nts-green-900/40 dark:text-nts-green-200">
      <span className="text-[10px] font-bold uppercase">{d.toLocaleString('en', { month: 'short' })}</span>
      <span className="text-xl font-extrabold leading-none">{d.getDate()}</span>
    </div>
  );
};

const Events = () => {
  const { user } = useAuthStore();
  const staff = user.role === 'ADMIN' || (user.role === 'TRAINER' && user.canEditEvents);
  const [data, setData] = useState(null);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ title: '', description: '', location: '', startsAt: '', audience: 'ALL' });
  const load = () => api.get('/school/events').then((r) => setData(r.data)).catch(() => setData({ upcoming: [], past: [] }));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try { await api.post('/school/events', f); toast.success('Event published'); setShow(false); setF({ title: '', description: '', location: '', startsAt: '', audience: 'ALL' }); load(); } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };
  const remove = async (id) => { if (!window.confirm('Delete this event?')) return; await api.delete(`/school/events/${id}`).catch(() => toast.error('Not allowed')); load(); };

  const list = (rows, past) => rows.map((ev) => (
    <li key={ev.id} className={`flex gap-4 p-4 ${past ? 'opacity-60' : ''}`}>
      <DateChip iso={ev.startsAt} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-900 dark:text-white">{ev.title}</h3><Badge tone={ev.audience === 'ALL' ? 'brand' : 'violet'}>{ev.audience === 'ALL' ? 'Everyone' : ev.audience.toLowerCase()}</Badge></div>
        {ev.description && <p className="mt-0.5 text-sm text-slate-600 dark:text-gray-300">{ev.description}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-gray-400"><span><FaCalendarAlt className="mr-1 inline" />{new Date(ev.startsAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>{ev.location && <span><FaMapMarkerAlt className="mr-1 inline" />{ev.location}</span>}</p>
      </div>
      {staff && (user.role === 'ADMIN' || ev.createdById === user.id) && <button onClick={() => remove(ev.id)} className="self-start text-slate-400 hover:text-rose-500" aria-label="Delete"><FaTrash /></button>}
    </li>
  ));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <PageHeader icon={FaCalendarAlt} title="School calendar" subtitle="Meetings, quizzes, open days and more" actions={staff && <button onClick={() => setShow(!show)} className={btnPrimary}><FaPlus /> New event</button>} />
      {show && (
        <Card className="mb-6">
          <CardHeader title="New event" />
          <form onSubmit={create} className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
            <input className={`${inputCls} sm:col-span-2`} placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
            <input type="datetime-local" className={inputCls} value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} required />
            <input className={inputCls} placeholder="Location" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
            <select className={inputCls} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>{AUD.map((a) => <option key={a} value={a}>{a === 'ALL' ? 'Everyone' : a.toLowerCase()}</option>)}</select>
            <textarea className={`${inputCls} sm:col-span-2`} rows={2} placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            <div className="flex gap-2 sm:col-span-2"><button className={btnPrimary}>Publish</button><button type="button" onClick={() => setShow(false)} className={btnGhost}>Cancel</button></div>
          </form>
        </Card>
      )}
      {!data && <Skeleton className="h-40" />}
      {data && (
        <>
          <Card><CardHeader title="Upcoming" />{data.upcoming.length === 0 ? <EmptyState icon={FaCalendarAlt} title="Nothing planned" /> : <ul className="divide-y divide-slate-100 dark:divide-gray-700">{list(data.upcoming, false)}</ul>}</Card>
          {data.past.length > 0 && <Card className="mt-6"><CardHeader title="Past events" /><ul className="divide-y divide-slate-100 dark:divide-gray-700">{list(data.past, true)}</ul></Card>}
        </>
      )}
    </div>
  );
};

export default Events;
