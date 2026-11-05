import React, { useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';

// Simple accessible dialog used instead of the browser's prompt()/alert() boxes.
export default function Modal({ title, subtitle, onClose, children, wide = false, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-gray-900 sm:rounded-3xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-4 dark:border-gray-800">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold text-slate-900 dark:text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300"><FaTimes /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-3 dark:border-gray-800 dark:bg-gray-900/60">{footer}</div>}
      </div>
    </div>
  );
}
