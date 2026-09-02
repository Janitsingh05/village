'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import LanguageToggle from '@/components/LanguageToggle';
import Logo from '@/components/Logo';
import Icon from '@/components/Icon';
import PhotoUpload from '@/components/PhotoUpload';
import { createAdminRequest } from '@/lib/admin-requests';
import { register, authErrorKind, MIN_PASSWORD } from '@/lib/auth';
import { listVillages } from '@/lib/villages';
import { useI18n } from '@/lib/i18n';
import type { Village } from '@/lib/types';

export default function AdminRegisterPage() {
  const { t } = useI18n();

  const [villages, setVillages] = useState<Village[] | null>(null);
  const [villageId, setVillageId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [idProof, setIdProof] = useState<File | null>(null);
  const [postProof, setPostProof] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listVillages()
      .then(setVillages)
      .catch(() => setVillages([]));
  }, []);

  // Both documents are required, not encouraged. An application without
  // evidence leaves the super admin approving a name they cannot check, which
  // is the whole problem this screen exists to solve. The phone number is not
  // required, because it is contact detail now rather than an identity — the
  // email and password are what the Sarpanch will sign in with.
  const canSubmit =
    villageId !== '' &&
    name.trim().length >= 2 &&
    email.trim().includes('@') &&
    password.length >= MIN_PASSWORD &&
    idProof !== null &&
    postProof !== null &&
    !busy;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      // The account first, then the application that belongs to it. That order
      // is what lets approval be a single write to the village later, and it
      // means the rules can insist an application names the account that filed
      // it — nobody can apply on somebody else's behalf.
      const session = await register({ email, password, name });

      const village = (villages || []).find((v) => v.id === villageId);
      await createAdminRequest({
        villageId,
        villageName: village?.name || villageId,
        uid: session.uid,
        email: session.email,
        name,
        phone,
        role,
        idProofFile: idProof!,
        postProofFile: postProof!,
      });
      setSent(true);
    } catch (err) {
      const kind = authErrorKind(err);
      const code = err instanceof Error ? err.message : '';
      setError(
        kind === 'taken'
          ? t('register.emailTaken')
          : kind === 'weak'
            ? t('register.weakPassword')
            : kind === 'bad-email'
              ? t('admin.badEmail')
              : code === 'ALREADY_REQUESTED'
                ? t('register.already')
                : t('register.failed')
      );
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-4">
        <div className="w-full rounded-3xl bg-white p-6 text-center shadow-card">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-600">
            <Icon name="checkCircle" className="h-7 w-7" strokeWidth={2.2} />
          </span>
          <h1 className="mt-3 text-xl font-bold text-slate-900">{t('register.sentTitle')}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('register.sentBody')}</p>
          <Link href="/admin/login" className="btn-secondary mt-5">
            {t('register.backToLogin')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <Logo withWordmark tagline={t('home.tagline')} />
        <LanguageToggle />
      </div>

      <h1 className="text-2xl font-bold text-slate-900">{t('register.title')}</h1>
      <p className="mt-1 text-sm text-slate-500">{t('register.subtitle')}</p>

      <p className="mt-4 flex items-start gap-2.5 rounded-2xl bg-amber-50 p-3 text-[13px] leading-snug text-amber-900">
        <Icon name="checkCircle" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
        {t('register.notice')}
      </p>

      {villages !== null && villages.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-card">
          {t('register.noVillages')}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="village">
              {t('register.village')} <span className="text-red-500">*</span>
            </label>
            <select
              id="village"
              value={villageId}
              onChange={(e) => setVillageId(e.target.value)}
              className="field appearance-none"
            >
              <option value="">{t('register.villagePlaceholder')}</option>
              {(villages || []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="name">
              {t('register.name')} <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('register.namePlaceholder')}
              className="field"
            />
          </div>

          <div>
            <label className="label" htmlFor="role">
              {t('register.role')}
            </label>
            <input
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder={t('register.rolePlaceholder')}
              className="field"
            />
          </div>

          <div>
            <label className="label" htmlFor="email">
              {t('admin.email')} <span className="text-red-500">*</span>
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
            <p className="mt-1.5 text-xs text-slate-500">{t('register.emailNote')}</p>
          </div>

          <div>
            <label className="label" htmlFor="password">
              {t('admin.password')} <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="field"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              {t('register.passwordNote', { n: MIN_PASSWORD })}
            </p>
          </div>

          <div>
            <label className="label" htmlFor="phone">
              {t('register.phone')}{' '}
              <span className="label-en">({t('common.optional')})</span>
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
            />
            <p className="mt-1.5 text-xs text-slate-500">{t('register.phoneNoteNew')}</p>
          </div>

          <div className="rounded-3xl bg-white p-4 shadow-card">
            <p className="text-sm font-bold text-slate-900">{t('register.proofHeading')}</p>
            <p className="mt-1 text-[13px] leading-snug text-slate-500">
              {t('register.proofIntro')}
            </p>

            <div className="mt-4">
              <label className="label">
                {t('register.idProof')} <span className="text-red-500">*</span>
              </label>
              <p className="-mt-1 mb-2 text-xs text-slate-500">{t('register.idProofSub')}</p>
              <PhotoUpload onChange={(files) => setIdProof(files[0] ?? null)} />
            </div>

            <div className="mt-5">
              <label className="label">
                {t('register.postProof')} <span className="text-red-500">*</span>
              </label>
              <p className="-mt-1 mb-2 text-xs text-slate-500">{t('register.postProofSub')}</p>
              <PhotoUpload onChange={(files) => setPostProof(files[0] ?? null)} />
            </div>

            <p className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-[12px] leading-snug text-slate-600">
              <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              {t('register.proofPrivacy')}
            </p>
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={!canSubmit} className="btn-primary">
            {busy ? t('register.sending') : t('register.submit')}
          </button>
        </form>
      )}

      <Link href="/admin/login" className="mt-6 block text-center text-sm text-slate-500">
        {t('register.backToLogin')}
      </Link>
    </main>
  );
}
