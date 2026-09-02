'use client';

import {
  createUserWithEmailAndPassword,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

/**
 * Admins sign in with an email address and a password. That is the whole of it.
 *
 * Phone + OTP used to be the main route, and it was the wrong one for this app.
 * Every code is an SMS someone has to pay for and a network has to deliver, on
 * exactly the connections least able to do either; the reCAPTCHA challenge in
 * front of it stalls on a slow phone; and a Sarpanch who changes SIM loses
 * their account. An email and a password work offline-ish, cost nothing, and
 * can be recovered.
 *
 * It also makes the account model honest. The identity here is the Firebase
 * UID, created the moment someone registers — so an application carries the
 * account it belongs to, and approving it grants that account access directly.
 * Nothing has to guess later which person a phone number meant.
 */

export interface AdminSession {
  email: string;
  /** Display name, set at registration. Empty for older accounts. */
  name: string;
  uid: string;
}

function toSession(user: User): AdminSession {
  return {
    email: user.email || '',
    name: user.displayName || '',
    uid: user.uid,
  };
}

/** At least this long, because Firebase refuses anything shorter anyway. */
export const MIN_PASSWORD = 6;

export async function signIn(email: string, password: string): Promise<AdminSession> {
  const cred = await signInWithEmailAndPassword(auth(), email.trim().toLowerCase(), password);
  return toSession(cred.user);
}

/**
 * Creates the account an application will be attached to.
 *
 * Registering grants nothing on its own — the new account can sign in and see
 * "not linked to any village yet" and that is all, until a super admin approves
 * the application. Creating it first is what gives the application a UID to
 * carry, so approval is a single write to the village rather than a phone
 * number waiting to be matched to whoever turns up with it.
 */
export async function register(input: {
  email: string;
  password: string;
  name: string;
}): Promise<AdminSession> {
  const cred = await createUserWithEmailAndPassword(
    auth(),
    input.email.trim().toLowerCase(),
    input.password
  );

  const name = input.name.trim();
  if (name) {
    // Best effort: the name is also stored on the application, which is what
    // the super admin actually reads.
    await updateProfile(cred.user, { displayName: name }).catch(() => undefined);
  }

  return { ...toSession(cred.user), name };
}

/** Firebase error codes, turned into something a screen can act on. */
export function authErrorKind(
  e: unknown
): 'taken' | 'weak' | 'bad-email' | 'wrong' | 'offline' | 'failed' {
  const code = (e as { code?: string })?.code || '';
  if (code === 'auth/email-already-in-use') return 'taken';
  if (code === 'auth/weak-password') return 'weak';
  if (code === 'auth/invalid-email') return 'bad-email';
  if (
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-credential'
  ) {
    return 'wrong';
  }
  if (code === 'auth/network-request-failed') return 'offline';
  return 'failed';
}

/**
 * Gives the browser an identity before it writes anything.
 *
 * Citizens never sign in, and that has to stay true — asking a villager to make
 * an account before reporting a broken handpump loses most of them. But
 * "nobody signs in" and "anybody may write" are different things, and the rules
 * could only ever enforce the second. An anonymous account is invisible: no
 * screen, no password, nothing to remember. What it buys is a stable UID, and
 * with it two rules worth having — a complaint can only be edited by the device
 * that filed it, and abuse can be attributed and capped.
 *
 * Never displaces a real session. An admin browsing the public feed keeps their
 * own account; only a browser with no user at all gets one of these.
 *
 * Returns the reason it failed rather than a bare null, because the two causes
 * need opposite responses. A disabled provider is a deployment mistake that no
 * amount of retrying fixes and that nobody but an admin can clear; no network on
 * a first-ever visit clears itself the moment a bar of signal appears, and the
 * draft is already saved. Telling a villager "try again" for the first one
 * wastes their afternoon.
 */
export type IdentityFailure = 'disabled' | 'offline' | 'failed';

export async function ensureAnonymous(): Promise<
  { uid: string } | { uid: null; reason: IdentityFailure }
> {
  const existing = auth().currentUser;
  if (existing) return { uid: existing.uid };

  try {
    const cred = await signInAnonymously(auth());
    return { uid: cred.user.uid };
  } catch (e) {
    const code = (e as { code?: string })?.code || '';
    return {
      uid: null,
      reason:
        code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation'
          ? 'disabled'
          : code === 'auth/network-request-failed'
            ? 'offline'
            : 'failed',
    };
  }
}

export function currentUid(): string | null {
  return auth().currentUser?.uid ?? null;
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth());
}

/** Fires immediately with the current session, then on every change. */
export function watchSession(cb: (session: AdminSession | null) => void): () => void {
  return onAuthStateChanged(auth(), (user: User | null) => cb(user ? toSession(user) : null));
}
