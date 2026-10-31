const CACHE_NAME = 'positionlab-v13';

// Install event - activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - purge all outdated caches & claim all clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event:
// 1. Bypass dynamic third-party APIs (Binance, MEXC, Groq) and manifest.json
// 2. Navigation requests: Stale-While-Revalidate (opens in 0ms from cache, updates in background)
// 3. Static hashed assets (JS/CSS/images/icons): Cache-First (instant 0ms retrieval)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass third-party external APIs and manifest.json completely
  if (
    url.hostname.includes('binance') ||
    url.hostname.includes('mexc') ||
    url.hostname.includes('groq.com') ||
    url.pathname.includes('manifest.json')
  ) {
    return;
  }

  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // 1. Navigation requests (HTML documents):
  // Stale-While-Revalidate: serve cached version in 0ms for instant app switching, update in background
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);

        const networkFetch = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // Offline fallback to index.html if request fails
            if (cachedResponse) return cachedResponse;
            const scope = self.registration.scope;
            const basePath = new URL(scope).pathname.replace(/\/$/, '');
            if (event.request.url.includes('/beta')) {
              return cache.match(basePath + '/beta/index.html');
            }
            return cache.match(basePath + '/index.html');
          });

        // Instant return if cached; network updates cache in background
        return cachedResponse || networkFetch;
      })
    );
    return;
  }

  // 2. Static Assets (hashed Vite chunks, css, svgs, pngs, json):
  // Cache-First: instant 0ms response, fallback to network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      });
    })
  );
});
