'use strict';

// Bump this string whenever you deploy a new build to force cache invalidation.
const CACHE_NAME = 'jimma-mis-v2';
const SCOPE = self.registration.scope;
const OFFLINE_PAGE = new URL('offline.html', SCOPE).href;

// ── Install ───────────────────────────────────────────────────────────────────
// Precache the app shell + offline page. Everything else is cached lazily.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) =>
        Promise.all([
          cache.add(SCOPE).catch(() => {}),        // SPA shell
          cache.add(OFFLINE_PAGE).catch(() => {}), // Offline fallback
        ]),
      )
      .then(() => self.skipWaiting()),
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
// Delete any old cache versions.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Only handle GET — never intercept POST/PUT/DELETE (form submits, uploads)
  if (request.method !== 'GET') return;

  // Skip cross-origin (Google Fonts, CDNs, etc.)
  if (url.origin !== self.location.origin) return;

  // ── API calls: always go to the network. Never cache API responses.
  if (url.pathname.includes('/api/')) return;

  // ── Vite hashed assets (/assets/index-XXXXXX.js): cache-first, immutable.
  if (url.pathname.includes('/assets/')) {
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
          }
          return res;
        });
      }),
    );
    return;
  }

  // ── HTML navigation: network-first, NO dynamic HTML caching.
  //
  // We never cache navigation responses to avoid the stale-HTML trap where the
  // cached shell references old hashed asset filenames that no longer exist on
  // the server after a redeploy. Instead we precache the shell during install
  // and serve it as the offline fallback so the SPA can still load offline.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(async () => {
        const shell = await caches.match(SCOPE);
        if (shell) return shell;
        const offline = await caches.match(OFFLINE_PAGE);
        return (
          offline ??
          new Response('<h1>You are offline</h1>', {
            headers: { 'Content-Type': 'text/html' },
          })
        );
      }),
    );
    return;
  }

  // ── Everything else (icons, manifest, favicon): stale-while-revalidate.
  // Skip URLs with query strings — they are Vite HMR/dynamic and should not
  // pollute the cache with many near-identical entries.
  if (url.search) return;

  e.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached ?? new Response('Offline', { status: 503 }));
        // Return stale immediately; refresh in background
        return cached ?? network;
      }),
    ),
  );
});
