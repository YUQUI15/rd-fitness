/* RD Fitness Club - Service Worker (funciona sin internet y actualización instantánea) */
const VERSION = 'rd-v5.4';
const SHELL = [
  '/', '/index.html', '/display.html', '/admin/', '/admin/index.html', '/admin/cards.html',
  '/css/style.css', '/js/common.js', '/js/member-hub.js', '/js/app.js', '/js/admin-core.js', '/js/admin-scan.js', '/js/admin-members.js', '/js/admin-other.js', '/js/admin-announce.js', '/js/workout.js',
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
  // Imágenes de ejercicios y fotos: primero lo guardado (pero solo si es válido 200)
  if (url.pathname.startsWith('/ex/') || url.pathname.startsWith('/photos/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(req).then(r => (r && r.ok) ? r : fetch(req).then(n => { if (n.ok) { const c = n.clone(); caches.open(VERSION).then(ch => ch.put(req, c)); } return n; }).catch(() => new Response('', { status: 504 }))));
    return;
  }
  // JS y CSS: red primero forzando validación de versión fresca, respaldo en caché si no hay internet
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(n => {
    if (n.ok) { const c = n.clone(); caches.open(VERSION).then(ch => ch.put(req, c)); }
    return n;
  }).catch(() => caches.match(req)));
});

// Mensajes para actualizar versión o precargar datos
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (e.data && e.data.type === 'CLEAR_ALL_CACHES') {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  }
  if (e.data && e.data.type === 'precache' && Array.isArray(e.data.urls)) {
    e.waitUntil(caches.open(VERSION).then(c => Promise.all(e.data.urls.map(u => c.match(u).then(h => h || c.add(u).catch(() => { }))))));
  }
});

// ---- Notificaciones push con sonido, vibración y contenido multimedia ----
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'RD Fitness Club', body: e.data ? e.data.text() : '' }; }
  const isSilent = d.silent === true;
  const vibratePattern = Array.isArray(d.vibrate) && d.vibrate.length ? d.vibrate : (isSilent ? [] : [350, 150, 350, 150, 500]);

  const opts = {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: d.tag || ('rd-aviso-' + Date.now()),
    renotify: true,
    requireInteraction: false,
    silent: isSilent,
    vibrate: vibratePattern,
    data: { url: d.url || '/?inbox=1' }
  };
  if (d.image) opts.image = d.image;

  try {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        client.postMessage({ type: 'rd-new-announcement', data: d });
      }
    }).catch(() => {});
  } catch {}

  e.waitUntil(self.registration.showNotification(d.title || 'RD Fitness Club', opts));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/?inbox=1';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if (new URL(c.url).origin === self.location.origin && !c.url.includes('/admin')) {
        c.postMessage({ type: 'open-inbox' });
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
