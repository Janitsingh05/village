'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import PhotoUpload from '@/components/PhotoUpload';
import LanguageToggle from '@/components/LanguageToggle';
import { signOut, watchSession, type AdminSession } from '@/lib/auth';
import { updateAdminProfile } from '@/lib/villages';
import { useVillage } from '@/lib/village-context';
import { useI18n } from '@/lib/i18n';
import { preparePhoto } from '@/lib/imageCompress';

export default function AdminProfilePage() {
  const { lang, t } = useI18n();
  const village = useVillage();

  const [session, setSession] = useState<AdminSession | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [dropPhoto, setDropPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => watchSession(setSession), []);

  // Seed the form from the record whenever it (re)loads.
  useEffect(() => {
    if (!village.village) return;
    setName(village.village.adminName || '');
    setRole(village.village.adminRole || '');
    setPhone(village.village.adminPhone || '');
  }, [village.village]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      let adminPhotoUrl: string | null | undefined;
      if (photo) {
        adminPhotoUrl = (await preparePhoto(photo)).thumb;
        // This portrait is the whole point of the card villagers look at. A
        // photo that would not fit used to be dropped in silence, so the save
        // reported success and the card stayed empty.
        if (!adminPhotoUrl) throw new Error('PHOTO_TOO_LARGE');
      } else if (dropPhoto) {
        adminPhotoUrl = null;
      }

      await updateAdminProfile(village.id, {
        adminName: name,
        adminRole: role,
        adminPhone: phone,
        adminPhotoUrl,
      });
      village.reload();
      setPhoto(null);
      setDropPhoto(false);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      setError(t(code === 'PHOTO_TOO_LARGE' ? 'profile.photoTooLarge' : 'profile.failed'));
    } finally {
      setBusy(false);
    }
  }

  const current = village.village;
  const portrait = current?.adminPhotoUrl;

  return (
    <main className="mx-auto max-w-2xl space-y-3 px-4 py-4">
      <section className="rounded-3xl bg-white p-5 text-center shadow-card">
        {portrait ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portrait}
            alt={current?.adminName || ''}
            className="mx-auto h-24 w-24 rounded-full object-cover ring-4 ring-brand-50"
          />
        ) : (
          <span className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-brand-50 text-brand-600">
            <Icon name="user" className="h-12 w-12" />
          </span>
        )}

        <p className="mt-3 text-xl font-bold text-slate-900">
          {current?.adminName || t('common.anon')}
        </p>
        {current?.adminRole && <p className="text-sm text-slate-500">{current.adminRole}</p>}
        <p className="mt-1 font-mono text-xs text-slate-500">{session?.email ?? ''}</p>
        <p className="mt-2 text-sm text-slate-600">{village.name(lang)}</p>

        {!editing && (
          <button onClick={() => setEditing(true)} className="btn-secondary mt-4">
            <Icon name="plus" className="h-4 w-4" />
            {t('profile.edit')}
          </button>
        )}
        {saved && (
          <p className="mt-3 text-sm font-semibold text-brand-700">{t('profile.saved')}</p>
        )}
      </section>

      {editing && (
        <section className="space-y-4 rounded-3xl bg-white p-4 shadow-card">
          <p className="label">{t('profile.heading')}</p>

          <div>
            <label className="label" htmlFor="admin-name">
              {t('profile.name')}
            </label>
            <input
              id="admin-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('profile.namePlaceholder')}
              className="field"
            />
          </div>

          <div>
            <label className="label" htmlFor="admin-role">
              {t('profile.role')}
            </label>
            <input
              id="admin-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder={t('profile.rolePlaceholder')}
              className="field"
            />
          </div>

          <div>
            <label className="label" htmlFor="admin-phone">
              {t('profile.phone')}
            </label>
            <input
              id="admin-phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="98XXXXXXXX"
              className="field"
            />
            <p className="mt-2 text-xs text-slate-500">{t('profile.phoneNote')}</p>
          </div>

          <div>
            <p className="label">{t('profile.photo')}</p>
            <PhotoUpload onChange={(files) => setPhoto(files[0] ?? null)} />
            <p className="mt-2 text-xs text-slate-500">{t('profile.photoNote')}</p>
            {portrait && !photo && (
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={dropPhoto}
                  onChange={(e) => setDropPhoto(e.target.checked)}
                  className="h-4 w-4"
                />
                {t('profile.removePhoto')}
              </label>
            )}
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setEditing(false);
                setPhoto(null);
                setDropPhoto(false);
                setName(current?.adminName || '');
                setRole(current?.adminRole || '');
                setPhone(current?.adminPhone || '');
              }}
              className="rounded-2xl border-2 border-slate-200 px-4 py-3 text-sm font-bold text-slate-600"
            >
              {t('profile.cancel')}
            </button>
            <button
              onClick={save}
              disabled={busy || name.trim().length < 2}
              className="rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? t('profile.saving') : t('profile.save')}
            </button>
          </div>
        </section>
      )}

      <div className="flex items-center justify-between gap-3 rounded-3xl bg-white p-4 shadow-card">
        <span className="font-semibold text-slate-800">{t('more.language')}</span>
        <LanguageToggle />
      </div>

      <Link
        href="/admin/setup"
        className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-card transition active:scale-[0.99]"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
          <Icon name="checkCircle" className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1 font-semibold text-slate-900">{t('setup.title')}</span>
        <Icon name="chevronRight" className="h-5 w-5 shrink-0 text-slate-300" />
      </Link>

      <button
        onClick={() => signOut()}
        className="flex w-full items-center gap-3 rounded-3xl bg-white p-4 text-left shadow-card"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
          <Icon name="back" className="h-5 w-5" />
        </span>
        <span className="font-semibold text-red-600">{t('admin.logout')}</span>
      </button>
    </main>
  );
}
