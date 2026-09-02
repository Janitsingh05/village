import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Firebase is the only backend. When the keys are missing the app says so on a
 * setup screen rather than pretending to work — a fake local store would let a
 * villager file a complaint the Panchayat can never see.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

export function missingFirebaseKeys(): string[] {
  return Object.entries({
    NEXT_PUBLIC_FIREBASE_API_KEY: firebaseConfig.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: firebaseConfig.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: firebaseConfig.messagingSenderId,
    NEXT_PUBLIC_FIREBASE_APP_ID: firebaseConfig.appId,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
}

export const projectId = firebaseConfig.projectId || '';

let app: FirebaseApp | null = null;
let firestore: Firestore | null = null;

function getApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured — see /setup');
  }
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return app;
}

/**
 * Proves to Firebase that a request came from this app and not a script.
 *
 * The last brake on write abuse, and the only one that can exist here. The
 * rules can say who a caller is and what they own; they cannot count how often
 * somebody writes, because that needs a server keeping score and this project
 * has none by design. App Check answers a different question — is this the real
 * app — and a loop with the public config cannot pass it.
 *
 * Gated behind the key so a developer with no key, and the /setup screen, keep
 * working: with the variable unset this is a no-op and the project behaves as
 * it does today.
 */
let appCheckStarted = false;

function startAppCheck(): void {
  if (appCheckStarted || typeof window === 'undefined') return;
  const siteKey = process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY;
  if (!siteKey) return;

  appCheckStarted = true;

  // Imported dynamically, not statically. App Check is fire-and-forget — no
  // caller waits on it — so there is no reason for its SDK to sit in the chunk
  // that has to arrive before the first screen paints on a 3G phone. A static
  // import cost 6 kB of first load for a module nothing reads.
  void import('firebase/app-check')
    .then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
      initializeAppCheck(getApp(), {
        provider: new ReCaptchaV3Provider(siteKey),
        // Refreshed in the background so a villager on a slow line is never
        // held up waiting for a token mid-submit.
        isTokenAutoRefreshEnabled: true,
      });
    })
    .catch(() => {
      // A bad key must not take the app down with it. Firebase then rejects
      // writes only once enforcement is switched on in the console, which is
      // exactly the moment somebody is watching.
    });
}

export function db(): Firestore {
  startAppCheck();
  if (firestore) return firestore;

  // Offline persistence is the whole point on a rural connection: a complaint
  // filed with no signal is queued in IndexedDB and syncs when the phone comes
  // back, and the feed keeps rendering from cache in the meantime.
  firestore = initializeFirestore(getApp(), {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  return firestore;
}


export function auth(): Auth {
  return getAuth(getApp());
}
