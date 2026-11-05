// Upload from the device: drag & drop or Browse. No pasted links / locations anywhere.
//  - <FileDrop>  one file, uploaded straight away (cover image, intro video, lesson video ...)
//  - <FileQueue> many files chosen now and uploaded later by the parent (module materials)
import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FaCloudUploadAlt, FaTimes, FaFilePdf, FaFileWord, FaFilePowerpoint, FaFileExcel, FaFileVideo, FaFileAudio, FaFileArchive, FaFileAlt, FaFileImage, FaCheckCircle } from 'react-icons/fa';
import api from '../services/api';
import { asset } from '../services/assets';

export const fmtSize = (b = 0) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`);

export const fileIcon = (name = '') => {
  const e = (name.split('.').pop() || '').toLowerCase();
  if (e === 'pdf') return FaFilePdf;
  if (['doc', 'docx'].includes(e)) return FaFileWord;
  if (['ppt', 'pptx'].includes(e)) return FaFilePowerpoint;
  if (['xls', 'xlsx', 'csv'].includes(e)) return FaFileExcel;
  if (['mp4', 'webm', 'mov'].includes(e)) return FaFileVideo;
  if (['mp3', 'wav', 'm4a'].includes(e)) return FaFileAudio;
  if (['zip'].includes(e)) return FaFileArchive;
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(e)) return FaFileImage;
  return FaFileAlt;
};

export const ACCEPT = {
  image: 'image/jpeg,image/png,image/webp',
  video: 'video/mp4,video/webm,video/quicktime',
  document: '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip',
  materials: '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,.mp3,.wav,.m4a',
};

// Uploads one File to /api/upload and reports progress (0-100). Resolves with { path, name, size }.
export async function uploadDevice(file, onProgress) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await api.post('/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0,
    onUploadProgress: (e) => e.total && onProgress && onProgress(Math.max(1, Math.round((e.loaded * 100) / e.total))),
  });
  return { path: r.data.path || r.data.url, name: r.data.filename || file.name, size: r.data.size || file.size };
}

const Zone = ({ onFiles, accept, multiple, hint, disabled, children }) => {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  return (
    <div
      role="button" tabIndex={0}
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !disabled && input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) onFiles(Array.from(e.dataTransfer.files || [])); }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition ${over ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/60 dark:border-gray-600 dark:bg-gray-800/60'} ${disabled ? 'opacity-60' : ''}`}
    >
      <FaCloudUploadAlt className="text-3xl text-blue-600" />
      <p className="text-sm font-bold text-slate-800 dark:text-white">{children}</p>
      <p className="text-xs text-slate-500">{hint}</p>
      <input ref={input} type="file" hidden accept={accept} multiple={multiple} onChange={(e) => { onFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
    </div>
  );
};

export function FileDrop({ label, kind = 'image', accept, value, onChange, maxMB = 100, hint }) {
  const [pct, setPct] = useState(0);
  const [name, setName] = useState('');
  const busy = pct > 0 && pct < 100;
  const take = async (files) => {
    const f = files[0];
    if (!f) return;
    if (f.size > maxMB * 1048576) return toast.error(`File is too large (max ${maxMB} MB)`);
    setName(f.name); setPct(1);
    try {
      const up = await uploadDevice(f, setPct);
      setPct(100);
      onChange({ path: up.path, name: up.name, size: up.size });
    } catch (e) {
      toast.error(e.response?.data?.error || e.message || 'Upload failed');
      setPct(0);
    }
  };
  const Icon = fileIcon(value?.name || name);
  return (
    <div>
      {label && <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-gray-200">{label}</p>}
      {value?.path && !busy ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          {kind === 'image'
            ? <img src={asset(value.path)} alt="" className="h-14 w-20 rounded-lg object-cover" />
            : <span className="grid h-14 w-14 place-items-center rounded-lg bg-white text-2xl text-blue-700 dark:bg-gray-800"><Icon /></span>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-800 dark:text-white">{value.name}</p>
            <p className="flex items-center gap-1 text-xs text-emerald-700"><FaCheckCircle /> Uploaded {value.size ? `· ${fmtSize(value.size)}` : ''}</p>
          </div>
          <button type="button" onClick={() => { onChange(null); setPct(0); }} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Remove file"><FaTimes /></button>
        </div>
      ) : (
        <Zone onFiles={take} accept={accept || ACCEPT[kind] || ACCEPT.document} hint={hint || `Max ${maxMB} MB`} disabled={busy}>
          {busy ? `Uploading ${name}… ${pct}%` : <>Drag & drop or <span className="text-blue-700 underline">Browse</span> from your device</>}
          {busy && <span className="mt-2 block h-2 w-56 max-w-full overflow-hidden rounded-full bg-slate-200"><span className="block h-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} /></span>}
        </Zone>
      )}
    </div>
  );
}

// Many files, kept as File objects until the parent uploads them (see uploadAll in AdminPanel).
export function FileQueue({ label, files, onChange, accept = ACCEPT.materials, maxMB = 100, maxFiles = 20, progress = {} }) {
  const add = (list) => {
    const ok = [];
    list.forEach((f) => {
      if (f.size > maxMB * 1048576) toast.error(`${f.name} is larger than ${maxMB} MB`);
      else if (!files.some((x) => x.name === f.name && x.size === f.size)) ok.push(f);
    });
    onChange([...files, ...ok].slice(0, maxFiles));
  };
  return (
    <div>
      {label && <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-gray-200">{label}</p>}
      <Zone onFiles={add} accept={accept} multiple hint={`PDF, Word, PowerPoint, Excel, images, audio, video, ZIP · up to ${maxFiles} files · max ${maxMB} MB each`}>
        Drag & drop files or <span className="text-blue-700 underline">Browse</span> from your device
      </Zone>
      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((f, i) => {
            const Icon = fileIcon(f.name);
            const p = progress[f.name + f.size];
            return (
              <li key={f.name + f.size} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-800">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700"><Icon /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{f.name}</p>
                  <p className="text-xs text-slate-500">{fmtSize(f.size)}{p === 100 ? ' · uploaded ✓' : p ? ` · ${p}%` : ''}</p>
                  {p > 0 && p < 100 && <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-200"><span className="block h-full bg-blue-600" style={{ width: `${p}%` }} /></span>}
                </div>
                {!p && <button type="button" onClick={() => onChange(files.filter((_, k) => k !== i))} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Remove"><FaTimes /></button>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default FileDrop;
