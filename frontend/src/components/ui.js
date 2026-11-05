// Shared design primitives (cards, stat tiles, badges, charts, empty states).
// Everything supports dark mode and follows the brand colour chosen in Site Settings
// (note: "green" / "emerald" / "teal" are remapped to the brand colour in tailwind.config.js).
import React from 'react';
import { Link } from 'react-router-dom';
import { asset } from '../services/assets';
import { initials } from '../services/format';

export const cx = (...a) => a.filter(Boolean).join(' ');

export const Card = ({ className = '', children, ...rest }) => (
  <div className={cx('rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800', className)} {...rest}>{children}</div>
);

export const CardHeader = ({ title, subtitle, action }) => (
  <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
    <div className="min-w-0">
      <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">{subtitle}</p>}
    </div>
    {action}
  </div>
);

// Static class names so Tailwind can see them
export const TONES = {
  brand: { chip: 'bg-nts-green-50 text-nts-green-700 dark:bg-nts-green-900/40 dark:text-nts-green-200', bar: 'bg-nts-green-600', dot: 'bg-nts-green-600' },
  blue: { chip: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', bar: 'bg-blue-500', dot: 'bg-blue-500' },
  violet: { chip: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300', bar: 'bg-violet-500', dot: 'bg-violet-500' },
  amber: { chip: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', bar: 'bg-amber-500', dot: 'bg-amber-500' },
  rose: { chip: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300', bar: 'bg-rose-500', dot: 'bg-rose-500' },
  sky: { chip: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300', bar: 'bg-sky-500', dot: 'bg-sky-500' },
  slate: { chip: 'bg-slate-100 text-slate-600 dark:bg-gray-700 dark:text-gray-300', bar: 'bg-slate-400', dot: 'bg-slate-400' },
};

export const Badge = ({ tone = 'slate', children, className = '' }) => (
  <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold', (TONES[tone] || TONES.slate).chip, className)}>{children}</span>
);

// V6 look: tinted card + solid coloured icon tile (blue / green / purple / orange)
const STAT = {
  brand: ['from-emerald-50 to-white dark:from-emerald-950/30 dark:to-gray-800', 'bg-emerald-600'],
  green: ['from-emerald-50 to-white dark:from-emerald-950/30 dark:to-gray-800', 'bg-emerald-600'],
  blue: ['from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-800', 'bg-blue-600'],
  violet: ['from-violet-50 to-white dark:from-violet-950/30 dark:to-gray-800', 'bg-violet-600'],
  amber: ['from-amber-50 to-white dark:from-amber-950/30 dark:to-gray-800', 'bg-amber-500'],
  rose: ['from-rose-50 to-white dark:from-rose-950/30 dark:to-gray-800', 'bg-rose-600'],
  slate: ['from-slate-50 to-white dark:from-gray-800 dark:to-gray-800', 'bg-slate-600'],
};
export const StatCard = ({ icon: Icon, label, value, hint, tone = 'brand', to }) => {
  const [bg, tile] = STAT[tone] || STAT.brand;
  const body = (
    <div className="flex items-center gap-4 p-4 sm:p-5">
      <div className={cx('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-md', tile)}>{Icon && <Icon className="text-2xl" />}</div>
      <div className="min-w-0">
        <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">{value ?? 0}</p>
        <p className="truncate text-sm font-semibold text-slate-600 dark:text-gray-300">{label}</p>
        {hint && <p className="truncate text-xs text-slate-500 dark:text-gray-400">{hint}</p>}
      </div>
    </div>
  );
  const base = cx('block rounded-2xl border border-slate-200/70 bg-gradient-to-br shadow-sm transition dark:border-gray-700', bg);
  return to
    ? <Link to={to} className={cx(base, 'hover:-translate-y-0.5 hover:shadow-md')}>{body}</Link>
    : <div className={base}>{body}</div>;
};

export const ProgressBar = ({ value = 0, tone = 'brand', className = '' }) => {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700', className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-all duration-500', (TONES[tone] || TONES.brand).bar)} style={{ width: `${v}%` }} />
    </div>
  );
};

// items: [{ label, value }]  - tiny dependency-free column chart
export const BarChart = ({ items = [], height = 120, tone = 'brand' }) => {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {items.map((i) => (
          <div key={i.label} className="group relative flex h-full flex-1 items-end" title={`${i.label}: ${i.value}`}>
            <div className={cx('w-full rounded-t-md transition-all duration-500', i.value ? (TONES[tone] || TONES.brand).bar : 'bg-slate-100 dark:bg-gray-700')} style={{ height: `${Math.max(i.value ? 8 : 3, (i.value / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        {items.map((i, idx) => <span key={i.label} className="flex-1 text-center text-[10px] text-slate-400">{idx % 2 === 0 ? i.label : ''}</span>)}
      </div>
    </div>
  );
};

const SEGMENTS = ['bg-nts-green-600', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500'];
export const StackedBar = ({ items = [] }) => {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700">
        {items.map((i, idx) => <div key={i.label} className={SEGMENTS[idx % SEGMENTS.length]} style={{ width: `${(i.value / total) * 100}%` }} title={`${i.label}: ${i.value}`} />)}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {items.map((i, idx) => (
          <li key={i.label} className="flex items-center justify-between text-slate-600 dark:text-gray-300">
            <span className="flex items-center gap-2"><span className={cx('h-2 w-2 rounded-full', SEGMENTS[idx % SEGMENTS.length])} />{i.label}</span>
            <b className="tabular-nums">{i.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const Avatar = ({ name, src, size = 40, className = '' }) => (
  src
    ? <img src={asset(src)} alt={name || ''} className={cx('shrink-0 rounded-full object-cover', className)} style={{ width: size, height: size }} />
    : <div className={cx('flex shrink-0 items-center justify-center rounded-full bg-nts-green-100 font-bold text-nts-green-700 dark:bg-nts-green-900/50 dark:text-nts-green-200', className)} style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials(name)}</div>
);

export const EmptyState = ({ icon: Icon, title, text, action }) => (
  <div className="flex flex-col items-center px-6 py-10 text-center">
    {Icon && <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400 dark:bg-gray-700"><Icon /></div>}
    <p className="font-semibold text-slate-700 dark:text-gray-200">{title}</p>
    {text && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-gray-400">{text}</p>}
    {action}
  </div>
);

export const Skeleton = ({ className = '' }) => <div className={cx('animate-pulse rounded-xl bg-slate-200/70 dark:bg-gray-700', className)} />;

export const PageHeader = ({ title, subtitle, icon: Icon, actions }) => (
  <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
    <div className="flex items-center gap-4">
      {Icon && <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-nts-green-600 to-nts-green-800 text-xl text-white shadow-md"><Icon /></div>}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-gray-400">{subtitle}</p>}
      </div>
    </div>
    {actions}
  </div>
);

export const PRIORITY = {
  NORMAL: { border: 'border-l-slate-300 dark:border-l-gray-600', tone: 'slate', label: 'Notice' },
  IMPORTANT: { border: 'border-l-amber-400', tone: 'amber', label: 'Important' },
  URGENT: { border: 'border-l-rose-500', tone: 'rose', label: 'Urgent' },
};

export const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-nts-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-nts-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-nts-green-400 focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-gray-900';
export const btnGhost = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-nts-green-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700';
export const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-nts-green-500 focus:outline-none focus:ring-2 focus:ring-nts-green-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:ring-nts-green-800';
