import React from 'react';
import SiteImg from './SiteImg';

// Blue banner at the top of each page (v6.0 look). `slot` is the image slot the admin can change.
const FADE = 'linear-gradient(to right, transparent 0%, #000 45%)';
const PageHero = ({ slot, title, subtitle, children, className = 'min-h-[9rem] sm:min-h-[11rem]', align = 'left' }) => (
  <div className={`relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950 via-blue-800 to-blue-600 shadow-lg ${className}`}>
    <SiteImg slot={slot} loading="lazy" className="absolute right-0 top-0 h-full w-3/5 object-cover sm:w-1/2" style={{ WebkitMaskImage: FADE, maskImage: FADE }} />
    <div className={`relative flex h-full min-h-[inherit] flex-col justify-center px-5 py-5 text-white sm:px-10 ${align === 'center' ? 'items-center text-center' : ''}`}>
      <h1 className="max-w-[70%] text-2xl font-extrabold drop-shadow sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 max-w-[70%] text-sm font-semibold text-yellow-300 sm:text-base">{subtitle}</p>}
      {children}
    </div>
  </div>
);

export default PageHero;
