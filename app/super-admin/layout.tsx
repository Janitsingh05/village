'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LanguageToggle from '@/components/LanguageToggle';
import Logo from '@/components/Logo';
import { signOut, watchSession, type AdminSession } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/roles';
import { useI18n } from '@/lib/i18n';
import { samePath } from '@/lib/route-match';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const isLogin = samePath(pathname, '/super-admin/login');

  const [allowed, setAllowed] = useState<boolean | undefined>(undefined);

  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    // Both cleanups, composed. The effect used to return only watchSession's
    // unsubscribe, so `alive = false` never ran and a late role check could
    // still call setState after unmount.
    let alive = true;
    const stop = watchSession(async (session: AdminSession | null) => {
      const ok = session ? await isSuperAdmin(session.uid) : false;
      if (!alive) return;
      setSignedIn(Boolean(session));
      setAllowed(ok);
    });
    return () => {
      alive = false;
      stop();
    };
  }, []);

  useEffect(() => {
    // Only bounce someone who is not signed in at all. A signed-in account
    // without the role used to be sent to a login page it was already logged
    // into — no message, no way out, just the same screen again.
    if (allowed === false && !signedIn && !isLogin) router.replace('/super-admin/login');
    if (allowed && isLogin) router.replace('/super-admin/villages');
  }, [allowed, signedIn, isLogin, router]);

  if (isLogin) return <>{children}</>;

  if (allowed === undefined) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50">
        <p className="text-sm text-slate-500">{t('admin.checking')}</p>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50 px-6">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-card">
          <h1 className="text-lg font-bold text-slate-900">{t('super.notSuperAdmin')}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {t('super.notSuperAdminSub')}
          </p>
          <button
            onClick={async () => {
              await signOut();
              router.replace('/super-admin/login');
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
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/super-admin/villages" className="min-w-0 flex-1">
            <Logo withWordmark name="GaonConnect" tagline={t('super.loginHeading')} />
          </Link>
          <LanguageToggle />
          <button
            onClick={async () => {
              await signOut();
              router.replace('/super-admin/login');
            }}
            className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            {t('admin.logout')}
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
