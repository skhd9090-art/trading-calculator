const CACHE_NAME = 'trading-calculator-v9';

// Install event - activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - purge all outdated caches
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

// Fetch event - NETWORK FIRST for all local assets to prevent stale code traps
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass third-party external APIs completely
  if (
    url.hostname.includes('binance') ||
    url.hostname.includes('mexc') ||
    url.hostname.includes('groq.com')
  ) {
    return;
  }

  // Network First: Try fresh network request; fallback to cache if offline
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            const scope = self.registration.scope;
            const basePath = new URL(scope).pathname.replace(/\/$/, '');
            if (event.request.url.includes('/beta')) {
              return caches.match(basePath + '/beta/index.html');
            }
            return caches.match(basePath + '/index.html');
          }
        });
      })
  );
});
