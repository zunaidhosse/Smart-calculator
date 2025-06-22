const CACHE_NAME = 'smart-bill-calc-v1';
const urlsToCache = [
  './', // Caches the root (index.html) relative to the service worker's scope
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',   // Add your icon files here
  './icon-512x512.png' // Add your icon files here
  // Note: CDNs are often handled by browser's HTTP cache. For strict offline,
  // you might consider self-hosting or pre-caching these if absolutely critical
  // and their content doesn't change often. For this example, we rely on browser cache for CDNs.
  // 'https://cdn.tailwindcss.com', // Not explicitly caching this via SW due to potential issues
  // 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        // No cache hit - fetch from network
        return fetch(event.request).catch(() => {
          // If fetch fails (e.g., offline and not in cache)
          // You could return a specific offline page here if desired.
          console.log('Fetch failed for:', event.request.url);
          // For now, it will just fail to load if not cached and offline.
          // For a true offline experience, you might want to return an "offline.html" page.
        });
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
