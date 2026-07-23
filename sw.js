/* ---------------------------------------------------------------------------
   Offline support.

   Strategy is network-first with a short leash, falling back to the cache.

   It used to be stale-while-revalidate, which served the cached copy instantly
   and refreshed in the background. That is faster, but it meant a freshly
   deployed version only appeared on the *second* open — so the version marker
   on the home screen would confidently report the wrong build. Since the whole
   point of that marker is knowing what is live, correctness wins over the few
   hundred milliseconds.

   Offline is unaffected: with no connection the fetch fails immediately and the
   cache answers, so the game still opens and plays with no signal at all.
   --------------------------------------------------------------------------- */

// Keep in step with CONFIG.version in js/config.js. Changing it makes the new
// service worker install, drop the old cache, and take over — which is what
// makes a freshly deployed version actually show up on the phone.
const CACHE = 'hungry-hole-2.0.0';

// How long to wait for the network before falling back to the cached copy.
const NETWORK_TIMEOUT = 2500;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/main.js',
  './js/config.js',
  './js/util.js',
  './js/catalog.js',
  './js/background.js',
  './js/hole.js',
  './js/thing.js',
  './js/particles.js',
  './js/hud.js',
  './js/celebrate.js',
  './js/audio.js',
  './js/input.js',
  './js/save.js',
  './js/surprise.js',
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

    try {
      const fresh = await withTimeout(fetch(req), NETWORK_TIMEOUT);
      if (fresh && fresh.ok && fresh.type === 'basic') {
        cache.put(req, fresh.clone());   // keep the offline copy current
        return fresh;
      }
      if (fresh) return fresh;           // a real 404 should look like a 404
    } catch {
      // Offline, or the network is too slow to wait for. Use what we have.
    }

    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;

    // Never cached and no network: any navigation still lands on the game.
    if (req.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    return Response.error();
  })());
});

/** Rejects rather than hanging, so a bad connection cannot stall the launch. */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('network timeout')), ms)),
  ]);
}
