// Add / edit a module. Everything is uploaded from the device (drag & drop or Browse):
// cover image, intro video and any number of learning files. No links or "locations" to type.
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FaTimes, FaArrowLeft, FaArrowRight, FaSave, FaInfoCircle, FaImage, FaFolderOpen, FaTrash, FaCheck } from 'react-icons/fa';
import api from '../services/api';
import { FileDrop, FileQueue, fileIcon, fmtSize } from './FileDrop';

const STEPS = [
  { id: 1, label: 'Details', icon: FaInfoCircle },
  { id: 2, label: 'Cover & intro', icon: FaImage },
  { id: 3, label: 'Learning files', icon: FaFolderOpen },
];
const LEVELS = [['1', 'Level 3'], ['2', 'Level 4'], ['3', 'Level 5']];
const field = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white';
const asFile = (path) => (path ? { path, name: path.split('/').pop(), size: 0 } : null);

export default function ModuleWizard({ trades = [], module: editing = null, tradeId = '', onClose, onDone }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    tradeId: editing?.tradeId || tradeId || '',
    level: editing?.level ? String(editing.level) : '',
    code: editing?.code || '',
    name: editing?.name || '',
    hours: editing?.hours || '',
    description: editing?.description || '',
  });
  const [cover, setCover] = useState(asFile(editing?.coverUrl));
  const [intro, setIntro] = useState(asFile(editing?.introVideoUrl));
  const [queue, setQueue] = useState([]);
  const [progress, setProgress] = useState({});
  const [existing, setExisting] = useState([]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!editing) return;
    api.get(`/modules/${editing.id}/resources`).then((r) => setExisting(r.data || [])).catch(() => setExisting([]));
  }, [editing]);

  const detailsOk = form.tradeId && form.level && form.code.trim() && form.name.trim();
  const total = useMemo(() => queue.reduce((a, f) => a + f.size, 0), [queue]);

  const removeExisting = async (r) => {
    if (!window.confirm(`Remove "${r.title}" from this module?`)) return;
    try { await api.delete(`/resources/${r.id}`); setExisting((x) => x.filter((i) => i.id !== r.id)); toast.success('File removed'); }
    catch (e) { toast.error(e.response?.data?.error || 'Could not remove the file'); }
  };

  const save = async () => {
    if (!detailsOk) { setStep(1); return toast.error('Choose the trade and level, then enter the module code and name'); }
    setBusy(true);
    try {
      const payload = {
        level: parseInt(form.level, 10), code: form.code.trim(), name: form.name.trim(), description: form.description,
        hours: form.hours === '' ? null : Number(form.hours),
        coverUrl: cover?.path || null, introVideoUrl: intro?.path || null,
      };
      const saved = editing ? (await api.put(`/trades/modules/${editing.id}`, payload)).data : (await api.post(`/trades/${form.tradeId}/modules`, payload)).data;
      let failed = 0;
      for (const f of queue) {
        const key = f.name + f.size;
        const fd = new FormData();
        fd.append('file', f);
        fd.append('title', f.name.replace(/\.[^.]+$/, ''));
        fd.append('isPublished', 'true');
        try {
          setProgress((p) => ({ ...p, [key]: 1 }));
          await api.post(`/modules/${saved.id}/resources`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' }, timeout: 0,
            onUploadProgress: (e) => e.total && setProgress((p) => ({ ...p, [key]: Math.max(1, Math.round((e.loaded * 100) / e.total)) })),
          });
          setProgress((p) => ({ ...p, [key]: 100 }));
        } catch (e) {
          failed += 1;
          setProgress((p) => ({ ...p, [key]: 0 }));
          toast.error(`${f.name}: ${e.response?.data?.error || 'upload failed'}`);
        }
      }
      if (failed) { toast.error(`Module saved, but ${failed} file(s) did not upload. Open the module again to retry.`); }
      else toast.success(editing ? 'Module updated' : `Module "${saved.code}" added`);
      onDone && onDone(saved);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Could not save the module');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-3 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="bg-gradient-to-r from-blue-950 via-blue-800 to-blue-600 px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-extrabold">{editing ? 'Edit module' : 'Add module'}</h3>
              <p className="text-sm text-blue-100">Upload the cover, the intro video and all learning files from your computer.</p>
            </div>
            <button onClick={onClose} disabled={busy} className="rounded-lg p-2 hover:bg-white/15" aria-label="Close"><FaTimes /></button>
          </div>
          <ol className="mt-4 flex gap-2">
            {STEPS.map((s) => (
              <li key={s.id} className="flex-1">
                <button type="button" onClick={() => setStep(s.id)} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition ${step === s.id ? 'bg-white text-blue-800' : 'bg-white/10 text-blue-100 hover:bg-white/20'}`}>
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${step === s.id ? 'bg-blue-700 text-white' : 'bg-white/20'}`}>{step > s.id ? <FaCheck /> : s.id}</span>
                  <span className="truncate">{s.label}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {step === 1 && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-gray-200">Trade *</span>
                  <select value={form.tradeId} disabled={!!editing} onChange={(e) => set('tradeId', e.target.value)} className={field}>
                    <option value="">Select trade</option>
                    {trades.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select></label>
                <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-gray-200">Level *</span>
                  <select value={form.level} onChange={(e) => set('level', e.target.value)} className={field}>
                    <option value="">Select level</option>
                    {LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select></label>
                <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-gray-200">Module code *</span>
                  <input value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="e.g. SWD301" className={field} /></label>
                <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-gray-200">Learning hours</span>
                  <input type="number" min="1" max="2000" value={form.hours} onChange={(e) => set('hours', e.target.value)} placeholder="e.g. 80" className={field} /></label>
              </div>
              <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-gray-200">Module name *</span>
                <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Web Programming Fundamentals" className={field} /></label>
              <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-gray-200">Description</span>
                <textarea rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What will learners be able to do after this module?" className={field} /></label>
            </>
          )}

          {step === 2 && (
            <>
              <FileDrop label="Cover image" kind="image" value={cover} onChange={setCover} maxMB={10} hint="JPG, PNG or WEBP · max 10 MB · shown on the module card" />
              <FileDrop label="Intro / overview video (optional)" kind="video" value={intro} onChange={setIntro} maxMB={200} hint="MP4, WEBM or MOV · max 200 MB" />
            </>
          )}

          {step === 3 && (
            <>
              {editing && existing.length > 0 && (
                <div>
                  <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-gray-200">Files already in this module ({existing.length})</p>
                  <ul className="space-y-2">
                    {existing.map((r) => { const Icon = fileIcon(r.originalName); return (
                      <li key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5 dark:border-gray-700">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-blue-700"><Icon /></span>
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{r.title}</p><p className="text-xs text-slate-500">{fmtSize(r.sizeBytes)}</p></div>
                        <button type="button" onClick={() => removeExisting(r)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Remove"><FaTrash /></button>
                      </li>); })}
                  </ul>
                </div>
              )}
              <FileQueue label={editing ? 'Add more learning files' : 'Learning files (notes, slides, books, worksheets)'} files={queue} onChange={setQueue} progress={progress} />
              <p className="text-xs text-slate-500">Students enrolled in this module can open and download these files. Total to upload: {fmtSize(total)}.</p>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
          <button type="button" onClick={() => (step === 1 ? onClose() : setStep(step - 1))} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {step === 1 ? 'Cancel' : <><FaArrowLeft /> Back</>}
          </button>
          {step < 3 ? (
            <button type="button" onClick={() => (step === 1 && !detailsOk ? toast.error('Choose the trade and level, then enter the module code and name') : setStep(step + 1))} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-800">Next <FaArrowRight /></button>
          ) : (
            <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
              <FaSave /> {busy ? 'Saving & uploading…' : editing ? 'Save changes' : 'Save module'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
