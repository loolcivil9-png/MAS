/* ---------------------------------------------------------------------------
   Offline support.

   Strategy is stale-while-revalidate: the cached copy is served immediately
   (so the game opens instantly, and works with no signal at all), while a fresh
   copy is fetched in the background for next time. That means edits reach the
   phone after one reload without anyone having to remember to bump a version
   number, and a dead connection never blocks play.
   --------------------------------------------------------------------------- */

const CACHE = 'bubble-zoo-v1';

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/main.js',
  './js/config.js',
  './js/util.js',
  './js/creatures.js',
  './js/background.js',
  './js/bubble.js',
  './js/creaturePop.js',
  './js/particles.js',
  './js/hud.js',
  './js/celebrate.js',
  './js/audio.js',
  './js/input.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Individually, so one missing file cannot fail the whole install.
    await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });

    const network = fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
        return res;
      })
      .catch(() => null);

    if (cached) {
      event.waitUntil(network); // refresh for next time, do not block this load
      return cached;
    }

    const fresh = await network;
    if (fresh) return fresh;

    // Offline and never cached: any navigation still lands on the game.
    if (req.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    return Response.error();
  })());
});
