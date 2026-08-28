'use client';

/**
 * Citizens do not log in, so "my complaints" is resolved from the phone number
 * they last reported with, kept on this device only.
 */
const KEY = 'gaonconnect:me';

export interface Me {
  name: string;
  phone: string;
}

export function rememberMe(me: Me): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(me));
  } catch {
    /* private mode — "my complaints" just stays empty */
  }
}

export function getMe(): Me | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Me) : null;
  } catch {
    return null;
  }
}

export function forgetMe(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
