// Service Worker - Alfajores Manager
const CACHE_NAME = 'alfajores-v1.0.0';
const ASSETS = [
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/dashboard.js',
  '/js/inventario.js',
  '/js/recetas.js',
  '/js/ventas.js',
  '/js/estadisticas.js',
  '/js/reportes.js',
  '/manifest.json'
];

// Install: cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first strategy
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
