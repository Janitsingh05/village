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
import { auth, isFirebaseConfigured } from './firebase';

/**
 * Admins sign in by phone + OTP (as in the design), with email/password kept
 * as a fallback for anyone without the registered SIM to hand.
 *
 * With no Firebase keys present everything falls back to a local demo session
 * so the whole flow can be walked through offline.
 */
const DEMO_KEY = 'gaonconnect:demoAdmin';
// Firebase pushes sign-in changes through onAuthStateChanged; the demo path has
// no such listener, so it broadcasts its own event. Without this the admin
// layout never sees a fresh login and bounces straight back to the login page.
export const SESSION_EVENT = 'gaonconnect:session';

const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL || 'admin@gaon.local';
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD || 'gaon1234';

/** Firebase always sends 6 digits; the demo path can use the shorter code. */
export const OTP_LENGTH = isFirebaseConfigured ? 6 : 4;

export interface AdminSession {
  email: string;
  phone: string;
  uid: string;
}

function saveDemoSession(session: AdminSession) {
  window.localStorage.setItem(DEMO_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(SESSION_EVENT));
}

/* ------------------------------ email / password ------------------------------ */

export async function signIn(email: string, password: string): Promise<AdminSession> {
  if (!isFirebaseConfigured) {
    if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      throw new Error('DEMO_CREDENTIALS');
    }
    const session = { email: DEMO_EMAIL, phone: '', uid: 'demo-admin' };
    saveDemoSession(session);
    return session;
  }

  const cred = await signInWithEmailAndPassword(auth(), email.trim(), password);
  return { email: cred.user.email || email, phone: cred.user.phoneNumber || '', uid: cred.user.uid };
}

/* --------------------------------- phone OTP --------------------------------- */

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

/** Step 1 — send the code. `phone` is 10 digits, India assumed. */
export async function startPhoneSignIn(phone: string): Promise<void> {
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) throw new Error('BAD_PHONE');
  pendingPhone = digits;

  if (!isFirebaseConfigured) return;
  pendingConfirmation = await signInWithPhoneNumber(auth(), '+91' + digits, getVerifier());
}

/** Step 2 — check the code and open the session. */
export async function confirmOtp(code: string): Promise<AdminSession> {
  const digits = code.replace(/\D/g, '');
  if (digits.length !== OTP_LENGTH) throw new Error('BAD_OTP');

  if (!isFirebaseConfigured) {
    const session = { email: DEMO_EMAIL, phone: pendingPhone, uid: 'demo-admin' };
    saveDemoSession(session);
    return session;
  }

  if (!pendingConfirmation) throw new Error('NO_PENDING_OTP');
  const cred = await pendingConfirmation.confirm(digits);
  return {
    email: cred.user.email || '',
    phone: cred.user.phoneNumber || pendingPhone,
    uid: cred.user.uid,
  };
}

export function getPendingPhone(): string {
  return pendingPhone;
}

/* --------------------------------- session --------------------------------- */

export async function signOut(): Promise<void> {
  pendingConfirmation = null;
  if (!isFirebaseConfigured) {
    window.localStorage.removeItem(DEMO_KEY);
    window.dispatchEvent(new Event(SESSION_EVENT));
    return;
  }
  await fbSignOut(auth());
}

/** Fires immediately with the current session, then on every change. */
export function watchSession(cb: (session: AdminSession | null) => void): () => void {
  if (!isFirebaseConfigured) {
    const push = () => {
      try {
        const raw = window.localStorage.getItem(DEMO_KEY);
        cb(raw ? (JSON.parse(raw) as AdminSession) : null);
      } catch {
        cb(null);
      }
    };
    push();
    window.addEventListener(SESSION_EVENT, push);
    window.addEventListener('storage', push); // other tabs
    return () => {
      window.removeEventListener(SESSION_EVENT, push);
      window.removeEventListener('storage', push);
    };
  }

  return onAuthStateChanged(auth(), (user: User | null) =>
    cb(
      user
        ? { email: user.email || '', phone: user.phoneNumber || '', uid: user.uid }
        : null
    )
  );
}

export const demoCredentials = { email: DEMO_EMAIL, password: DEMO_PASSWORD };
