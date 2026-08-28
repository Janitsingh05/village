'use client';

import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Super-admin is a role on the user document, not a separate credential.
 * Firestore rules read the same field, so this check cannot be bypassed by
 * anything the browser does.
 */
export async function isSuperAdmin(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db(), 'users', uid));
    return snap.exists() && snap.data().role === 'superadmin';
  } catch {
    return false;
  }
}
