import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaSearch, FaAward, FaUserGraduate } from 'react-icons/fa';
import api from '../services/api';
import { Card, Badge, Avatar, EmptyState, Skeleton, PageHeader, inputCls } from '../components/ui';

const Talent = () => {
  const [q, setQ] = useState('');
  const [people, setPeople] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get('/talent', { params: { q: q.trim() || undefined } }).then((r) => setPeople(r.data)).catch(() => setPeople([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <PageHeader icon={FaUserGraduate} title="Certified students" subtitle="Students who completed a course and hold a valid certificate" />
      <div className="relative mb-6 max-w-md">
        <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, department or school…" className={`${inputCls} pl-10`} />
      </div>

      {people === null && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-48" />)}</div>}
      {people && people.length === 0 && <Card><EmptyState icon={FaAward} title="No certified students found" text="Try another search." /></Card>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {people?.map((p) => (
          <Card key={p.id} className="p-5 transition hover:-translate-y-0.5 hover:shadow-md fade-in">
            <div className="flex items-center gap-3">
              <Avatar name={p.fullName} src={p.avatar} size={48} />
              <div className="min-w-0 flex-1">
                <Link to={`/profile/${p.id}`} className="block truncate font-bold text-slate-900 hover:underline dark:text-white">{p.fullName}</Link>
                <p className="truncate text-xs text-slate-500 dark:text-gray-400">{[p.department, p.school].filter(Boolean).join(' · ') || 'Student'}</p>
              </div>
              {p.avgScore != null && <Badge tone={p.avgScore >= 70 ? 'brand' : 'amber'}>{p.avgScore}%</Badge>}
            </div>
            {p.bio && <p className="mt-3 line-clamp-2 text-sm text-slate-600 dark:text-gray-400">{p.bio}</p>}
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {p.certificates.slice(0, 4).map((c) => <li key={c.code}><Badge tone="slate"><FaAward className="mr-1" />{c.module?.name}</Badge></li>)}
              {p.certificates.length > 4 && <li><Badge tone="slate">+{p.certificates.length - 4}</Badge></li>}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Talent;
