import React from 'react';
import { useSite } from '../store/siteStore';

// Logo chosen by the admin (Site Settings > Branding)
const BrandLogo = ({ className = 'h-24', chip = false }) => {
  const { logo, site } = useSite();
  const img = <img src={logo} alt={site.brand?.name || 'NTS'} className={`${className} w-auto object-contain`} />;
  if (!chip) return img;
  return <span className="inline-flex bg-white rounded-xl px-2 py-1 shadow-sm">{img}</span>;
};

export default BrandLogo;
