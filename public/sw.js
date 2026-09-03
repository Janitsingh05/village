/**
 * GaonConnect service worker.
 *
 * Aimed squarely at patchy rural 3G rather than at full offline use:
 *   - build assets are immutable, so cache-first with no revalidation
 *   - pages are network-first with a cache fallback, so a dropped connection
 *     shows the last good version instead of the browser's error page
 *   - Firebase traffic is never touched; Firestore has its own offline layer
 *     and caching auth or query responses here would be actively wrong
 */
const VERSION = 'v6';
const STATIC_CACHE = 'gc-static-' + VERSION;
const PAGE_CACHE = 'gc-pages-' + VERSION;

const PRECACHE = [
  '/',
  '/report/',
  // The one flow that has to work with no signal, and the one that was left
  // out: someone who cannot type is not going to fall back to the written form.
  '/report/voice/',
  '/complaints/',
  '/my/',
  '/more/',
  '/announcements/',
  '/manifest.json',
  // Hindi and English ship inside the bundle too; these copies are what a
  // fetched language falls back to offline. Languages beyond them are cached
  // on first use by the /locales/ rule below rather than precached, so adding
  // one never grows the install.
  '/locales/hi.json',
  '/locales/en.json',
  '/logo.png',
  '/logo-mark.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      // One bad URL must not fail the whole install.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('gc-') && k !== STATIC_CACHE && k !== PAGE_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isBuildAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/logo.png' ||
    url.pathname === '/logo-mark.png'
  );
}

/**
 * Translations, unlike build assets, have no hash in their filename.
 *
 * Cache-first froze them: once a phone had hi.json, fixing a Hindi typo changed
 * nothing until VERSION here was bumped, and nothing in the repo makes anyone
 * remember to do that. Serve the cached copy immediately, fetch a fresh one in
 * the background, and the next open has the correction.
 */
function isLocale(url) {
  return url.pathname.startsWith('/locales/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Same-origin only: Firebase, Google APIs and anything else go straight out.
  if (url.origin !== self.location.origin) return;

  if (isLocale(url)) {
    event.respondWith(
      caches.match(request).then((hit) => {
        const fresh = fetch(request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
          .catch(() => hit);
        return hit || fresh;
      })
    );
    return;
  }

  if (isBuildAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => {
              // Keyed by pathname, ignoring the query string. Every
              // /complaint/?id=… was getting its own entry, so a villager who
              // opened forty complaints carried forty copies of one page around
              // in a cache that was never trimmed.
              c.put(new Request(new URL(request.url).pathname), copy);
              void trimPageCache(c);
            });
          }
          return res;
        })
        .catch(() =>
          caches
            .match(new Request(new URL(request.url).pathname))
            .then((hit) => hit || caches.match('/'))
        )
    );
  }
});

/** Pages worth keeping offline. Beyond this the oldest go. */
const PAGE_CACHE_MAX = 30;

async function trimPageCache(cache) {
  const keys = await cache.keys();
  // keys() returns insertion order, so the front of the list is the oldest.
  for (const key of keys.slice(0, Math.max(0, keys.length - PAGE_CACHE_MAX))) {
    await cache.delete(key);
  }
}
