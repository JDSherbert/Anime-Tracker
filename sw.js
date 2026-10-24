// Bump VERSION when shipping changes so old shell caches get cleared.
const VERSION = 'v1';
const SHELL_CACHE = `shell-${VERSION}`;
const COVER_CACHE = 'covers';
const MAX_COVERS = 400;
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('shell-') && k !== SHELL_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (request.destination === 'image') {
    event.respondWith(cacheFirst(request));
  }
});

// App files: always try for the latest, fall back to the cache when offline.
async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') return (await cache.match('index.html')) ?? Response.error();
    return Response.error();
  }
}

// Cover art never changes for a given URL, so serve it from cache when we have it.
async function cacheFirst(request) {
  const cache = await caches.open(COVER_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    trimCovers(cache);
  }
  return response;
}

async function trimCovers(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_COVERS))) await cache.delete(key);
}
