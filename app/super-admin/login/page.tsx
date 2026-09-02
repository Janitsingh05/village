'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import LanguageToggle from '@/components/LanguageToggle';
import SystemArt from '@/components/SystemArt';
import Logo from '@/components/Logo';
import { signIn, authErrorKind } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

/**
 * Email and password, matching the admin side.
 *
 * The OTP tab went for the same reasons it went there — an SMS per sign-in over
 * a rural connection, behind a reCAPTCHA that stalls — and for one more: being
 * a super admin is a role on `users/{uid}`, so the account has always been the
 * identity here. The phone tab was a second way to reach the same UID, and a
 * second way in is a second thing to get wrong.
 */
export default function SuperAdminLoginPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace('/super-admin/villages');
    } catch (err) {
      setError(t(authErrorKind(err) === 'offline' ? 'admin.offline' : 'admin.badCredentials'));
      setBusy(false);
    }
  }

  const canSubmit = email.trim().length > 3 && password.length > 0 && !busy;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-4">
      <div className="flex items-center justify-between">
        <Logo withWordmark tagline={t('super.loginNote')} />
        <LanguageToggle />
      </div>

      <div className="mt-4 grid place-items-center rounded-3xl bg-brand-50 py-2">
        <SystemArt className="h-40 w-64" />
      </div>

      <div className="mt-5 text-center">
        <h1 className="text-2xl font-bold text-slate-900">{t('super.loginHeading')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('super.loginNote')}</p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">
            {t('admin.email')}
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            {t('admin.password')}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={!canSubmit} className="btn-primary">
          {busy ? t('admin.signingIn') : t('admin.signIn')}
        </button>
      </form>
    </main>
  );
}
