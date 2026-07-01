// ══════════════════════════════════════════
//  SERVICE WORKER — Suite Ruta 220
//  Modo offline: caché de app + datos
// ══════════════════════════════════════════

const CACHE_VERSION = 'ruta220-v1';
const APP_CACHE     = `${CACHE_VERSION}-app`;
const DATA_CACHE    = `${CACHE_VERSION}-data`;

// Recursos de la app a cachear siempre
const APP_SHELL = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;600&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js',
];

// Dominios de datos de Supabase a cachear
const SUPABASE_HOST = 'okjavwjjfikzlypoprsr.supabase.co';

// ── INSTALL: precachear app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpiar cachés viejas ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('ruta220-') && k !== APP_CACHE && k !== DATA_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia según tipo de recurso ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Supabase: Network First → caché como fallback
  if (url.hostname === SUPABASE_HOST) {
    event.respondWith(networkFirstData(event.request));
    return;
  }

  // Fuentes y CDN externos: Cache First
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('jsdelivr.net')
  ) {
    event.respondWith(cacheFirstExternal(event.request));
    return;
  }

  // App shell (mismo origen): Stale While Revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
});

// ── Estrategia: Network First con caché de datos ──
async function networkFirstData(request) {
  // Solo cachear GET, nunca POST/PATCH/DELETE
  if (request.method !== 'GET') {
    return fetch(request);
  }

  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      const cache = await caches.open(DATA_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      // Notificar al cliente que estamos en modo offline
      notifyOffline();
      return cached;
    }
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ── Estrategia: Cache First para recursos externos ──
async function cacheFirstExternal(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(APP_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}

// ── Estrategia: Stale While Revalidate para el app shell ──
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      caches.open(APP_CACHE).then(cache => cache.put(request, response.clone()));
    }
    return response;
  }).catch(() => null);

  return cached || fetchPromise;
}

// ── Notificar al cliente que está en modo offline ──
let offlineNotified = false;
function notifyOffline() {
  if (offlineNotified) return;
  offlineNotified = true;
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage({ type: 'OFFLINE_MODE' }));
  });
  // Reset después de 30 segundos por si reconecta
  setTimeout(() => { offlineNotified = false; }, 30000);
}

// ── Escuchar mensaje de reconexión desde el cliente ──
self.addEventListener('message', event => {
  if (event.data?.type === 'ONLINE_RESTORED') {
    offlineNotified = false;
  }
});
