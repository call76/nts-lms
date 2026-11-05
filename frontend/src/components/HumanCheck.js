import React, { useCallback, useEffect, useState } from 'react';
import { FaRobot, FaSyncAlt, FaCheckCircle } from 'react-icons/fa';
import api from '../services/api';
import { setHuman } from '../services/human';

// "I am not a robot": answer a small question. The answer is sent with the next login / sign-up /
// certificate check. After every use a fresh question appears.
export default function HumanCheck({ className = '' }) {
  const [c, setC] = useState(null);
  const [answer, setAnswer] = useState('');
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setAnswer(''); setHuman('', '');
    try { const r = await api.get('/auth/human-check'); setC(r.data); setFailed(false); } catch (e) { setFailed(true); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const again = () => load(); window.addEventListener('human:used', again); return () => window.removeEventListener('human:used', again); }, [load]);

  const change = (v) => { setAnswer(v); setHuman(c?.token || '', v.trim()); };
  const ready = answer.trim().length > 0;

  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-gray-700 dark:bg-gray-800 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-gray-200">
        {ready ? <FaCheckCircle className="text-emerald-600" /> : <FaRobot className="text-slate-500" />} I am not a robot
        <button type="button" onClick={load} className="ml-auto text-slate-400 hover:text-slate-600" aria-label="New question"><FaSyncAlt size={12} /></button>
      </div>
      {failed ? <p className="mt-2 text-xs text-rose-600">Could not load the question. Check that the server is running, then press refresh.</p> : (
        <div className="mt-2 flex items-center gap-3">
          <span className="whitespace-nowrap rounded-lg bg-white px-3 py-2 font-mono text-sm font-bold tracking-wide text-slate-800 shadow-inner dark:bg-gray-900 dark:text-white select-none">{c ? c.question : '…'}</span>
          <input inputMode="numeric" value={answer} onChange={(e) => change(e.target.value.replace(/[^0-9-]/g, ''))} placeholder="Your answer" maxLength={4} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-nts-green-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white" aria-label="Answer to the robot check" />
        </div>
      )}
    </div>
  );
}
