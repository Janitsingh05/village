'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import LanguageToggle from '@/components/LanguageToggle';
import VillageArt from '@/components/VillageArt';
import Logo from '@/components/Logo';
import { signIn, authErrorKind } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

/**
 * Email and password, and nothing else.
 *
 * Phone + OTP was the main route here and it was the wrong one for this app.
 * Every code is an SMS somebody pays for and a network has to deliver, over the
 * connections least able to do either; the reCAPTCHA in front of it stalls on a
 * cheap phone, badly enough that this page once needed a 150-second timeout and
 * an on-screen apology for the wait. And a Sarpanch who changes SIM lost their
 * account outright.
 *
 * An account with no village attached can sign in and see exactly that. Access
 * arrives when a super admin approves the application, not when a code does.
 */
export default function AdminLoginPage() {
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
      router.replace('/admin/dashboard');
    } catch (err) {
      const kind = authErrorKind(err);
      setError(
        t(
          kind === 'offline'
            ? 'admin.offline'
            : kind === 'bad-email'
              ? 'admin.badEmail'
              : 'admin.badCredentials'
        )
      );
      setBusy(false);
    }
  }

  const canSubmit = email.trim().length > 3 && password.length > 0 && !busy;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-4">
      <div className="mb-2 flex items-center justify-between">
        <Logo withWordmark tagline={t('home.tagline')} />
        <LanguageToggle />
      </div>

      <div className="relative mt-4 grid h-40 place-items-end overflow-hidden rounded-3xl bg-brand-50">
        <VillageArt className="h-40 w-full" />
      </div>

      <div className="mt-5 text-center">
        <h1 className="text-2xl font-bold text-slate-900">{t('admin.loginHeading')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('admin.loginNote')}</p>
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
            placeholder="sarpanch@example.com"
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
            placeholder="••••••••"
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

      {/* The way in for a new Sarpanch, said plainly. Someone taking office has
          no account yet and no reason to guess that registering comes first. */}
      <div className="mt-6 rounded-3xl bg-brand-50 p-4 text-center">
        <p className="text-sm font-bold text-brand-900">{t('admin.newHere')}</p>
        <p className="mt-1 text-[13px] leading-snug text-brand-800">{t('admin.newHereSub')}</p>
        <Link href="/admin/register" className="btn-secondary mt-3">
          {t('register.title')}
        </Link>
      </div>

      <Link href="/" className="mt-6 block text-center text-sm text-slate-500">
        {t('admin.backToPublic')}
      </Link>
    </main>
  );
}
