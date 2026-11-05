import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaChevronDown, FaEnvelope, FaPhoneAlt, FaMapMarkerAlt, FaLifeRing, FaAward, FaBookReader, FaQuestionCircle, FaSearch } from 'react-icons/fa';
import PageHero from '../components/PageHero';
import { Card, inputCls, cx } from '../components/ui';
import { useSite } from '../store/siteStore';
import { useAuthStore } from '../store/authStore';

// Help & Support. The admin edits the title, intro and every question in System Builder > Help centre.
export default function Help() {
  const { site } = useSite();
  const role = useAuthStore((s) => s.user?.role);
  const [open, setOpen] = useState(0);
  const [q, setQ] = useState('');
  const help = site.help || {};
  const contact = site.contact || {};
  const faqs = useMemo(() => (help.faqs || [])
    .filter((f) => !f.roles || f.roles.split(',').map((r) => r.trim()).includes(role))
    .filter((f) => !q || `${f.q} ${f.a}`.toLowerCase().includes(q.toLowerCase())), [help.faqs, role, q]);
  const hasContact = contact.email || contact.phone || contact.address;

  return (
    <div className="mx-auto max-w-5xl px-3 py-6 sm:px-6">
      <PageHero slot="helpHero" title={help.title || 'Help & Support'} subtitle={help.intro} />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { to: '/certificates', icon: FaAward, title: 'Certificates', text: 'Request, download and verify.' },
          { to: '/library', icon: FaBookReader, title: 'Library', text: 'Books, notes and past papers.' },
          { to: '/messages', icon: FaLifeRing, title: 'Ask the team', text: 'Send a message to the admin.' },
        ].map(({ to, icon: Icon, title, text }) => (
          <Link key={to} to={to} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600 text-white"><Icon /></span>
            <span><span className="block text-sm font-extrabold text-slate-900 dark:text-white">{title}</span><span className="block text-xs text-slate-500">{text}</span></span>
          </Link>
        ))}
      </div>

      <Card className="mt-6 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900 dark:text-white"><FaQuestionCircle className="text-blue-600" /> Frequently asked questions</h2>
          <div className="relative w-full sm:w-64"><FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search answers…" className={`${inputCls} pl-10`} /></div>
        </div>
        {faqs.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No matching questions.</p>}
        <ul className="divide-y divide-slate-100 dark:divide-gray-700">
          {faqs.map((f, i) => (
            <li key={`${f.q}-${i}`}>
              <button onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between gap-3 py-3.5 text-left" aria-expanded={open === i}>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{f.q}</span>
                <FaChevronDown className={cx('shrink-0 text-slate-400 transition', open === i && 'rotate-180')} />
              </button>
              {open === i && <p className="pb-4 text-sm leading-relaxed text-slate-600 dark:text-gray-300">{f.a}</p>}
            </li>
          ))}
        </ul>
      </Card>

      {hasContact && (
        <Card className="mt-6 p-5">
          <h2 className="mb-3 text-lg font-extrabold text-slate-900 dark:text-white">Contact us</h2>
          <div className="grid gap-3 text-sm text-slate-700 dark:text-gray-200 sm:grid-cols-3">
            {contact.email && <a href={`mailto:${contact.email}`} className="flex items-center gap-2 hover:text-blue-700"><FaEnvelope className="text-blue-600" /> {contact.email}</a>}
            {contact.phone && <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 hover:text-blue-700"><FaPhoneAlt className="text-blue-600" /> {contact.phone}</a>}
            {contact.address && <p className="flex items-center gap-2"><FaMapMarkerAlt className="text-blue-600" /> {contact.address}</p>}
          </div>
        </Card>
      )}
    </div>
  );
}
