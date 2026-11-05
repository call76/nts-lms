// Parents & Teachers: conversations about a student. Parents and teachers write; the student can read everything.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { FaComments, FaEye, FaPlus, FaPaperPlane, FaLock, FaUserCheck } from 'react-icons/fa';
import api from '../services/api';
import { SOCKET_URL } from '../services/config';
import { useAuthStore } from '../store/authStore';
import { Card, CardHeader, Badge, Avatar, EmptyState, Skeleton, PageHeader, btnPrimary, btnGhost, inputCls, cx } from '../components/ui';
import { timeAgo, fmtDate } from '../services/format';

const roleTone = { PARENT: 'violet', TRAINER: 'blue', STUDENT: 'brand', ADMIN: 'amber' };

const NewThread = ({ role, onClose, onCreated, presetStudent = '' }) => {
  const [contacts, setContacts] = useState(null);
  const [f, setF] = useState({ studentId: presetStudent, trainerId: '', parentId: '', subject: '', content: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/family/contacts').then((r) => setContacts(r.data)).catch(() => setContacts({})); }, []);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = role === 'PARENT' ? { studentId: f.studentId, trainerId: f.trainerId, subject: f.subject, content: f.content } : { studentId: f.studentId, parentId: f.parentId, subject: f.subject, content: f.content };
      const res = await api.post('/family/threads', body);
      toast.success('Conversation started');
      onCreated(res.data);
    } catch (err) { toast.error(err.response?.data?.error || 'Could not start the conversation'); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">New conversation</h2>
        {!contacts ? <Skeleton className="h-40" /> : (
          <form onSubmit={submit} className="space-y-3">
            {role === 'PARENT' ? (
              <>
                <select className={inputCls} value={f.studentId} onChange={(e) => set('studentId', e.target.value)} required>
                  <option value="">About which child?</option>
                  {(contacts.students || []).map((s) => <option key={s.id} value={s.id}>{s.fullName}{s.className ? ` · ${s.className}` : ''}</option>)}
                </select>
                <select className={inputCls} value={f.trainerId} onChange={(e) => set('trainerId', e.target.value)} required>
                  <option value="">Teacher or admin?</option>
                  {(contacts.teachers || []).map((t) => <option key={t.id} value={t.id}>{t.role === 'ADMIN' ? '[Admin] ' : ''}{t.fullName}{t.department ? ` · ${t.department}` : ''}</option>)}
                </select>
                {(contacts.students || []).length === 0 && <p className="text-xs text-amber-600">No approved child yet. Your child must approve your request first.</p>}
              </>
            ) : (
              <select className={inputCls} value={`${f.parentId}|${f.studentId}`} onChange={(e) => { const [p, s] = e.target.value.split('|'); setF((x) => ({ ...x, parentId: p, studentId: s })); }} required>
                <option value="|">Which parent and student?</option>
                {(contacts.links || []).map((l) => <option key={`${l.parentId}|${l.studentId}`} value={`${l.parentId}|${l.studentId}`}>{l.parentName} ({l.relationship}) → {l.studentName}</option>)}
              </select>
            )}
            <input className={inputCls} placeholder="Subject" value={f.subject} onChange={(e) => set('subject', e.target.value)} maxLength={150} required />
            <textarea className={inputCls} rows={4} placeholder="Your message" value={f.content} onChange={(e) => set('content', e.target.value)} required />
            <p className="flex items-center gap-2 rounded-lg bg-nts-green-50 p-2 text-xs text-nts-green-800 dark:bg-nts-green-900/30 dark:text-nts-green-200"><FaEye /> The student can read this conversation.</p>
            <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className={btnGhost}>Cancel</button><button disabled={busy} className={btnPrimary}>{busy ? 'Sending…' : 'Start'}</button></div>
          </form>
        )}
      </Card>
    </div>
  );
};

const ParentRequests = () => {
  const [rows, setRows] = useState([]);
  const load = useCallback(() => api.get('/parents/requests').then((r) => setRows(r.data)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const act = async (id, action) => {
    try { await api.put(`/parents/requests/${id}`, { action }); toast.success(action === 'approve' ? 'Parent approved' : 'Request removed'); load(); } catch (e) { toast.error('Failed'); }
  };
  if (!rows.length) return null;
  return (
    <Card className="mb-4 border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-900/10">
      <CardHeader title="Parent requests" subtitle="Someone says they are your parent or guardian. Approve only people you know." />
      <ul className="space-y-2 px-5 pb-5">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-slate-700 dark:text-gray-200"><b>{r.parent?.fullName}</b> ({r.relationship}) · {r.parent?.email}</span>
            <span className="flex gap-2"><button onClick={() => act(r.id, 'approve')} className={btnPrimary}><FaUserCheck /> Approve</button><button onClick={() => act(r.id, 'reject')} className={btnGhost}>Reject</button></span>
          </li>
        ))}
      </ul>
    </Card>
  );
};

const FamilyChat = () => {
  const { user, token } = useAuthStore();
  const [params, setParams] = useSearchParams();
  const [threads, setThreads] = useState(null);
  const [active, setActive] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showNew, setShowNew] = useState(user.role === 'PARENT' && Boolean(params.get('student')));
  const bottom = useRef(null);
  const activeId = active?.id;
  const canStart = ['PARENT', 'TRAINER'].includes(user.role);

  const loadList = useCallback(async () => {
    try { const r = await api.get('/family/threads'); setThreads(r.data); return r.data; } catch (e) { setThreads([]); return []; }
  }, []);
  const open = useCallback(async (id) => {
    try { const r = await api.get(`/family/threads/${id}`); setActive(r.data); setParams({ thread: id }, { replace: true }); } catch (e) { toast.error('Could not open the conversation'); }
  }, [setParams]);

  useEffect(() => {
    loadList().then((rows) => { const want = params.get('thread') || rows[0]?.id; if (want) open(want); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // live updates
  useEffect(() => {
    if (!token) return undefined;
    const s = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    s.on('family:message', ({ threadId, message }) => {
      setActive((a) => (a && a.id === threadId && !a.messages.some((m) => m.id === message.id) ? { ...a, messages: [...a.messages, message] } : a));
      loadList();
    });
    s.on('family:thread', () => loadList());
    s.on('family:status', ({ threadId, status }) => { setActive((a) => (a && a.id === threadId ? { ...a, status, canReply: a.canReply && status === 'OPEN' } : a)); loadList(); });
    return () => s.disconnect();
  }, [token, loadList]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [active?.messages?.length, activeId]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || !active) return;
    setSending(true);
    try {
      const r = await api.post(`/family/threads/${active.id}/messages`, { content: text });
      setActive((a) => ({ ...a, messages: a.messages.some((m) => m.id === r.data.id) ? a.messages : [...a.messages, r.data] }));
      setText(''); loadList();
    } catch (err) { toast.error(err.response?.data?.error || 'Could not send'); }
    setSending(false);
  };
  const toggleStatus = async () => {
    try { await api.put(`/family/threads/${active.id}/status`, { status: active.status === 'OPEN' ? 'CLOSED' : 'OPEN' }); open(active.id); loadList(); } catch (e) { toast.error('Not allowed'); }
  };

  const other = useMemo(() => (t) => (user.role === 'PARENT' ? t.trainer : t.parent), [user.role]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <PageHeader icon={FaComments} title="Parents & Teachers" subtitle={user.role === 'STUDENT' ? 'Conversations about you. You can read them, but only your parent and teacher can write.' : 'Talk about the progress of a student. The student can read the conversation.'}
        actions={canStart && <button onClick={() => setShowNew(true)} className={btnPrimary}><FaPlus /> New conversation</button>} />
      {user.role === 'STUDENT' && <ParentRequests />}
      {user.role === 'ADMIN' && <ParentRequests />}

      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <Card className="max-h-[70vh] overflow-y-auto">
          {threads === null && <div className="space-y-2 p-4"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>}
          {threads && threads.length === 0 && <EmptyState icon={FaComments} title="No conversations yet" text={canStart ? 'Start one with the button above.' : 'When your parent and a teacher talk about you, it will appear here.'} />}
          {threads?.map((t) => {
            const o = other(t) || t.parent;
            const last = t.messages?.[0];
            return (
              <button key={t.id} onClick={() => open(t.id)} className={cx('flex w-full items-start gap-3 border-b border-slate-100 p-4 text-left transition last:border-0 hover:bg-slate-50 dark:border-gray-700 dark:hover:bg-gray-700/40', activeId === t.id && 'bg-nts-green-50 dark:bg-nts-green-900/20')}>
                <Avatar name={o?.fullName} src={o?.avatar} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{t.subject}</p>{t.status === 'CLOSED' && <FaLock className="shrink-0 text-xs text-slate-400" />}</div>
                  <p className="truncate text-xs text-slate-500 dark:text-gray-400">About {t.student?.fullName} · {user.role === 'STUDENT' ? `${t.parent?.fullName} & ${t.trainer?.fullName}` : o?.fullName}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">{last ? `${last.sender?.fullName?.split(' ')[0]}: ${last.content}` : ''}</p>
                  <p className="text-[10px] text-slate-400">{timeAgo(t.updatedAt)} · {t._count?.messages || 0} messages</p>
                </div>
              </button>
            );
          })}
        </Card>

        <Card className="flex min-h-[420px] flex-col">
          {!active ? <EmptyState icon={FaComments} title="Select a conversation" /> : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4 dark:border-gray-700">
                <div className="min-w-0">
                  <h2 className="truncate font-bold text-slate-900 dark:text-white">{active.subject}</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">{active.parent?.fullName} (parent) · {active.trainer?.fullName} ({active.trainer?.role === 'ADMIN' ? 'admin' : 'teacher'}) · about <b>{active.student?.fullName}</b> · started {fmtDate(active.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={active.status === 'OPEN' ? 'brand' : 'slate'}>{active.status === 'OPEN' ? 'Open' : 'Closed'}</Badge>
                  {(active.canReply || ['PARENT', 'TRAINER', 'ADMIN'].includes(user.role)) && user.role !== 'STUDENT' && <button onClick={toggleStatus} className={btnGhost}>{active.status === 'OPEN' ? 'Close' : 'Reopen'}</button>}
                </div>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: '48vh' }}>
                {active.messages.map((m) => {
                  const mine = m.senderId === user.id;
                  return (
                    <div key={m.id} className={cx('flex gap-2', mine && 'flex-row-reverse')}>
                      <Avatar name={m.sender?.fullName} src={m.sender?.avatar} size={32} />
                      <div className={cx('max-w-[78%] rounded-2xl px-3.5 py-2 text-sm', mine ? 'bg-nts-green-600 text-white' : 'bg-slate-100 text-slate-800 dark:bg-gray-700 dark:text-gray-100')}>
                        <p className={cx('mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold', mine ? 'text-white/80' : 'text-slate-500 dark:text-gray-300')}>{m.sender?.fullName} <Badge tone={roleTone[m.sender?.role] || 'slate'} className="!py-0 !text-[9px]">{m.sender?.role === 'TRAINER' ? 'Teacher' : m.sender?.role === 'PARENT' ? 'Parent' : m.sender?.role}</Badge></p>
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <p className={cx('mt-1 text-[10px]', mine ? 'text-white/70' : 'text-slate-400')}>{timeAgo(m.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottom} />
              </div>
              {active.canReply ? (
                <form onSubmit={send} className="flex gap-2 border-t border-slate-100 p-3 dark:border-gray-700">
                  <input value={text} onChange={(e) => setText(e.target.value)} className={inputCls} placeholder="Write a message…" maxLength={5000} />
                  <button disabled={sending || !text.trim()} className={btnPrimary}><FaPaperPlane /></button>
                </form>
              ) : (
                <p className="flex items-center gap-2 border-t border-slate-100 p-3 text-xs text-slate-500 dark:border-gray-700"><FaEye /> {user.role === 'STUDENT' ? 'You can read this conversation, but only your parent and teacher can write in it.' : active.status === 'CLOSED' ? 'This conversation is closed.' : 'Read-only.'}</p>
              )}
            </>
          )}
        </Card>
      </div>
      {showNew && <NewThread presetStudent={params.get('student') || ''} role={user.role} onClose={() => setShowNew(false)} onCreated={async (t) => { setShowNew(false); await loadList(); open(t.id); }} />}
    </div>
  );
};

export default FamilyChat;
