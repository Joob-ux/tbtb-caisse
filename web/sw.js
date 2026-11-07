/* Cache hors ligne : l'appli fonctionne sans internet une fois installée.
   Réseau d'abord (les mises à jour arrivent tout de suite), cache seulement si pas de connexion.
   Pensez à changer CACHE à chaque mise à jour importante. */
const CACHE = 'tbtb-v12';
const FILES = ['./', './index.html', './style.css', './app.js', './ticket-pdf.js', './ticket-escpos.js', './suivi-sync.js', './lib/jspdf.umd.min.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './assets/logo-ticket.jpg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
