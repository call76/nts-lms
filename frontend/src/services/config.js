// Single source of truth for backend URLs.
// 1) REACT_APP_API_URL (frontend/.env) always wins.
// 2) Opened from localhost / a LAN address  -> talk to the backend on the SAME machine, port 5000
//    (before, it always called the Render server, which is why login said
//    "Cannot reach the server. Check your connection." while only the local backend was running).
// 3) Any other host (your deployed site)     -> the hosted backend below.
const HOSTED_API = 'https://nts-backend-409a.onrender.com/api';

const host = typeof window !== 'undefined' ? window.location.hostname : '';
const isLocalHost = /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(host);
const DEFAULT_API = isLocalHost ? `http://${host}:5000/api` : HOSTED_API;

export const API_URL = (process.env.REACT_APP_API_URL || DEFAULT_API).replace(/\/$/, '');
export const SOCKET_URL = (process.env.REACT_APP_SOCKET_URL || API_URL.replace(/\/api$/, '')).replace(/\/$/, '');
