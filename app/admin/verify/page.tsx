'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import LanguageToggle from '@/components/LanguageToggle';
import Icon from '@/components/Icon';
import { confirmOtp, getPendingPhone, startPhoneSignIn, OTP_LENGTH } from '@/lib/auth';
import { isFirebaseConfigured } from '@/lib/firebase';
import { useI18n } from '@/lib/i18n';
import { maskPhone } from '@/lib/format';

const RESEND_SECONDS = 45;

export default function AdminVerifyPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [digits, setDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(''));
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);

  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const p = getPendingPhone();
    // A refresh loses the pending confirmation, so start over rather than
    // leaving someone staring at boxes that can never verify.
    if (!p) {
      router.replace('/admin/login');
      return;
    }
    setPhone(p);
    inputs.current[0]?.focus();
  }, [router]);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  function setDigit(i: number, value: string) {
    const ch = value.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = ch;
      return next;
    });
    if (ch && i < OTP_LENGTH - 1) inputs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  }

  function onPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!text) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill('');
    text.split('').forEach((c, i) => (next[i] = c));
    setDigits(next);
    inputs.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus();
  }

  const code = digits.join('');

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== OTP_LENGTH) return;
    setBusy(true);
    setError(null);
    try {
      await confirmOtp(code);
      router.replace('/admin/dashboard');
    } catch {
      setError(t('admin.otpWrong'));
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    setSeconds(RESEND_SECONDS);
    try {
      await startPhoneSignIn(phone);
    } catch {
      setError(t('admin.otpWrong'));
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/admin/login')}
          aria-label={t('common.back')}
          className="-ml-2 grid h-10 w-10 place-items-center rounded-full text-slate-700 hover:bg-slate-100"
        >
          <Icon name="back" className="h-6 w-6" />
        </button>
        <LanguageToggle />
      </div>

      <div className="mt-10 text-center">
        <h1 className="text-2xl font-bold text-slate-900">{t('admin.otpHeading')}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {t('admin.otpSentTo', { phone: maskPhone(phone) })}
        </p>
      </div>

      <form onSubmit={verify} className="mt-8">
        <div className="flex justify-center gap-3" onPaste={onPaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label={'OTP ' + (i + 1)}
              className={
                'h-14 w-12 rounded-2xl border-2 text-center text-2xl font-bold outline-none transition ' +
                (d ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white')
              }
            />
          ))}
        </div>

        <div className="mt-4 text-center text-sm">
          {seconds > 0 ? (
            <span className="text-slate-400">{t('admin.otpResendIn', { s: seconds })}</span>
          ) : (
            <button type="button" onClick={resend} className="font-semibold text-brand-600">
              {t('admin.otpResend')}
            </button>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-center text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={code.length !== OTP_LENGTH || busy}
          className="btn-primary mt-6"
        >
          {busy ? t('admin.signingIn') : t('admin.otpVerify')}
        </button>
      </form>

      {!isFirebaseConfigured && (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
          {t('admin.otpDemoHint')}
        </p>
      )}
    </main>
  );
}
