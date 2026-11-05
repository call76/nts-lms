import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FaSearch, FaPlus, FaDownload, FaEye, FaTrash, FaEdit, FaBookReader, FaEyeSlash } from 'react-icons/fa';
import api from '../services/api';
import { asset } from '../services/assets';
import { useAuthStore } from '../store/authStore';
import PageHero from '../components/PageHero';
import Modal from '../components/Modal';
import { FileQueue, ACCEPT, fileIcon, fmtSize } from '../components/FileDrop';
import { Card, Badge, EmptyState, Skeleton, btnPrimary, btnGhost, inputCls, cx } from '../components/ui';

const VIEWABLE = /\.(pdf|png|jpe?g|webp|mp4|webm|mov|mp3|wav|m4a|txt)$/i;
const TINTS = ['from-blue-600 to-blue-800', 'from-emerald-500 to-emerald-700', 'from-violet-500 to-violet-700', 'from-amber-500 to-orange-600', 'from-rose-500 to-rose-700', 'from-cyan-500 to-cyan-700'];

async function openBlob(item, mode) {
  const r = await api.get(`/library/${item.id}/file`, { responseType: 'blob', params: mode === 'view' ? { inline: 1 } : {} });
  const url = URL.createObjectURL(r.data);
  if (mode === 'download') {
    const a = document.createElement('a');
    a.href = url; a.download = item.fileName; document.body.appendChild(a); a.click(); a.remove();
  } else window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}

function ItemForm({ item, categories, onClose, onSaved }) {
  const editing = !!item;
  const [form, setForm] = useState({ title: item?.title || '', author: item?.author || '', category: item?.category || '', description: item?.description || '', published: item ? item.published : true });
  const [file, setFile] = useState([]);
  const [cover, setCover] = useState([]);
  const [progress, setProgress] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!editing && !file[0]) return toast.error('Choose a file from your device first');
    setBusy(true);
    try {
      if (editing) {
        await api.put(`/library/${item.id}`, form);
      } else {
        const fd = new FormData();
        fd.append('file', file[0]);
        if (cover[0]) fd.append('cover', cover[0]);
        Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
        await api.post('/library', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }, timeout: 0,
          onUploadProgress: (ev) => ev.total && setProgress({ [file[0].name + file[0].size]: Math.max(1, Math.round((ev.loaded * 100) / ev.total)) }),
        });
      }
      toast.success(editing ? 'Library item updated' : 'Added to the library');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Could not save'); } finally { setBusy(false); }
  };

  return (
    <Modal title={editing ? 'Edit library item' : 'Add to library'} subtitle="Files are uploaded from your device and shared with students." onClose={onClose}
      footer={<><button type="button" className={btnGhost} onClick={onClose}>Cancel</button><button form="lib-form" disabled={busy} className={btnPrimary}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Upload'}</button></>}>
      <form id="lib-form" onSubmit={submit} className="space-y-4">
        {!editing && <FileQueue label="File *" files={file} onChange={setFile} maxFiles={1} maxMB={150} progress={progress} />}
        {!editing && <FileQueue label="Cover image (optional)" files={cover} onChange={setCover} accept={ACCEPT.image} maxFiles={1} maxMB={10} />}
        <input required value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Title *" className={inputCls} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={form.author} onChange={(e) => set('author', e.target.value)} placeholder="Author / source" className={inputCls} />
          <input list="lib-cats" value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Category (e.g. ICT, Past Papers)" className={inputCls} />
          <datalist id="lib-cats">{categories.map((c) => <option key={c.name} value={c.name} />)}</datalist>
        </div>
        <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Short description" className={inputCls} />
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-gray-200"><input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} /> Visible to students</label>
      </form>
    </Modal>
  );
}

export default function Library() {
  const { user } = useAuthStore();
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [form, setForm] = useState(null); // null | {} (new) | item (edit)
  const load = useCallback(async () => {
    try { setData((await api.get('/library', { params: { q, category: cat } })).data); }
    catch (e) { toast.error(e.response?.data?.error || 'Could not load the library'); setData({ items: [], categories: [], canManage: false }); }
  }, [q, cat]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const act = async (fn, item) => { try { await fn(item); } catch (e) { toast.error(e.response?.data?.error || 'Could not open the file'); } };
  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.title}" from the library?`)) return;
    try { await api.delete(`/library/${item.id}`); toast.success('Deleted'); load(); } catch (e) { toast.error(e.response?.data?.error || 'Could not delete'); }
  };
  const canEdit = (i) => user?.role === 'ADMIN' || i.uploaderId === user?.id;
  const total = (data?.categories || []).reduce((a, c) => a + c.count, 0);

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6">
      <PageHero slot="libraryHero" title="Library" subtitle="Books, notes and past papers for every learner">
        {data?.canManage && <div className="mt-3"><button onClick={() => setForm({})} className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-4 py-2 text-sm font-extrabold text-blue-950 shadow hover:bg-yellow-300"><FaPlus /> Add to library</button></div>}
      </PageHero>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, author or description…" className={`${inputCls} pl-10`} />
        </div>
        <div className="flex flex-wrap gap-2">
          {[{ name: 'All', count: total }, ...(data?.categories || [])].map((c) => (
            <button key={c.name} onClick={() => setCat(c.name)} className={cx('rounded-full px-3.5 py-1.5 text-xs font-bold transition', cat === c.name ? 'bg-blue-700 text-white shadow' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-blue-50 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700')}>
              {c.name} <span className="opacity-70">({c.count})</span>
            </button>
          ))}
        </div>
      </div>

      {!data && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-64" />)}</div>}
      {data && data.items.length === 0 && <Card><EmptyState icon={FaBookReader} title="Nothing here yet" text={data.canManage ? 'Use “Add to library” to upload the first file.' : 'Your trainers will add books and notes soon.'} /></Card>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {(data?.items || []).map((i, n) => {
          const Icon = fileIcon(i.fileName);
          return (
            <Card key={i.id} className="flex flex-col overflow-hidden !p-0">
              <div className={`relative h-36 bg-gradient-to-br ${TINTS[n % TINTS.length]}`}>
                {i.coverUrl ? <img src={asset(i.coverUrl)} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="grid h-full place-items-center text-5xl text-white/90"><Icon /></span>}
                <span className="absolute left-3 top-3"><Badge tone="brand">{i.category}</Badge></span>
                {!i.published && <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-bold text-white"><FaEyeSlash /> Hidden</span>}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="line-clamp-2 font-extrabold text-slate-900 dark:text-white">{i.title}</h3>
                <p className="text-xs text-slate-500">{i.author || i.uploaderName || 'NTS'}</p>
                {i.description && <p className="mt-2 line-clamp-2 text-xs text-slate-600 dark:text-gray-400">{i.description}</p>}
                <p className="mt-2 text-[11px] text-slate-400">{(i.fileName.split('.').pop() || '').toUpperCase()} · {fmtSize(i.sizeBytes)} · {i.downloads} downloads</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-3">
                  {VIEWABLE.test(i.fileName) && <button onClick={() => act((x) => openBlob(x, 'view'), i)} className={`${btnGhost} !px-3 !py-1.5 text-xs`}><FaEye /> View</button>}
                  <button onClick={() => act((x) => openBlob(x, 'download'), i)} className={`${btnPrimary} !px-3 !py-1.5 text-xs`}><FaDownload /> Download</button>
                  {canEdit(i) && data.canManage && (
                    <>
                      <button onClick={() => setForm(i)} className="rounded-lg p-2 text-blue-700 hover:bg-blue-50" aria-label="Edit"><FaEdit /></button>
                      <button onClick={() => remove(i)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Delete"><FaTrash /></button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {form && <ItemForm item={form.id ? form : null} categories={data?.categories || []} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
    </div>
  );
}
