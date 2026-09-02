/**
 * Path comparison that survives the trailing slash.
 *
 * The app is exported with `trailingSlash: true`, so usePathname() returns
 * "/admin/login/" while route constants are written "/admin/login". Comparing
 * them directly silently fails — and for an auth guard that means the login
 * page is treated as protected, leaving the user on a permanent "checking…"
 * screen with no way forward.
 */
function normalise(path: string): string {
  return path.replace(/\/+$/, '') || '/';
}

export function samePath(a: string, b: string): boolean {
  return normalise(a) === normalise(b);
}

export function isOneOf(pathname: string, routes: string[]): boolean {
  return routes.some((route) => samePath(pathname, route));
}

/** True for the route itself and everything under it, slash or no slash. */
export function isUnderAny(pathname: string, prefixes: string[]): boolean {
  const path = normalise(pathname);
  return prefixes.some((prefix) => {
    const base = normalise(prefix);
    return path === base || path.startsWith(base + '/');
  });
}
