'use client';

import { doc, getDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { SESSION_EVENT } from './auth';

/**
 * Super-admin is a role on the user document, not a separate credential.
 * In demo mode there is no Firestore to ask, so the flag is kept locally and
 * set by the super-admin login screen.
 */
const DEMO_KEY = 'gaonconnect:superAdmin';

export async function isSuperAdmin(uid: string): Promise<boolean> {
  if (!isFirebaseConfigured) {
    try {
      return window.localStorage.getItem(DEMO_KEY) === '1';
    } catch {
      return false;
    }
  }
  try {
    const snap = await getDoc(doc(db(), 'users', uid));
    return snap.exists() && snap.data().role === 'superadmin';
  } catch {
    return false;
  }
}

export function markDemoSuperAdmin(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(DEMO_KEY, '1');
    else window.localStorage.removeItem(DEMO_KEY);
  } catch {
    /* nothing to do */
  }
  // The sign-in already fired a session event before this flag was set, so the
  // layout's role check ran too early. Re-fire it now that the role is known.
  window.dispatchEvent(new Event(SESSION_EVENT));
}
