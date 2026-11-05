// Video meetings between students, trainers and the admin (Jitsi Meet rooms).
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FaVideo, FaPlus, FaUsers, FaCheckCircle } from 'react-icons/fa';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import Modal from '../components/Modal';
import { Card, Badge, EmptyState, Skeleton, PageHeader, btnPrimary, btnGhost, inputCls, cx } from '../components/ui';

const when = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const toLocalInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function CreateModal({ onClose, onDone }) {
  const { user } = useAuthStore();
  const staff = ['TRAINER', 'ADMIN'].includes(user.role);
  const [people, setPeople] = useState([]);
  const [classes, setClasses] = useState([]);
  const [q, setQ] = useState('');
  const [f, setF] = useState({ title: '', description: '', startsAt: toLocalInput(new Date()), classGroupId: '', invitedIds: [] });
  const [busy, setBusy] = useState(false);
  useEffect(() => { const t = setTimeout(() => api.get('/meetings/people', { params: { q } }).then((r) => { setPeople(r.data.people); setClasses(r.data.classes); }).catch(() => {}), 250); return () => clearTimeout(t); }, [q]);
  const toggle = (id) => setF((x) => ({ ...x, invitedIds: x.invitedIds.includes(id) ? x.invitedIds.filter((i) => i !== id) : [...x.invitedIds, id] }));
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post('/meetings', { ...f, startsAt: new Date(f.startsAt).toISOString() }); toast.success('Meeting created. Invited people were notified.'); onDone(); onClose(); }
    catch (err) { toast.error(err.response?.data?.error || 'Could not create the meeting'); }
    setBusy(false);
  };
  return (
    <Modal title="New meeting" subtitle="A video room is created automatically." onClose={onClose} wide>
      <form onSubmit={save} className="space-y-4">
        <input required className={inputCls} placeholder="Meeting title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input required type="datetime-local" className={inputCls} value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} />
          {staff && <select className={inputCls} value={f.classGroupId} onChange={(e) => setF({ ...f, classGroupId: e.target.value })}><option value="">Invite a whole class (optional)</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.department} · {c.name}</option>)}</select>}
        </div>
        <textarea rows={2} className={inputCls} placeholder="What is the meeting about? (optional)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <div>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold text-slate-800 dark:text-white">Invite people ({f.invitedIds.length})</h3><input className={cx(inputCls, '!w-48 !py-1.5')} placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 dark:divide-gray-700 dark:border-gray-700">
            {people.length === 0 && <p className="p-3 text-sm text-slate-500">No people found.</p>}
            {people.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-3 p-2.5 text-sm text-slate-700 dark:text-gray-200"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={f.invitedIds.includes(p.id)} onChange={() => toggle(p.id)} />{p.fullName}<Badge tone={p.role === 'STUDENT' ? 'slate' : p.role === 'TRAINER' ? 'blue' : 'amber'}>{p.role.toLowerCase()}</Badge>{p.className && <span className="text-xs text-slate-400">{p.className}</span>}</label>))}
          </div>
        </div>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className={btnGhost}>Cancel</button><button disabled={busy} className={btnPrimary}>{busy ? 'Creating…' : 'Create meeting'}</button></div>
      </form>
    </Modal>
  );
}

export default function Meetings() {
  const { user } = useAuthStore();
  const [rows, setRows] = useState(null);
  const [show, setShow] = useState(false);
  const load = useCallback(() => api.get('/meetings').then((r) => setRows(r.data)).catch(() => setRows([])), []);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const join = async (m) => {
    const win = window.open('about:blank', '_blank');
    try { const r = await api.post(`/meetings/${m.id}/join`); const url = `${r.data.url}#userInfo.displayName="${encodeURIComponent(r.data.displayName)}"`; if (win) win.location.href = url; else window.location.href = url; load(); }
    catch (e) { if (win) win.close(); toast.error(e.response?.data?.error || 'Could not join'); }
  };
  const end = async (m) => { if (!window.confirm('End this meeting for everybody?')) return; try { await api.post(`/meetings/${m.id}/end`); load(); } catch (e) { toast.error(e.response?.data?.error || 'Not allowed'); } };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <PageHeader icon={FaVideo} title="Meetings" subtitle="Video meetings with your teachers, classmates and the school admin"
        actions={<button onClick={() => setShow(true)} className={btnPrimary}><FaPlus /> New meeting</button>} />
      {rows === null && <Skeleton className="h-40" />}
      {rows && rows.length === 0 && <Card><EmptyState icon={FaVideo} title="No meetings yet" text="Create one and invite people. They get a notification and can join with one click." /></Card>}
      <div className="space-y-3">
        {rows?.map((m) => (
          <Card key={m.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-900 dark:text-white">{m.title}</h3><Badge tone={m.status === 'LIVE' ? 'rose' : 'blue'}>{m.status === 'LIVE' ? '● live' : 'scheduled'}</Badge>{m.joined && <Badge tone="brand"><FaCheckCircle className="mr-1 inline" />joined</Badge>}</div>
                <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">{when(m.startsAt)} · hosted by {m.hostName || 'a teacher'} · <FaUsers className="mr-1 inline" />{m.joinedCount} joined</p>
                {m.description && <p className="mt-2 text-sm text-slate-600 dark:text-gray-300">{m.description}</p>}
                {m.joinedNames?.length > 0 && <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">In the meeting: {m.joinedNames.join(', ')}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => join(m)} className={btnPrimary}><FaVideo /> {m.joined ? 'Rejoin' : 'Join'}</button>
                {(m.hostId === user.id || user.role === 'ADMIN') && <button onClick={() => end(m)} className={btnGhost}>End</button>}
              </div>
            </div>
          </Card>))}
      </div>
      {show && <CreateModal onClose={() => setShow(false)} onDone={load} />}
    </div>
  );
}
