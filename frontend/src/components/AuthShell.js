import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import { useSite } from '../store/siteStore';

// Split screen. Left: slideshow (images + captions managed in Site Settings > Login slideshow).
// Right: the form card with the logo. Each page starts on a different slide.
const AuthShell = ({ children, wide = false, start = 0 }) => {
  const { site, asset } = useSite();
  const slides = (site.authSlides || []).filter((s) => s.image);
  const [i, setI] = useState(0);

  useEffect(() => {
    setI(slides.length ? start % slides.length : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length, start]);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  const current = slides.length ? slides[i % slides.length] : null;

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-nts-green-50 to-white">
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden bg-nts-green-900">
        {slides.map((s, idx) => (
          <img key={`${s.image}-${idx}`} src={asset(s.image)} alt="" className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${idx === i ? 'opacity-100' : 'opacity-0'}`} />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-nts-green-950/85 via-nts-green-900/10 to-transparent" />
        {current && (
          <div className="absolute bottom-0 left-0 right-0 p-10 text-white">
            <h2 className="text-3xl font-bold drop-shadow">{current.title}</h2>
            <p className="mt-2 text-nts-gold-300 font-semibold tracking-wide">{current.subtitle}</p>
            <div className="flex gap-1.5 mt-5">
              {slides.map((s, idx) => <span key={`${s.image}-b${idx}`} className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-8 bg-nts-gold-400' : 'w-2 bg-white/50'}`} />)}
            </div>
          </div>
        )}
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 py-10 relative">
        {current && <img src={asset(current.image)} alt="" className="lg:hidden absolute inset-0 w-full h-full object-cover opacity-20" />}
        <div className={`relative bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} p-8 border-t-4 border-nts-gold-500`}>
          <div className="text-center mb-6">
            <Link to="/" className="flex justify-center"><BrandLogo className="h-28" /></Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthShell;
