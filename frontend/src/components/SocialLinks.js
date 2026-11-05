import React from 'react';
import { FaFacebookF, FaInstagram, FaTwitter, FaYoutube, FaLinkedinIn, FaTiktok, FaWhatsapp, FaGlobe } from 'react-icons/fa';
import { useSite } from '../store/siteStore';

const ICONS = [
  ['facebook', FaFacebookF, 'Facebook'],
  ['instagram', FaInstagram, 'Instagram'],
  ['twitter', FaTwitter, 'Twitter / X'],
  ['youtube', FaYoutube, 'YouTube'],
  ['linkedin', FaLinkedinIn, 'LinkedIn'],
  ['tiktok', FaTiktok, 'TikTok'],
  ['whatsapp', FaWhatsapp, 'WhatsApp'],
  ['website', FaGlobe, 'Website'],
];

const toHref = (key, v) => {
  if (/^https?:\/\//i.test(v)) return v;
  if (key === 'whatsapp') return `https://wa.me/${v.replace(/\D/g, '')}`;
  return `https://${v}`;
};

// Social media icons; only the links filled in by the admin are shown.
const SocialLinks = ({ className = '', size = 'w-9 h-9' }) => {
  const { site } = useSite();
  const items = ICONS.filter(([key]) => (site.social?.[key] || '').trim());
  if (!items.length) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {items.map(([key, Icon, label]) => (
        <a key={key} href={toHref(key, site.social[key].trim())} target="_blank" rel="noreferrer" aria-label={label} title={label}
          className={`${size} rounded-full bg-white/10 hover:bg-nts-gold-500 hover:text-nts-green-950 text-current grid place-items-center transition border border-white/20`}>
          <Icon size={15} />
        </a>
      ))}
    </div>
  );
};

export default SocialLinks;
