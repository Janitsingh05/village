'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import AdminNav from '@/components/AdminNav';
import LanguageToggle from '@/components/LanguageToggle';
import Icon from '@/components/Icon';
import { watchSession, type AdminSession } from '@/lib/auth';
import { claimVillageForAdmin } from '@/lib/villages';
import { setActiveVillage } from '@/lib/tenant';
import { isFirebaseConfigured } from '@/lib/firebase';
import { useVillage } from '@/lib/village-context';
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
  const village = useVillage();
  const reloadVillage = village.reload;
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  const [session, setSession] = useState<AdminSession | null | undefined>(undefined);
  const [unclaimed, setUnclaimed] = useState(false);

  useEffect(() => watchSession(setSession), []);

  // Onboarding only records the admin's phone number — their Auth UID does not
  // exist until this moment. Claim the village on first sign-in so the
  // Firestore rules will accept their updates, and point the session at it.
  const claimedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!session) return;
    // Claim once per signed-in account; re-running on every render would loop
    // against the village reload below.
    if (claimedFor.current === session.uid) return;
    claimedFor.current = session.uid;

    let alive = true;
    claimVillageForAdmin(session.uid, session.phone)
      .then((villageId) => {
        if (!alive) return;
        if (villageId) {
          setActiveVillage(villageId);
          reloadVillage();
          setUnclaimed(false);
        } else {
          // Signed in, but no village names this number. On a real backend that
          // means they cannot update anything, so say so rather than silently
          // showing them the default village.
          setUnclaimed(isFirebaseConfigured && Boolean(session.phone));
        }
      })
      .catch(() => alive && setUnclaimed(false));
    return () => {
      alive = false;
    };
  }, [session, reloadVillage]);

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
            {village.name(lang)}
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

      {unclaimed && (
        <p className="mx-auto max-w-5xl px-4 pt-4">
          <span className="block rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t('admin.notLinked')}
          </span>
        </p>
      )}

      {children}
      <AdminNav />
    </div>
  );
}
