import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '../store/siteStore';

const isExternal = (to = '') => /^https?:\/\//i.test(to);

// Rotating promotion banner ("ads"). Slides are managed by the admin in Site Settings > Promotions.
const PromoBanner = ({ compact = false }) => {
  const { site, asset } = useSite();
  const slides = (site.promoSlides || []).filter((s) => s.active !== false && s.image);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % slides.length), 5500);
    return () => clearInterval(t);
  }, [slides.length]);

  if (!slides.length) return null;
  const current = i % slides.length;

  return (
    <div className={`relative overflow-hidden rounded-2xl shadow-md border border-nts-gold-400/40 ${compact ? 'h-40' : 'h-48 sm:h-56'}`}>
      {slides.map((s, idx) => (
        <div key={`${s.tag}-${idx}`} className={`absolute inset-0 transition-opacity duration-700 ${idx === current ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <img src={asset(s.image)} alt="" loading="lazy" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-nts-green-950/90 via-nts-green-900/65 to-transparent" />
          <div className="absolute inset-0 p-5 sm:p-8 flex flex-col justify-center text-white max-w-xl">
            {s.tag && <span className="self-start text-[10px] font-bold uppercase tracking-widest bg-nts-gold-500 text-nts-green-950 rounded-full px-3 py-1">{s.tag}</span>}
            <h3 className={`font-extrabold mt-3 ${compact ? 'text-lg' : 'text-xl sm:text-2xl'}`}>{s.title}</h3>
            {!compact && s.text && <p className="text-sm text-white/80 mt-1 hidden sm:block">{s.text}</p>}
            {s.to && s.cta && (isExternal(s.to)
              ? <a href={s.to} target="_blank" rel="noreferrer" className="self-start mt-3 bg-white text-nts-green-800 text-sm font-bold rounded-lg px-4 py-2 hover:bg-nts-gold-100 transition">{s.cta} →</a>
              : <Link to={s.to} className="self-start mt-3 bg-white text-nts-green-800 text-sm font-bold rounded-lg px-4 py-2 hover:bg-nts-gold-100 transition">{s.cta} →</Link>)}
          </div>
        </div>
      ))}
      {slides.length > 1 && (
        <div className="absolute bottom-3 right-4 flex gap-1.5">
          {slides.map((s, idx) => (
            <button key={`${s.tag}-d${idx}`} onClick={() => setI(idx)} aria-label={`Slide ${idx + 1}`} className={`h-2 rounded-full transition-all ${idx === current ? 'w-6 bg-nts-gold-400' : 'w-2 bg-white/60'}`} />
          ))}
        </div>
      )}
    </div>
  );
};

export default PromoBanner;
