'use client';

import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/Icon';
import LanguageToggle from '@/components/LanguageToggle';
import { useVillage } from '@/lib/village-context';
import { useI18n } from '@/lib/i18n';

export default function MorePage() {
  const { lang, t } = useI18n();
  const village = useVillage();

  return (
    <div className="min-h-dvh bg-slate-50 pb-24">
      <AppHeader back="/" title={t('more.title')} />

      <main className="mx-auto max-w-2xl space-y-3 px-4">
        <div className="rounded-3xl bg-white p-4 shadow-card">
          <p className="text-lg font-bold text-slate-900">{village.name(lang)}</p>
          {village.district(lang) && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <Icon name="pin" className="h-4 w-4 shrink-0" />
              {village.district(lang)}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-3xl bg-white p-4 shadow-card">
          <span className="font-semibold text-slate-800">{t('more.language')}</span>
          <LanguageToggle />
        </div>

        <Row
          href="/announcements"
          icon="megaphone"
          title={t('announce.title')}
          sub={t('announce.subtitle')}
        />
        <Row href="/my" icon="user" title={t('mine.title')} sub={t('mine.subtitle')} />
        <Row
          href="/admin/login"
          icon="home"
          title={t('more.adminLogin')}
          sub={t('more.adminLoginSub')}
        />

        <div className="rounded-3xl bg-white p-4 shadow-card">
          <p className="font-semibold text-slate-800">{t('more.install')}</p>
          <p className="mt-1 text-sm text-slate-500">{t('more.installSub')}</p>
        </div>

        <div className="rounded-3xl bg-white p-4 text-center shadow-card">
          <p className="font-bold text-slate-900">{t('more.about')}</p>
          <p className="mt-1 text-sm text-slate-500">{t('more.aboutSub')}</p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function Row({
  href,
  icon,
  title,
  sub,
}: {
  href: string;
  icon: 'megaphone' | 'user' | 'home';
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-card transition active:scale-[0.99]"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-slate-900">{title}</span>
        <span className="block truncate text-sm text-slate-500">{sub}</span>
      </span>
      <Icon name="chevronRight" className="h-5 w-5 shrink-0 text-slate-300" />
    </Link>
  );
}
