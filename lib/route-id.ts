'use client';

import { useEffect, useState } from 'react';

/**
 * Reads a record id out of the URL without a Next dynamic segment.
 *
 * Firebase Hosting's free tier serves static files only, so the app is exported
 * statically and `/complaint/<id>` is rewritten to a single page. That keeps the
 * pretty, shareable URL — these links get passed around on WhatsApp — while the
 * id is resolved here on the client.
 *
 * `?id=` is accepted too, which is what the exported page itself links to.
 */
export function useRouteId(prefix: string): string | null | undefined {
  // undefined = still reading, null = nothing in the URL
  const [id, setId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const url = new URL(window.location.href);

    const fromQuery = url.searchParams.get('id');
    if (fromQuery) {
      setId(fromQuery);
      return;
    }

    const rest = url.pathname.slice(prefix.length).replace(/^\/+|\/+$/g, '');
    setId(rest ? decodeURIComponent(rest) : null);
  }, [prefix]);

  return id;
}

/**
 * Internal links use ?id= because that path exists in the static export, so
 * Next routes to it client-side instead of forcing a full page load — which
 * matters on a slow connection.
 */
export function complaintHref(id: string): string {
  return '/complaint?id=' + encodeURIComponent(id);
}

export function adminComplaintHref(id: string): string {
  return '/admin/complaint?id=' + encodeURIComponent(id);
}

/** The tidy form to hand to someone else; Hosting rewrites it to the same page. */
export function complaintShareUrl(origin: string, id: string): string {
  return origin + '/complaint/' + encodeURIComponent(id);
}
