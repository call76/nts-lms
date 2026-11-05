import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBell, FaBullhorn, FaClipboardCheck, FaBriefcase, FaAward, FaInfoCircle } from 'react-icons/fa';
import api from '../services/api';
import { timeAgo } from '../services/format';

const ICONS = { ANNOUNCEMENT: FaBullhorn, GRADE: FaClipboardCheck, APPLICATION: FaBriefcase, CERTIFICATE: FaAward, INFO: FaInfoCircle };

// Bell with unread badge + dropdown. Polls every 45 s (cheap) and refreshes when opened.
const NotificationBell = ({ className = '' }) => {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const res = await api.get('/notifications', { params: { limit: 12 } });
      setItems(res.data.items || []);
      setUnread(res.data.unread || 0);
    } catch (e) { /* the bell is optional - stay quiet */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const toggle = () => { setOpen((o) => !o); if (!open) load(); };
  const openItem = async (n) => {
    setOpen(false);
    if (!n.isRead) { setItems((l) => l.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))); setUnread((u) => Math.max(0, u - 1)); api.post(`/notifications/${n.id}/read`).catch(() => {}); }
    if (n.link) navigate(n.link);
  };
  const readAll = async () => { setItems((l) => l.map((x) => ({ ...x, isRead: true }))); setUnread(0); api.post('/notifications/read-all').catch(() => {}); };

  return (
    <div className={`relative ${className}`} ref={box}>
      <button onClick={toggle} aria-label="Notifications" className="relative rounded-lg p-1.5 text-gray-600 transition hover:text-green-600 dark:text-gray-300 dark:hover:text-green-400">
        <FaBell size={20} />
        {unread > 0 && <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="fixed left-2 right-2 top-[68px] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-3 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-gray-700">
            <p className="font-bold text-slate-900 dark:text-white">Notifications</p>
            {unread > 0 && <button onClick={readAll} className="text-xs font-semibold text-green-600 hover:underline dark:text-green-300">Mark all as read</button>}
          </div>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-gray-700">
            {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-500 dark:text-gray-400">You are all caught up.</li>}
            {items.map((n) => {
              const Icon = ICONS[n.type] || FaInfoCircle;
              return (
                <li key={n.id}>
                  <button onClick={() => openItem(n)} className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-gray-700/60 ${n.isRead ? '' : 'bg-green-50/60 dark:bg-green-900/20'}`}>
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-gray-700 dark:text-gray-300"><Icon /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-800 dark:text-white">{n.title}</span>
                      {n.body && <span className="block truncate text-xs text-slate-500 dark:text-gray-400">{n.body}</span>}
                      <span className="mt-0.5 block text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-green-500" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
