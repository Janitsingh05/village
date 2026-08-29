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
