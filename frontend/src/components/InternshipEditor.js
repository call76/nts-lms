import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { FaPlus } from 'react-icons/fa';
import api from '../services/api';
import Modal from './Modal';
import { btnPrimary, btnGhost, inputCls } from './ui';

// Shown to the admin and to trainers the admin allowed to edit internships.
export default function InternshipEditor({ onSaved, editing = null, onClose }) {
  const [open, setOpen] = useState(Boolean(editing));
  const [busy, setBusy] = useState(false);
  const blank = { title: '', company: '', description: '', location: '', duration: 3, stipend: 0, deadline: '' };
  const [f, setF] = useState(editing ? { title: editing.title || '', company: editing.company || '', description: editing.description || '', location: editing.location || '', duration: editing.duration || 3, stipend: editing.stipend || 0, deadline: editing.deadline ? String(editing.deadline).slice(0, 10) : '' } : blank);
  const close = () => { setOpen(false); onClose?.(); };
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { if (editing) await api.put(`/internships/${editing.id}`, f); else await api.post('/internships', f); toast.success(editing ? 'Internship updated' : 'Internship published'); close(); if (!editing) setF(blank); onSaved?.(); }
    catch (err) { toast.error(err.response?.data?.error || 'Could not save'); }
    setBusy(false);
  };
  return (
    <>
      {!editing && <div className="mx-auto mb-4 flex max-w-5xl justify-end px-4"><button onClick={() => setOpen(true)} className={btnPrimary}><FaPlus /> Post an internship</button></div>}
      {open && (
        <Modal title={editing ? 'Edit internship' : 'Post an internship'} onClose={close} wide>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <input required className={inputCls} placeholder="Title" value={f.title} onChange={(e) => set('title', e.target.value)} />
            <input required className={inputCls} placeholder="Company" value={f.company} onChange={(e) => set('company', e.target.value)} />
            <input className={inputCls} placeholder="Location" value={f.location} onChange={(e) => set('location', e.target.value)} />
            <input required type="date" className={inputCls} value={f.deadline} onChange={(e) => set('deadline', e.target.value)} />
            <label className="text-xs text-slate-500">Duration (months)<input type="number" min="1" className={inputCls} value={f.duration} onChange={(e) => set('duration', e.target.value)} /></label>
            <label className="text-xs text-slate-500">Stipend (RWF / month)<input type="number" min="0" className={inputCls} value={f.stipend} onChange={(e) => set('stipend', e.target.value)} /></label>
            <textarea required rows={4} className={`${inputCls} sm:col-span-2`} placeholder="Description" value={f.description} onChange={(e) => set('description', e.target.value)} />
            <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={close} className={btnGhost}>Cancel</button><button disabled={busy} className={btnPrimary}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Publish'}</button></div>
          </form>
        </Modal>)}
    </>
  );
}
