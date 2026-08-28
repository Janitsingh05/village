'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LanguageToggle from '@/components/LanguageToggle';
import Icon from '@/components/Icon';
import { signOut, watchSession, type AdminSession } from '@/lib/auth';
import { villageDistrict, villageName } from '@/lib/config';
import { useI18n } from '@/lib/i18n';

export default function AdminProfilePage() {
  const router = useRouter();
  const { lang, t } = useI18n();
  const [session, setSession] = useState<AdminSession | null>(null);

  useEffect(() => watchSession(setSession), []);

  return (
    <main className="mx-auto max-w-2xl space-y-3 px-4 py-4">
      <div className="rounded-3xl bg-white p-4 text-center shadow-card">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-600">
          <Icon name="user" className="h-8 w-8" />
        </span>
        <p className="mt-3 text-lg font-bold text-slate-900">{villageName(lang)}</p>
        {villageDistrict(lang) && (
          <p className="text-sm text-slate-500">{villageDistrict(lang)}</p>
        )}
        {session && (
          <p className="mt-2 font-mono text-xs text-slate-400">
            {session.phone || session.email}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-3xl bg-white p-4 shadow-card">
        <span className="font-semibold text-slate-800">{t('more.language')}</span>
        <LanguageToggle />
      </div>

      <Link
        href="/"
        className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-card transition active:scale-[0.99]"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
          <Icon name="home" className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1 font-semibold text-slate-900">
          {t('admin.publicPage')}
        </span>
        <Icon name="chevronRight" className="h-5 w-5 shrink-0 text-slate-300" />
      </Link>

      <button
        onClick={async () => {
          await signOut();
          router.replace('/admin/login');
        }}
        className="w-full rounded-3xl bg-white p-4 text-left font-semibold text-red-600 shadow-card transition active:scale-[0.99]"
      >
        {t('admin.logout')}
      </button>
    </main>
  );
}
