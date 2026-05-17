'use strict';

const CACHE_NAME = 'jimma-mis-v1';
const OFFLINE_PAGE = new URL('offline.html', self.registration.scope).href;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll([OFFLINE_PAGE]).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Never intercept API calls — always go to network
  if (url.pathname.includes('/api/')) return;

  // Vite immutable assets — cache first
  if (url.pathname.includes('/assets/')) {
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
          return res;
        });
      }),
    );
    return;
  }

  // HTML navigation — network first, offline fallback
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_PAGE);
          return offline ?? new Response('<h1>You are offline</h1>', { headers: { 'Content-Type': 'text/html' } });
        }),
    );
    return;
  }

  // Everything else — stale-while-revalidate
  e.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached ?? new Response('Offline', { status: 503 }));
        return cached ?? network;
      }),
    ),
  );
});
