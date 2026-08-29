'use client';

import {
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signOut as fbSignOut,
  onAuthStateChanged,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

/**
 * Admins sign in by phone + OTP, with email/password kept as a fallback for
 * anyone without the registered SIM to hand.
 */

/** Firebase always sends a six-digit code. */
export const OTP_LENGTH = 6;

export interface AdminSession {
  email: string;
  phone: string;
  uid: string;
}

function toSession(user: User, fallbackPhone = ''): AdminSession {
  return {
    email: user.email || '',
    phone: user.phoneNumber || fallbackPhone,
    uid: user.uid,
  };
}

/* ---------------------------- email / password ---------------------------- */

export async function signIn(email: string, password: string): Promise<AdminSession> {
  const cred = await signInWithEmailAndPassword(auth(), email.trim(), password);
  return toSession(cred.user);
}

/* -------------------------------- phone OTP -------------------------------- */

let pendingConfirmation: ConfirmationResult | null = null;
let pendingPhone = '';
let verifier: RecaptchaVerifier | null = null;

/**
 * Firebase requires a reCAPTCHA anchor in the DOM. It is invisible, but it has
 * to exist before signInWithPhoneNumber is called.
 */
function getVerifier(): RecaptchaVerifier {
  if (verifier) return verifier;
  let host = document.getElementById('recaptcha-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'recaptcha-host';
    document.body.appendChild(host);
  }
  verifier = new RecaptchaVerifier(auth(), host, { size: 'invisible' });
  return verifier;
}

/** Discard a spent verifier so a retry gets a fresh challenge. */
function resetVerifier() {
  try {
    verifier?.clear();
  } catch {
    /* already gone */
  }
  verifier = null;
}

/**
 * How long to wait before giving up on the OTP request.
 *
 * signInWithPhoneNumber can hang indefinitely — a reCAPTCHA challenge that is
 * never completed never settles the promise — so some limit is needed or the
 * Sarpanch stares at "sending…" with no error and no way to retry.
 *
 * But reCAPTCHA sometimes shows a picture puzzle, and solving one takes real
 * time. A 60s cap would have cancelled a legitimate attempt mid-puzzle and
 * told the user it failed. Hence a deliberately generous ceiling here, paired
 * with an on-screen hint (see the login page) so the wait is never silent.
 */
const OTP_REQUEST_TIMEOUT_MS = 150_000;

/** After this long, tell the user a challenge may be waiting for them. */
export const OTP_SLOW_HINT_MS = 12_000;

/** Step 1 — send the code. `phone` is 10 digits, India assumed. */
export async function startPhoneSignIn(phone: string): Promise<void> {
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) throw new Error('BAD_PHONE');
  pendingPhone = digits;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('OTP_TIMEOUT')), OTP_REQUEST_TIMEOUT_MS);
  });

  try {
    pendingConfirmation = await Promise.race([
      signInWithPhoneNumber(auth(), '+91' + digits, getVerifier()),
      timeout,
    ]);
  } catch (e) {
    // A failed attempt burns the reCAPTCHA token; without this a second try
    // fails for a reason that has nothing to do with the phone number.
    resetVerifier();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Step 2 — check the code and open the session. */
export async function confirmOtp(code: string): Promise<AdminSession> {
  const digits = code.replace(/\D/g, '');
  if (digits.length !== OTP_LENGTH) throw new Error('BAD_OTP');
  if (!pendingConfirmation) throw new Error('NO_PENDING_OTP');

  const cred = await pendingConfirmation.confirm(digits);
  return toSession(cred.user, pendingPhone);
}

export function getPendingPhone(): string {
  return pendingPhone;
}

/* --------------------------------- session --------------------------------- */

export async function signOut(): Promise<void> {
  pendingConfirmation = null;
  resetVerifier();
  await fbSignOut(auth());
}

/** Fires immediately with the current session, then on every change. */
export function watchSession(cb: (session: AdminSession | null) => void): () => void {
  return onAuthStateChanged(auth(), (user: User | null) => cb(user ? toSession(user) : null));
}
