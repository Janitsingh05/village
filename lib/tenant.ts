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
  try {
    cached = window.localStorage.getItem(KEY) || VILLAGE_ID;
  } catch {
    cached = VILLAGE_ID;
  }
  return cached;
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
 * Pick up ?v=<id> once on load so a village can be handed out as a plain link
 * (or a QR code on a notice board) without any login.
 */
export function adoptVillageFromUrl(): void {
  if (typeof window === 'undefined') return;
  const fromUrl = new URLSearchParams(window.location.search).get('v');
  if (fromUrl) setActiveVillage(fromUrl);
}
