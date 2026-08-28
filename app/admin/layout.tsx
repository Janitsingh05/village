'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AdminNav from '@/components/AdminNav';
import LanguageToggle from '@/components/LanguageToggle';
import Icon from '@/components/Icon';
import { watchSession, type AdminSession } from '@/lib/auth';
import { villageName } from '@/lib/config';
import { useI18n } from '@/lib/i18n';

/** Routes inside /admin that must stay reachable while signed out. */
const PUBLIC_ROUTES = ['/admin/login', '/admin/verify'];

/**
 * Client-side guard for the admin area. Firestore rules are the real
 * enforcement — this only keeps the UI honest.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, t } = useI18n();
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  const [session, setSession] = useState<AdminSession | null | undefined>(undefined);

  useEffect(() => watchSession(setSession), []);

  useEffect(() => {
    if (session === null && !isPublic) router.replace('/admin/login');
    if (session && isPublic) router.replace('/admin/dashboard');
  }, [session, isPublic, router]);

  if (isPublic) return <>{children}</>;

  if (session === undefined || session === null) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50">
        <p className="text-sm text-slate-500">{t('admin.checking')}</p>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 pb-24">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link
            href="/admin/profile"
            aria-label={t('nav.menu')}
            className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-700 hover:bg-slate-100"
          >
            <Icon name="menu" className="h-6 w-6" strokeWidth={2} />
          </Link>
          <p className="min-w-0 flex-1 truncate text-base font-bold text-slate-900">
            {villageName(lang)}
          </p>
          <LanguageToggle />
          <Link
            href="/admin/announcements"
            aria-label={t('nav.notifications')}
            className="relative -mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-700 hover:bg-slate-100"
          >
            <Icon name="bell" className="h-6 w-6" />
          </Link>
        </div>
      </header>

      {children}
      <AdminNav />
    </div>
  );
}
