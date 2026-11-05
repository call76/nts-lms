import { SOCKET_URL } from './config';

// Turns whatever the admin saved into a usable URL:
//  - /uploads/...  -> served by the backend
//  - /images/...   -> bundled with the frontend (public folder)
//  - http(s)/data  -> used as is
export const asset = (u) => {
  if (!u || typeof u !== 'string') return '';
  if (/^(https?:|data:|blob:)/i.test(u)) return u;
  if (u.startsWith('/uploads')) return `${SOCKET_URL}${u}`;
  const base = process.env.PUBLIC_URL || '';
  return `${base}${u.startsWith('/') ? u : `/${u}`}`;
};

export const isVideoFile = (u = '') => /\.(mp4|webm|ogg|mov)(\?|$)/i.test(u);

// YouTube / Vimeo links -> embeddable URL (null when it is a plain video file or unknown)
export const embedUrl = (url = '') => {
  const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/.exec(url);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
};
