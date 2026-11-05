import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { FaBullhorn, FaPlus, FaTrash, FaThumbtack, FaTimes } from 'react-icons/fa';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Card, Badge, EmptyState, Skeleton, PageHeader, PRIORITY, btnPrimary, btnGhost, inputCls } from '../components/ui';
import { timeAgo, fmtDate, ROLE_LABEL } from '../services/format';

const ALL_AUDIENCES = [['ALL', 'Everyone'], ['STUDENT', 'Students'], ['TRAINER', 'Trainers'], ['PARENT', 'Parents'], ['EMPLOYER', 'Employers'], ['GUEST', 'Guests']];
const EMPTY = { title: '', body: '', audience: 'ALL', priority: 'NORMAL', pinned: false, expiresAt: '' };

const Announcements = () => {
  const { user } = useAuthStore();
  const canPost = ['ADMIN', 'TRAINER'].includes(user?.role);
  const audiences = user?.role === 'ADMIN' ? ALL_AUDIENCES : ALL_AUDIENCES.filter(([v]) => ['ALL', 'STUDENT', 'PARENT'].includes(v));
  const [items, setItems] = useState(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setItems((await api.get('/announcements')).data); }
    catch (e) { toast.error(e.response?.data?.error || 'Could not load announcements'); setItems([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) { toast.error('Add a title and a message'); return; }
    setSaving(true);
    try {
      await api.post('/announcements', { ...form, expiresAt: form.expiresAt || undefined });
      toast.success('Announcement published');
      setForm(EMPTY); setShow(false); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Could not publish'); }
    finally { setSaving(false); }
  };

  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    try { await api.delete(`/announcements/${a.id}`); toast.success('Deleted'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Could not delete'); }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <PageHeader icon={FaBullhorn} title="Announcements" subtitle="News and notices from the school"
        actions={canPost && <button onClick={() => setShow((s) => !s)} className={show ? btnGhost : btnPrimary}>{show ? <><FaTimes /> Close</> : <><FaPlus /> New announcement</>}</button>} />

      {show && (
        <Card className="mb-6 p-5 fade-in">
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <input className={`${inputCls} md:col-span-2`} placeholder="Title" maxLength={150} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea className={`${inputCls} md:col-span-2`} rows={4} placeholder="Write your message…" maxLength={5000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <label className="text-xs font-semibold text-slate-500 dark:text-gray-400">Audience
              <select className={`${inputCls} mt-1`} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>{audiences.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            <label className="text-xs font-semibold text-slate-500 dark:text-gray-400">Priority
              <select className={`${inputCls} mt-1`} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{Object.entries(PRIORITY).map(([v, p]) => <option key={v} value={v}>{p.label}</option>)}</select>
            </label>
            <label className="text-xs font-semibold text-slate-500 dark:text-gray-400">Hide after (optional)
              <input type="date" className={`${inputCls} mt-1`} value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            </label>
            {user?.role === 'ADMIN' && (
              <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-slate-700 dark:text-gray-200"><input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} className="h-4 w-4 rounded" /> Pin to the top</label>
            )}
            <div className="md:col-span-2"><button disabled={saving} className={btnPrimary}>{saving ? 'Publishing…' : 'Publish and notify'}</button></div>
          </form>
        </Card>
      )}

      {items === null && <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>}
      {items && items.length === 0 && <Card><EmptyState icon={FaBullhorn} title="No announcements yet" text={canPost ? 'Publish the first one with the button above.' : 'Check back later.'} /></Card>}
      <div className="space-y-4">
        {items?.map((a) => {
          const p = PRIORITY[a.priority] || PRIORITY.NORMAL;
          const mine = user?.role === 'ADMIN' || a.authorId === user?.id;
          return (
            <Card key={a.id} className={`border-l-4 p-5 fade-in ${p.border} ${a.expired ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">{a.pinned && <FaThumbtack className="text-nts-gold-500" title="Pinned" />}{a.title}</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">{a.author?.fullName || 'School'}{a.author?.role ? ` · ${ROLE_LABEL[a.author.role] || a.author.role}` : ''} · {timeAgo(a.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={p.tone}>{p.label}</Badge>
                  <Badge tone="brand">{a.audience === 'ALL' ? 'Everyone' : ROLE_LABEL[a.audience] || a.audience}</Badge>
                  {a.expired && <Badge tone="slate">Expired</Badge>}
                  {mine && <button onClick={() => remove(a)} aria-label="Delete announcement" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"><FaTrash size={13} /></button>}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-gray-300">{a.body}</p>
              {a.expiresAt && !a.expired && <p className="mt-3 text-xs text-slate-400">Visible until {fmtDate(a.expiresAt)}</p>}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Announcements;
