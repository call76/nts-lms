// "Update Password" panel (tabs: Profile Information | Update Password) with a strength meter.
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { FaEye, FaEyeSlash, FaLock } from 'react-icons/fa';
import api from '../services/api';

const score = (p) => [/.{8,}/, /[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
const LABEL = ['Too short', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
const COLOR = ['bg-slate-300', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-emerald-600'];

const Field = ({ label, value, onChange, autoComplete }) => {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      <span className="relative block">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required
          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-11 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={show ? 'Hide' : 'Show'}>{show ? <FaEyeSlash /> : <FaEye />}</button>
      </span>
    </label>
  );
};

export default function PasswordPanel({ onClose }) {
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const s = score(f.next);
  const submit = async (e) => {
    e.preventDefault();
    if (f.next !== f.confirm) return toast.error('New passwords do not match');
    if (f.next.length < 6) return toast.error('Password must be at least 6 characters');
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: f.current, newPassword: f.next });
      toast.success('Password updated');
      onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to change password'); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-3 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex border-b border-slate-200 text-sm font-bold">
          <button onClick={onClose} className="flex-1 px-4 py-3.5 text-slate-500 hover:bg-slate-50">Profile Information</button>
          <button className="flex-1 border-b-2 border-blue-700 px-4 py-3.5 text-blue-700">Update Password</button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-6">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white"><FaLock /></span>
            <div><h3 className="text-lg font-extrabold text-slate-900">Update Password</h3><p className="text-xs text-slate-500">Ensure your account is using a long, random password to stay secure.</p></div></div>
          <Field label="Current Password" value={f.current} onChange={(v) => setF({ ...f, current: v })} autoComplete="current-password" />
          <Field label="New Password" value={f.next} onChange={(v) => setF({ ...f, next: v })} autoComplete="new-password" />
          {f.next && (<div><div className="flex gap-1">{[1, 2, 3, 4, 5].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= s ? COLOR[s] : 'bg-slate-200'}`} />)}</div><p className="mt-1 text-xs font-semibold text-slate-500">{LABEL[s]} · use 8+ characters, upper & lower case, numbers and symbols</p></div>)}
          <Field label="Confirm Password" value={f.confirm} onChange={(v) => setF({ ...f, confirm: v })} autoComplete="new-password" />
          <button disabled={busy} className="rounded-xl bg-blue-700 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">{busy ? 'Updating…' : 'Update Password'}</button>
        </form>
      </div>
    </div>
  );
}
