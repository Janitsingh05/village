'use client';

import Link from 'next/link';
import LanguageToggle from './LanguageToggle';
import Icon from './Icon';
import { useI18n } from '@/lib/i18n';

/**
 * Top bar for the citizen-facing screens: menu, language, notifications.
 * `back` swaps the menu button for a back arrow and shows a title.
 */
export default function AppHeader({
  back,
  title,
  unread = false,
  action,
}: {
  back?: string;
  title?: string;
  unread?: boolean;
  action?: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        {back ? (
          <Link
            href={back}
            aria-label={t('common.back')}
            className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-700 hover:bg-slate-100"
          >
            <Icon name="back" className="h-6 w-6" />
          </Link>
        ) : (
          <Link
            href="/more"
            aria-label={t('nav.menu')}
            className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-700 hover:bg-slate-100"
          >
            <Icon name="menu" className="h-6 w-6" strokeWidth={2} />
          </Link>
        )}

        {title ? (
          <p className="min-w-0 flex-1 truncate text-lg font-bold text-slate-900">{title}</p>
        ) : (
          <span className="flex-1" />
        )}

        {action}

        <LanguageToggle />

        <Link
          href="/announcements"
          aria-label={t('nav.notifications')}
          className="relative -mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-700 hover:bg-slate-100"
        >
          <Icon name="bell" className="h-6 w-6" />
          {unread && (
            <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-white" />
          )}
        </Link>
      </div>
    </header>
  );
}
