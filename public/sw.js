/* Service worker Cek Hidran
 * - Aset statis Next.js: cache-first
 * - Navigasi halaman: network-first, fallback ke cache (abaikan query) lalu /offline
 * - /api/*: selalu jaringan (antrean offline ditangani IndexedDB di klien)
 */
const VERSION = 'cek-hidran-v1';
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const PRECACHE = ['/offline', '/manifest.webmanifest', '/icons/192', '/icons/512'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

function isStatic(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest' ||
    /\.(?:woff2?|png|svg|jpg|jpeg|webp|ico)$/.test(url.pathname)
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, res.clone());
  }
  return res;
}

async function cachePage(url, res) {
  if (!res.ok || res.redirected || res.type !== 'basic') return;
  const cache = await caches.open(PAGE_CACHE);
  const u = new URL(url);
  await cache.put(u.origin + u.pathname, res);
}

async function networkFirstPage(request) {
  try {
    const res = await fetch(request);
    cachePage(request.url, res.clone());
    return res;
  } catch {
    const u = new URL(request.url);
    const cache = await caches.open(PAGE_CACHE);
    const cached = (await cache.match(u.origin + u.pathname)) || (await caches.match(request, { ignoreSearch: true }));
    if (cached) return cached;
    return (await caches.match('/offline')) || new Response('Offline', { status: 503 });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  if (isStatic(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
  }
});

// Klien meminta halaman tertentu di-cache (beserta chunk JS-nya) agar alur petugas bisa offline.
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'WARM' || !Array.isArray(data.urls)) return;
  event.waitUntil(
    (async () => {
      const staticCache = await caches.open(STATIC_CACHE);
      for (const path of data.urls) {
        try {
          const res = await fetch(path, { credentials: 'same-origin' });
          if (!res.ok || res.redirected) continue;
          const html = await res.clone().text();
          await cachePage(new URL(path, self.location.origin).href, res);
          const assets = Array.from(new Set(html.match(/\/_next\/static\/[^"'\\\s)]+/g) || []));
          await Promise.all(
            assets.map(async (a) => {
              if (await staticCache.match(a)) return;
              try {
                const r = await fetch(a);
                if (r.ok) await staticCache.put(a, r);
              } catch { /* abaikan */ }
            }),
          );
        } catch { /* offline */ }
      }
    })(),
  );
});
