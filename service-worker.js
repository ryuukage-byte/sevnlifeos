/* ═══════════════════════════════════════════════
   SEVNLIFE OS — service-worker.js
   Strategy: Cache First untuk seluruh aset (app 100% offline,
   tidak ada API dinamis yang butuh data real-time).
   ═══════════════════════════════════════════════ */

const swVersion = new URL(self.location.href).searchParams.get('v') || 'v8';
const CACHE_NAME = 'sevnlifeos-' + swVersion;
const CACHE_URLS = [
  './index.html',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/chartjs/chart.umd.js',
  './vendor/phosphor/regular/style.css',
  './vendor/phosphor/regular/Phosphor.woff2',
  './vendor/phosphor/fill/style.css',
  './vendor/phosphor/fill/Phosphor-Fill.woff2',
  './vendor/phosphor/bold/style.css',
  './vendor/phosphor/bold/Phosphor-Bold.woff2',
  'https://fonts.googleapis.com/css2?family=Quicksand:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(CACHE_URLS).catch(err => console.warn('[SW] Partial cache during install:', err))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res && res.status === 200 && event.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
