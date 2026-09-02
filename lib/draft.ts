'use client';

/**
 * Keeps a half-written complaint on the device.
 *
 * Firestore already queues the *submit* offline, so a filed complaint survives
 * a dead signal on its own. What it does not survive is everything before that:
 * a phone that rings, a browser tab the system kills to reclaim memory, a
 * villager who walks out of the shop with the form half filled. That is minutes
 * of thumbed Devanagari, and it used to vanish.
 *
 * Photos are deliberately not saved — a File cannot go in localStorage, and
 * base64 would blow the quota on the second one. The text is the expensive part.
 */
const KEY = 'gaonconnect:draft';

export interface Draft {
  category: string | null;
  description: string;
  ward: string;
  name: string;
  phone: string;
  savedAt: number;
}

/** Older than this and it is probably a different problem on a different day. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function saveDraft(draft: Omit<Draft, 'savedAt'>): void {
  // An untouched form is not a draft; saving one would offer to restore nothing.
  if (!draft.description.trim() && !draft.category) {
    clearDraft();
    return;
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    /* private mode or quota — the form still works, it just will not come back */
  }
}

export function loadDraft(): Draft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    if (Date.now() - (draft.savedAt || 0) > MAX_AGE_MS) {
      clearDraft();
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
