import React from 'react';
import { useSite } from '../store/siteStore';
import { embedUrl } from '../services/assets';

// Videos added by the admin (YouTube / Vimeo link, direct video link or an uploaded file).
const VideoGallery = ({ title, dark = false }) => {
  const { site, asset } = useSite();
  const videos = (site.videos || []).filter((v) => v.url);
  if (!videos.length) return null;
  return (
    <div>
      {title && <h2 className={`text-2xl sm:text-3xl font-extrabold mb-6 ${dark ? 'text-white' : 'text-nts-green-900'}`}>{title}</h2>}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {videos.map((v, i) => {
          const embed = embedUrl(v.url);
          return (
            <div key={`${v.url}-${i}`} className="bg-white rounded-2xl shadow-md overflow-hidden border border-nts-green-100 text-left">
              <div className="aspect-video bg-black">
                {embed
                  ? <iframe title={v.title || `Video ${i + 1}`} src={embed} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
                  : <video src={asset(v.url)} controls preload="metadata" className="w-full h-full" />}
              </div>
              {(v.title || v.description) && (
                <div className="p-4">
                  {v.title && <h3 className="font-bold text-nts-green-900">{v.title}</h3>}
                  {v.description && <p className="text-sm text-gray-600 mt-1">{v.description}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VideoGallery;
