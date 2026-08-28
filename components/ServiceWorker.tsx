'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker in production only — in dev it would serve
 * stale bundles and make every change look like it did not apply.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Offline support is a bonus; the app works fine without it.
      });
    };

    // Wait for load so registration never competes with the first paint.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
