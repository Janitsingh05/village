'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import LanguageToggle from '@/components/LanguageToggle';
import SystemArt from '@/components/SystemArt';
import Logo from '@/components/Logo';
import { signIn, startPhoneSignIn, confirmOtp, demoCredentials, OTP_LENGTH } from '@/lib/auth';
import { markDemoSuperAdmin } from '@/lib/roles';
import { isFirebaseConfigured } from '@/lib/firebase';
import { useI18n } from '@/lib/i18n';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [tab, setTab] = useState<'otp' | 'email'>('otp');
  const [stage, setStage] = useState<'phone' | 'code'>('phone');

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, onOk: () => void) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onOk();
    } catch (err) {
      const c = err instanceof Error ? err.message : '';
      setError(c === 'DEMO_CREDENTIALS' ? t('admin.demoCredentials') : t('admin.badCredentials'));
      setBusy(false);
    }
  }

  function enterSuperAdmin() {
    markDemoSuperAdmin(true);
    router.replace('/super-admin/villages');
  }

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

      <div className="mt-5 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
        {(['otp', 'email'] as const).map((id) => (
          <button
            key={id}
            onClick={() => {
              setTab(id);
              setError(null);
            }}
            aria-pressed={tab === id}
            className={
              'rounded-xl px-3 py-2.5 text-sm font-bold transition ' +
              (tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')
            }
          >
            {id === 'otp' ? t('super.tabOtp') : t('super.tabEmail')}
          </button>
        ))}
      </div>

      {tab === 'otp' ? (
        <div className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="phone">
              {t('admin.mobileLabel')}
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="98XXXXXXXX"
              className="field"
              disabled={stage === 'code'}
            />
          </div>

          {stage === 'code' && (
            <div>
              <label className="label" htmlFor="code">
                {t('admin.otpHeading')}
              </label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={OTP_LENGTH}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                className="field text-center text-2xl font-bold tracking-[0.4em]"
              />
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          {stage === 'phone' ? (
            <button
              onClick={() =>
                run(
                  () => startPhoneSignIn(phone),
                  () => {
                    setStage('code');
                    setBusy(false);
                  }
                )
              }
              disabled={phone.length !== 10 || busy}
              className="btn-primary"
            >
              {t('admin.sendOtp')}
            </button>
          ) : (
            <button
              onClick={() =>
                run(async () => {
                  await confirmOtp(code);
                  markDemoSuperAdmin(true);
                }, enterSuperAdmin)
              }
              disabled={code.length !== OTP_LENGTH || busy}
              className="btn-primary"
            >
              {t('admin.otpVerify')}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="email">
              {t('admin.email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
              placeholder="super@example.com"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              {t('admin.password')}
            </label>
            <input
              id="password"
              type="password"
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

          <button
            onClick={() =>
              run(async () => {
                await signIn(email, password);
                markDemoSuperAdmin(true);
              }, enterSuperAdmin)
            }
            disabled={busy}
            className="btn-primary"
          >
            {t('admin.signIn')}
          </button>
        </div>
      )}

      {!isFirebaseConfigured && (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
          {t('admin.demoTitle')} — {demoCredentials.email} / {demoCredentials.password} ·{' '}
          {t('admin.otpDemoHint')}
        </p>
      )}
    </main>
  );
}
