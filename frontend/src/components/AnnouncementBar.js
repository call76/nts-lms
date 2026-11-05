import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaTimes, FaBullhorn } from 'react-icons/fa';
import { useSite } from '../store/siteStore';

// Site-wide notice controlled by the admin (Site Settings > Branding & texts).
const AnnouncementBar = () => {
  const { site } = useSite();
  const a = site.announcement || {};
  const [hidden, setHidden] = useState(() => sessionStorage.getItem('nts-ann') === (a.text || ''));
  if (!a.enabled || !a.text || hidden) return null;
  const close = () => { try { sessionStorage.setItem('nts-ann', a.text); } catch (e) { /* ignore */ } setHidden(true); };
  const content = <span className="font-semibold">{a.text}</span>;
  return (
    <div className="fixed bottom-16 md:bottom-0 inset-x-0 z-[60] bg-nts-gold-500 text-nts-green-950 text-sm px-10 py-2.5 flex items-center justify-center gap-3 shadow-[0_-2px_10px_rgba(0,0,0,.15)]">
      <FaBullhorn className="shrink-0" />
      {a.link ? (/^https?:/i.test(a.link) ? <a href={a.link} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{content}</a> : <Link to={a.link} className="hover:underline">{content}</Link>) : content}
      <button onClick={close} aria-label="Close" className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-black/10 rounded"><FaTimes size={12} /></button>
    </div>
  );
};

export default AnnouncementBar;
