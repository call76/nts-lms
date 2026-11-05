import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaCheckCircle, FaTimesCircle, FaShieldAlt } from 'react-icons/fa';
import api from '../services/api';
import HumanCheck from '../components/HumanCheck';

// Public page opened by the QR code on a certificate.
export default function VerifyCertificate() {
  const { code } = useParams();
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    setBusy(true); setError(''); setRes(null);
    try { const r = await api.get(`/certificates/verify/${encodeURIComponent(code)}`); setRes(r.data); }
    catch (e) { const d = e.response?.data; if (d?.valid === false) setRes(d); else setError(d?.error || 'Could not verify. Is the server running?'); }
    setBusy(false);
  };
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-4 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl dark:bg-gray-900">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-2xl text-emerald-700"><FaShieldAlt /></div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Certificate verification</h1>
          <p className="mt-1 break-all font-mono text-xs text-slate-500">{code}</p>
        </div>
        {!res && (<>
          <HumanCheck className="mb-4" />
          <button onClick={verify} disabled={busy} className="w-full rounded-xl bg-emerald-700 py-3 font-bold text-white hover:bg-emerald-800 disabled:opacity-50">{busy ? 'Checking…' : 'Verify certificate'}</button>
          {error && <p className="mt-3 text-center text-sm text-rose-600">{error}</p>}
        </>)}
        {res && (
          <div className="text-center">
            {res.valid ? <FaCheckCircle className="mx-auto text-5xl text-emerald-600" /> : <FaTimesCircle className="mx-auto text-5xl text-rose-500" />}
            <p className={`mt-3 text-lg font-extrabold ${res.valid ? 'text-emerald-700' : 'text-rose-600'}`}>{res.valid ? 'This certificate is valid' : (res.message || res.error || 'Certificate not valid')}</p>
            {res.valid && (
              <dl className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-left text-sm dark:bg-gray-800">
                {[['Awarded to', res.student], ['Programme', res.program], ['Field', res.trade], ['Company', res.company], ['Issued', res.issuedAt && new Date(res.issuedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })]].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className="text-right font-semibold text-slate-900 dark:text-white">{v}</dd></div>
                ))}
              </dl>
            )}
            <button onClick={() => setRes(null)} className="mt-5 text-sm font-semibold text-emerald-700">Check again</button>
          </div>
        )}
        <p className="mt-6 text-center text-xs text-slate-400"><Link to="/" className="hover:underline">NTS Professional Learning</Link></p>
      </div>
    </main>
  );
}
