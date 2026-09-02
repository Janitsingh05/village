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
const VERSION = 'v3';
const STATIC_CACHE = 'gc-static-' + VERSION;
const PAGE_CACHE = 'gc-pages-' + VERSION;

const PRECACHE = [
  '/',
  '/report/',
  '/announcements/',
  '/manifest.json',
  // The active language is fetched now rather than bundled, so the fallback
  // dictionary has to survive a dropped connection like any other shell asset.
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
    url.pathname.startsWith('/locales/') ||
    url.pathname === '/logo.png' ||
    url.pathname === '/logo-mark.png'
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Same-origin only: Firebase, Google APIs and anything else go straight out.
  if (url.origin !== self.location.origin) return;

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
            caches.open(PAGE_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('/')))
    );
  }
});
