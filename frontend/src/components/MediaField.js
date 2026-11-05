import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FaUpload, FaImages, FaTimes, FaUndo, FaPlay } from 'react-icons/fa';
import api from '../services/api';
import { asset, isVideoFile } from '../services/assets';

// Modal with everything already uploaded to the server, so the admin can reuse files.
const MediaLibrary = ({ kind, onPick, onClose }) => {
  const [files, setFiles] = useState(null);
  useEffect(() => {
    api.get('/settings/media')
      .then((r) => setFiles(r.data.filter((f) => !kind || f.kind === kind)))
      .catch((e) => { toast.error(e.response?.data?.error || 'Could not load the media library'); setFiles([]); });
  }, [kind]);
  return (
    <div className="fixed inset-0 z-[70] bg-black/60 p-4 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="font-bold text-nts-green-900">Media library {kind ? `(${kind}s)` : ''}</h3>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100" aria-label="Close"><FaTimes /></button>
        </div>
        <div className="p-4 overflow-y-auto">
          {files === null && <p className="text-gray-500 text-sm">Loading…</p>}
          {files && !files.length && <p className="text-gray-500 text-sm">Nothing uploaded yet. Use the Upload button.</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {(files || []).map((f) => (
              <button key={f.path} onClick={() => onPick(f.path)} className="group relative aspect-video rounded-lg overflow-hidden border hover:ring-2 hover:ring-nts-gold-500 bg-gray-100">
                {f.kind === 'image'
                  ? <img src={asset(f.path)} alt="" loading="lazy" className="w-full h-full object-cover" />
                  : <span className="w-full h-full grid place-items-center text-nts-green-700"><FaPlay size={24} /></span>}
                <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[10px] px-2 py-0.5 truncate">{f.path.replace('/uploads/', '')}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Image / video field: type a URL, upload a file or pick from the library.
const MediaField = ({ label, value, onChange, defaultValue, kind = 'image', hint, compact = false }) => {
  const input = useRef(null);
  const [busy, setBusy] = useState(0);
  const [library, setLibrary] = useState(false);
  const accept = kind === 'video' ? 'video/mp4,video/webm,video/ogg' : 'image/jpeg,image/png,image/webp,image/gif';

  const upload = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setBusy(1);
    try {
      const r = await api.post('/settings/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0,
        onUploadProgress: (e) => e.total && setBusy(Math.max(1, Math.round((e.loaded * 100) / e.total))),
      });
      onChange(r.data.path);
      toast.success('Uploaded');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Upload failed');
    } finally {
      setBusy(0);
      if (input.current) input.current.value = '';
    }
  };

  const showVideo = kind === 'video' || isVideoFile(value);
  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-white">
      {label && <p className="text-sm font-semibold text-gray-700 mb-2">{label}</p>}
      <div className={`flex gap-3 ${compact ? 'flex-col sm:flex-row' : 'flex-col sm:flex-row'}`}>
        <div className="w-full sm:w-40 shrink-0 aspect-video rounded-lg overflow-hidden bg-gray-100 border grid place-items-center">
          {value
            ? (showVideo ? <video src={asset(value)} className="w-full h-full object-cover" muted /> : <img src={asset(value)} alt="" className="w-full h-full object-cover" />)
            : <span className="text-xs text-gray-400">No file</span>}
        </div>
        <div className="flex-1 min-w-0">
          <input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={kind === 'video' ? 'YouTube / video link or upload a file' : 'Image link or upload a file'}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-nts-green-500 outline-none" />
          <div className="flex flex-wrap gap-2 mt-2">
            <button type="button" onClick={() => input.current?.click()} disabled={!!busy} className="px-3 py-1.5 rounded-lg bg-nts-green-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60">
              <FaUpload /> {busy ? `Uploading ${busy}%` : 'Upload'}
            </button>
            <button type="button" onClick={() => setLibrary(true)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold flex items-center gap-1.5"><FaImages /> Library</button>
            {defaultValue !== undefined && value !== defaultValue && (
              <button type="button" onClick={() => onChange(defaultValue)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold flex items-center gap-1.5"><FaUndo /> Default</button>
            )}
            {value && defaultValue === undefined && (
              <button type="button" onClick={() => onChange('')} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold flex items-center gap-1.5"><FaTimes /> Clear</button>
            )}
          </div>
          {hint && <p className="text-xs text-gray-400 mt-1.5">{hint}</p>}
        </div>
      </div>
      <input ref={input} type="file" accept={accept} className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      {library && <MediaLibrary kind={kind} onClose={() => setLibrary(false)} onPick={(path) => { onChange(path); setLibrary(false); }} />}
    </div>
  );
};

export default MediaField;
