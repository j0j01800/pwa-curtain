// Curtain Studio · Quote Calculator Service Worker
const CACHE_NAME = 'curtain-studio-pwa-v2';

const CORE_ASSETS = [
  './',
  './index.html',
  './default_logo.js',
  './manifest.json',
  './apple-touch-icon.png',
  './pwa-192x192.png',
  './pwa-512x512.png',
  './pwa-maskable-512x512.png',
  './icon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

// Pre-cache core shell assets on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use catch for individual items to avoid failing entire install if one external asset fails
      return Promise.allSettled(
        CORE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Could not pre-cache:', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Clean up previous cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Serve cached response or fetch from network (Stale-While-Revalidate / Cache-First fallback)
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  // Ignore chrome-extension or internal schemes
  if (!req.url.startsWith('http')) return;

  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      // If we have cached response, return it and update cache in background
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed: if offline and requested a navigation, fallback to root or cached index
          if (req.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./') || cachedResponse;
          }
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
