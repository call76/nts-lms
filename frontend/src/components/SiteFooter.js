import React from 'react';
import { useLocation } from 'react-router-dom';
import SocialLinks from './SocialLinks';
import { useSite } from '../store/siteStore';

// Small footer for logged-in pages: social links, contact and footer text from Site Settings.
const SiteFooter = () => {
  const { site } = useSite();
  const { pathname } = useLocation();
  const hasSocial = Object.values(site.social || {}).some((v) => (v || '').trim());
  const c = site.contact || {};
  const text = site.footer?.text;
  if (pathname.startsWith('/messages')) return null; // full-screen chat
  if (!hasSocial && !c.email && !c.phone && !text) return null;
  return (
    <footer className="mt-10 bg-nts-green-950 text-white/80">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
        <div className="text-center md:text-left">
          <p className="font-bold text-white">{site.brand.name}</p>
          <p className="text-xs">{[c.email, c.phone, c.address].filter(Boolean).join(' · ')}</p>
        </div>
        <SocialLinks className="justify-center text-white" />
        {text && <p className="text-xs">{text}</p>}
      </div>
    </footer>
  );
};

export default SiteFooter;
