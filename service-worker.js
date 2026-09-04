// Service Worker — Alfajores Manager
// Debe vivir en la raíz del sitio: desde js/ el scope quedaría limitado a /js/
// y no podría controlar index.html.
const CACHE_NAME = 'alfajores-v2.2.0';

// Rutas RELATIVAS: con '/index.html' la app se rompía al publicarla
// en una subcarpeta (ej. usuario.github.io/App_Maite/).
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/dashboard.js',
  './js/inventario.js',
  './js/compras.js',
  './js/recetas.js',
  './js/produccion.js',
  './js/costos.js',
  './js/ventas.js',
  './js/pedidos.js',
  './js/clientes.js',
  './js/estadisticas.js',
  './js/reportes.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      // addAll falla entero si un solo archivo da 404; así un asset que falte
      // no deja la app sin caché.
      .then(cache => Promise.allSettled(ASSETS.map(a => cache.add(a))))
  );
  // OJO: acá NO se llama a skipWaiting(). La versión nueva queda "esperando"
  // hasta que se toque "Actualizar" en el cartel. Si se activara sola, la app
  // podría recargarse en medio de una venta a medio cargar.
});

// El cartel de actualización pide el relevo por acá
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/**
 * Estrategia: red primero, caché de respaldo.
 * Antes era caché primero, así que una vez instalada la app NUNCA veía una
 * actualización. Ahora se usa la versión nueva si hay internet, y la copia
 * guardada si no hay.
 */
self.addEventListener('fetch', e => {
  const req = e.request;

  // Solo GET http(s): evita romper con extensiones del navegador
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;

  // version.json siempre desde la red y sin guardar: es justamente el archivo
  // que se consulta para saber si hay una versión nueva. Si se cacheara,
  // la app leería para siempre el número viejo y nunca avisaría nada.
  if (req.url.includes('version.json')) {
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => new Response('{}', {
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // Las fuentes de Google se cachean al vuelo para que offline se vea igual
  const esFuente = /fonts\.(googleapis|gstatic)\.com/.test(req.url);

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && (res.type === 'basic' || esFuente)) {
          const copia = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copia));
        }
        return res;
      })
      .catch(() => caches.match(req).then(cached =>
        cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)
      ))
  );
});
