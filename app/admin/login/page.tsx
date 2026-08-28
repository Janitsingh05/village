'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import LanguageToggle from '@/components/LanguageToggle';
import VillageArt from '@/components/VillageArt';
import Logo from '@/components/Logo';
import { signIn, startPhoneSignIn } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

export default function AdminLoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [mode, setMode] = useState<'otp' | 'email'>('otp');

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await startPhoneSignIn(phone);
      router.push('/admin/verify');
    } catch {
      setError(t('admin.badCredentials'));
      setBusy(false);
    }
  }

  async function emailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace('/admin/dashboard');
    } catch (err) {
      setError(t('admin.badCredentials'));
      setBusy(false);
    }
  }

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

      {mode === 'otp' ? (
        <form onSubmit={sendOtp} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="phone">
              {t('admin.mobileLabel')}
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="98XXXXXXXX"
              className="field"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={phone.length !== 10 || busy} className="btn-primary">
            {busy ? t('report.submitting') : t('admin.sendOtp')}
          </button>

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">{t('common.or')}</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <button type="button" onClick={() => setMode('email')} className="btn-secondary">
            {t('admin.useEmail')}
          </button>
        </form>
      ) : (
        <form onSubmit={emailSignIn} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">
              {t('admin.email')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
              placeholder="sarpanch@example.com"
              required
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
              required
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? t('admin.signingIn') : t('admin.signIn')}
          </button>

          <button type="button" onClick={() => setMode('otp')} className="btn-secondary">
            {t('admin.useOtp')}
          </button>
        </form>
      )}


      <Link href="/" className="mt-6 block text-center text-sm text-slate-500">
        {t('admin.backToPublic')}
      </Link>
    </main>
  );
}
