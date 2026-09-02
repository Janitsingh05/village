'use client';

import { VILLAGE_ID } from './config';

/**
 * Which village the current session is looking at.
 *
 * One deployment can serve many villages. Resolution order:
 *   1. an explicit ?v=<id> in the URL (remembered afterwards)
 *   2. the village stored for this device — set for a citizen by that link,
 *      and for an admin by whichever village claims their phone number
 *   3. NEXT_PUBLIC_VILLAGE_ID, the pilot default
 *
 * Every Firestore path already runs through this, so nothing else has to
 * change to add a second village.
 */
const KEY = 'gaonconnect:villageId';

let cached: string | null = null;

export function activeVillageId(): string {
  if (typeof window === 'undefined') return VILLAGE_ID;
  if (cached) return cached;

  // Read ?v= here rather than in a provider effect. React runs a child's
  // effects before its parent's, so a page that subscribes to Firestore on
  // mount would otherwise query the previous village and never re-subscribe —
  // which made a per-village link silently show the wrong data.
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('v');
    if (fromUrl) {
      cached = fromUrl;
      window.localStorage.setItem(KEY, fromUrl);
      return cached;
    }
  } catch {
    /* fall through to the stored value */
  }

  try {
    cached = window.localStorage.getItem(KEY) || VILLAGE_ID;
  } catch {
    cached = VILLAGE_ID;
  }
  return cached;
}

/**
 * Whether this device has ever settled on a village.
 *
 * Distinct from activeVillageId(), which always answers with something — the
 * env default if nothing else. The welcome flow needs to know the difference
 * between "chose the pilot village" and "never chose", and a value that falls
 * back cannot tell them apart.
 */
export function hasChosenVillage(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    if (new URLSearchParams(window.location.search).get('v')) return true;
    return Boolean(window.localStorage.getItem(KEY));
  } catch {
    // No storage to read means no way to remember an answer either, so asking
    // on every load would be worse than showing the default village.
    return true;
  }
}

export function setActiveVillage(id: string): void {
  if (!id) return;
  cached = id;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* falls back to the env default next load */
  }
}

export function clearActiveVillage(): void {
  cached = null;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

/**
 * Kept for the provider to call; activeVillageId() already honours ?v= on its
 * first read, so this only ensures the value is persisted.
 */
export function adoptVillageFromUrl(): void {
  activeVillageId();
}
