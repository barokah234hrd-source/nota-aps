// Service worker Nota Surabaya — naikkan VERSION setiap ada perubahan berkas.
const VERSION = 'v1.0.1';
const CACHE = `notasby-${VERSION}`;
const ASSETS = ['./', './index.html', './manifest.webmanifest', './css/style.css',
  './js/app.js', './js/db.js', './js/calc.js', './js/util.js', './js/pdf-lite.js', './js/nota.js', './js/nota-pdf.js', './js/nota-ui.js', './js/nota-image.js',
  './js/pages/buat.js', './js/pages/riwayat.js', './js/pages/pengaturan.js',
  './icons/logo-320.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS))); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('notasby-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : new Response('Offline', { status: 503 })))));
});
