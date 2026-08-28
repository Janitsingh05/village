'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LanguageToggle from '@/components/LanguageToggle';
import Logo from '@/components/Logo';
import { signOut, watchSession, type AdminSession } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/roles';
import { useI18n } from '@/lib/i18n';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const isLogin = pathname === '/super-admin/login';

  const [allowed, setAllowed] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    return watchSession(async (session: AdminSession | null) => {
      const ok = session ? await isSuperAdmin(session.uid) : false;
      if (alive) setAllowed(ok);
    });
  }, []);

  useEffect(() => {
    if (allowed === false && !isLogin) router.replace('/super-admin/login');
    if (allowed && isLogin) router.replace('/super-admin/villages');
  }, [allowed, isLogin, router]);

  if (isLogin) return <>{children}</>;

  if (allowed === undefined || !allowed) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50">
        <p className="text-sm text-slate-500">{t('admin.checking')}</p>
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
