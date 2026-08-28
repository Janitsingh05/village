'use client';

import { isFirebaseConfigured, missingFirebaseKeys } from '@/lib/firebase';

/**
 * Firebase is the only backend. If it is not configured the app refuses to
 * render rather than falling back to anything local — a villager filing a
 * complaint the Panchayat can never see is worse than an honest error.
 */
export default function ConfigGate({ children }: { children: React.ReactNode }) {
  if (isFirebaseConfigured) return <>{children}</>;

  const missing = missingFirebaseKeys();

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
      <div className="rounded-3xl bg-white p-6 shadow-card">
        <p className="text-4xl" aria-hidden>
          ⚙️
        </p>
        <h1 className="mt-3 text-xl font-bold text-slate-900">Firebase is not configured</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          GaonConnect stores every complaint in Firebase so residents and the Panchayat see the
          same data. Until these keys are set there is no backend to talk to.
        </p>

        <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">
          Missing values
        </p>
        <ul className="mt-2 space-y-1">
          {missing.map((key) => (
            <li key={key} className="break-all rounded-lg bg-red-50 px-3 py-2 font-mono text-xs text-red-700">
              {key}
            </li>
          ))}
        </ul>

        <ol className="mt-5 space-y-2 text-sm text-slate-700">
          <li>
            <strong>1.</strong> Create a project at console.firebase.google.com, then enable
            Firestore, Storage and Phone authentication.
          </li>
          <li>
            <strong>2.</strong> Project settings → Your apps → Web app → copy the config.
          </li>
          <li>
            <strong>3.</strong> Paste the values into <code className="font-mono">.env.local</code>{' '}
            (locally) or your host&apos;s environment variables, then restart.
          </li>
        </ol>

        <p className="mt-5 rounded-xl bg-slate-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-500">
          cp .env.local.example .env.local
        </p>
      </div>
    </main>
  );
}
