'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import AdminNav from '@/components/AdminNav';
import AdminDrawer from '@/components/AdminDrawer';
import LanguageToggle from '@/components/LanguageToggle';
import Icon from '@/components/Icon';
import { signOut, watchSession, type AdminSession } from '@/lib/auth';
import { villageForUser, termEndFor, termState } from '@/lib/villages';
import { setActiveVillage } from '@/lib/tenant';
import { useVillage } from '@/lib/village-context';
import { useI18n } from '@/lib/i18n';
import { isOneOf } from '@/lib/route-match';

/** Routes inside /admin that must stay reachable while signed out. */
const PUBLIC_ROUTES = ['/admin/login', '/admin/register'];

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
  const isPublic = isOneOf(pathname, PUBLIC_ROUTES);

  const [session, setSession] = useState<AdminSession | null | undefined>(undefined);
  const [unclaimed, setUnclaimed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => watchSession(setSession), []);

  // Which village this account administers. One query against the same array
  // the Firestore rules read, so the app and the rules can never disagree —
  // and nothing to claim, because approval already wrote this UID onto the
  // village.
  const resolvedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!session) return;
    // Resolve once per signed-in account; re-running on every render would loop
    // against the village reload below.
    if (resolvedFor.current === session.uid) return;
    resolvedFor.current = session.uid;

    let alive = true;
    villageForUser(session.uid)
      .then((villageId) => {
        if (!alive) return;
        if (villageId) {
          setActiveVillage(villageId);
          reloadVillage();
          setUnclaimed(false);
        } else {
          // Signed in, but no village lists this account — a registration
          // waiting on approval, or one that was refused. Say so rather than
          // silently showing them the default village.
          setUnclaimed(true);
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

  // A Sarpanch's term ends; their access should not outlive it. Firestore rules
  // cannot compare a clock against a per-person date without a server to run
  // the sweep, so this is a stop rather than a lock — it turns away the real
  // case, an ex-admin who still has the app on their phone, and the super admin
  // sees the same expiry in their own list and can revoke properly.
  if (termState(termEndFor(village.village, session.uid)) === 'expired') {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50 px-6">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-card">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-50 text-amber-600">
            <Icon name="clock" className="h-7 w-7" />
          </span>
          <h1 className="mt-3 text-lg font-bold text-slate-900">{t('admin.termEnded')}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('admin.termEndedSub')}</p>
          <button
            onClick={async () => {
              await signOut();
              router.replace('/admin/login');
            }}
            className="btn-secondary mt-5"
          >
            {t('admin.logout')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 pb-24">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label={t('nav.menu')}
            aria-expanded={menuOpen}
            className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-700 hover:bg-slate-100"
          >
            <Icon name="menu" className="h-6 w-6" strokeWidth={2} />
          </button>
          <p className="min-w-0 flex-1 truncate text-base font-bold text-slate-900">
            {village.name(lang)}
          </p>
          <LanguageToggle />
          <Link
            href="/admin/announcements"
            aria-label={t('nav.notifications')}
            className="relative -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-700 hover:bg-slate-100"
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

      <AdminDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        email={session.email}
        onSignOut={async () => {
          await signOut();
          router.replace('/admin/login');
        }}
      />
    </div>
  );
}
