'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Icon from './Icon';
import Logo from './Logo';
import LanguageToggle from './LanguageToggle';
import { useI18n } from '@/lib/i18n';
import { useVillage } from '@/lib/village-context';
import { maskPhone } from '@/lib/format';
import { samePath } from '@/lib/route-match';

const LINKS = [
  { href: '/admin/dashboard', icon: 'grid', key: 'admin.navDashboard' },
  { href: '/admin/complaints', icon: 'list', key: 'admin.navComplaints' },
  { href: '/admin/performance', icon: 'clock', key: 'perf.title' },
  { href: '/admin/announcements', icon: 'megaphone', key: 'admin.navAnnounce' },
  { href: '/admin/profile', icon: 'user', key: 'admin.navProfile' },
  { href: '/admin/setup', icon: 'checkCircle', key: 'setup.title' },
] as const;

export default function AdminDrawer({
  open,
  onClose,
  phone,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  phone: string;
  onSignOut: () => void;
}) {
  const { lang, t } = useI18n();
  const village = useVillage();
  const pathname = usePathname();

  // Escape closes it, and the page behind must not scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={
          'fixed inset-0 z-40 bg-slate-900/40 transition-opacity duration-200 ' +
          (open ? 'opacity-100' : 'pointer-events-none opacity-0')
        }
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('admin.menuHeading')}
        className={
          'fixed inset-y-0 left-0 z-50 flex w-[82%] max-w-xs flex-col bg-white shadow-2xl transition-transform duration-200 ' +
          (open ? 'translate-x-0' : '-translate-x-full')
        }
      >
        <div className="flex items-start gap-3 border-b border-slate-100 p-4">
          <Logo className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold leading-tight text-slate-900">
              {village.name(lang)}
            </p>
            <p className="truncate text-xs text-slate-500">{village.district(lang)}</p>
            {phone && (
              <p className="mt-1 truncate font-mono text-[11px] text-slate-400">
                {t('admin.signedInAs', { phone: maskPhone(phone) })}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={t('nav.close')}
            className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <Icon name="plus" className="h-5 w-5 rotate-45" strokeWidth={2.4} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {LINKS.map((l) => {
            const active = samePath(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={
                  'mb-1 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition ' +
                  (active ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50')
                }
              >
                <Icon name={l.icon} className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{t(l.key)}</span>
                {active && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-slate-100 p-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-sm font-semibold text-slate-700">{t('more.language')}</span>
            <LanguageToggle />
          </div>

          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Icon name="home" className="h-5 w-5 shrink-0" />
            {t('admin.publicPage')}
          </Link>

          <button
            onClick={() => {
              onClose();
              onSignOut();
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <Icon name="back" className="h-5 w-5 shrink-0" />
            {t('admin.logout')}
          </button>
        </div>
      </aside>
    </>
  );
}
