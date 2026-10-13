/* RD Fitness Club - Service Worker (funciona sin internet) */
const VERSION = 'rd-v2.3';
const SHELL = [
  '/', '/index.html', '/admin/', '/admin/index.html', '/admin/cards.html',
  '/css/style.css', '/js/common.js', '/js/app.js', '/js/admin-core.js', '/js/admin-scan.js', '/js/admin-members.js', '/js/admin-other.js', '/js/workout.js',
  '/vendor/qrcode.js', '/vendor/jsQR.js', '/logo.svg', '/manifest.json', '/admin/manifest.json',
  '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => { })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // la API nunca se guarda: la app maneja el modo offline

  // Navegación: red primero, y si falla, lo guardado
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSION).then(ch => ch.put(req, c)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match(url.pathname.startsWith('/admin') ? '/admin/' : '/'))));
    return;
  }
  // Imágenes de ejercicios y fotos: primero lo guardado
  if (url.pathname.startsWith('/ex/') || url.pathname.startsWith('/photos/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(n => { if (n.ok) { const c = n.clone(); caches.open(VERSION).then(ch => ch.put(req, c)); } return n; }).catch(() => new Response('', { status: 504 }))));
    return;
  }
  // Resto: devuelve lo guardado y actualiza en segundo plano
  e.respondWith(caches.match(req).then(cached => {
    const net = fetch(req).then(n => { if (n.ok) { const c = n.clone(); caches.open(VERSION).then(ch => ch.put(req, c)); } return n; }).catch(() => cached);
    return cached || net;
  }));
});

// Mensaje para precargar imágenes de ejercicios (entrenar sin internet)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'precache' && Array.isArray(e.data.urls)) {
    e.waitUntil(caches.open(VERSION).then(c => Promise.all(e.data.urls.map(u => c.match(u).then(h => h || c.add(u).catch(() => { }))))));
  }
});
