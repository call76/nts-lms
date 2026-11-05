// Minimal offline-friendly service worker.
// The old one cached non-existent bundle names (cache.addAll then failed the install) and served
// everything cache-first, including API calls, which showed stale data.
const CACHE_NAME = 'nts-v2';
const SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Only handle same-origin GET page/asset requests. Never cache API, socket or upload traffic.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && (request.mode === 'navigate' || /\.(js|css|png|svg|ico|json)$/.test(url.pathname))) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('/index.html')))
  );
});
