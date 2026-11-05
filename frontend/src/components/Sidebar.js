// V6 desktop sidebar. Items, labels, order, colours and the bottom promo card are controlled by the
// admin in System Builder. Mobile keeps the top menu + bottom bar.
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSite } from '../store/siteStore';
import { useMenu } from '../services/menu';

const STYLES = {
  navy: { shell: 'bg-gradient-to-b from-blue-950 via-blue-900 to-blue-800 text-white', idle: 'text-blue-100 hover:bg-white/10', active: 'bg-blue-500 text-white shadow-lg', border: 'border-white/20' },
  brand: { shell: 'bg-gradient-to-b from-nts-green-900 via-nts-green-800 to-nts-green-700 text-white', idle: 'text-white/80 hover:bg-white/10', active: 'bg-nts-green-500 text-white shadow-lg', border: 'border-white/20' },
  dark: { shell: 'bg-gradient-to-b from-slate-950 to-slate-800 text-white', idle: 'text-slate-300 hover:bg-white/10', active: 'bg-blue-600 text-white shadow-lg', border: 'border-white/10' },
  light: { shell: 'bg-white text-slate-800 border-r border-slate-200 dark:bg-gray-900 dark:text-white dark:border-gray-800', idle: 'text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800', active: 'bg-blue-600 text-white shadow', border: 'border-slate-200' },
};

const Sidebar = () => {
  const { unreadCount } = useAuthStore();
  const { site, logo } = useSite();
  const loc = useLocation();
  const items = useMenu();
  const st = STYLES[site.system?.sidebar] || STYLES.navy;
  const brandDefault = (site.brand?.logoUrl || '/images/logo.png') === '/images/logo.png';
  const isActive = (to) => {
    const [path, hash] = to.split('#');
    if (hash) return loc.pathname === path && (loc.hash || '#analytics') === `#${hash}` && loc.hash !== '';
    return path === '/' ? loc.pathname === '/' : loc.pathname === path || (path !== '/admin' && loc.pathname.startsWith(`${path}/`));
  };
  return (
    <aside className={`fixed inset-y-0 left-0 z-40 hidden w-64 flex-col shadow-2xl lg:flex ${st.shell}`}>
      <Link to="/" className="flex justify-center px-4 pb-2 pt-4">
        <img src={brandDefault ? '/images/v6-logo.webp' : logo} alt={site.brand?.name || 'NTS'} className={brandDefault ? 'h-24 w-auto object-contain' : 'h-16 w-auto rounded-lg bg-white px-2 object-contain'} />
      </Link>
      <nav className="mt-2 flex-1 space-y-1 overflow-y-auto px-3 pb-3 [scrollbar-width:thin]">
        {items.map((i) => {
          const cls = `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${!i.external && isActive(i.to) ? st.active : st.idle}`;
          const inner = (
            <>
              <i.icon className="shrink-0 text-base" />
              <span className="flex-1 truncate">{i.label}</span>
              {i.badge && unreadCount > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </>
          );
          return i.external
            ? <a key={i.id} href={i.to} target={i.newTab ? '_blank' : undefined} rel="noreferrer" className={cls}>{inner}</a>
            : <Link key={i.id} to={i.to} className={cls}>{inner}</Link>;
        })}
      </nav>
      {site.system?.sidebarPromo !== false && (
        <div className={`m-3 overflow-hidden rounded-2xl border shadow-lg ${st.border}`}>
          <div className="relative">
            <img src="/images/v6-graduates2.webp" alt="" className="h-20 w-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-blue-950 to-blue-900/30" />
            <p className="absolute inset-x-0 bottom-1.5 px-3 text-center text-sm font-extrabold leading-tight text-white">{site.system?.sidebarPromoTitle || 'Education Today,'}<br /><span className="text-yellow-300">{site.system?.sidebarPromoAccent || 'A Better Tomorrow'}</span></p>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
