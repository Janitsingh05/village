'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from './Icon';
import { useI18n } from '@/lib/i18n';

const ITEMS = [
  { href: '/', icon: 'home', key: 'nav.home' },
  { href: '/report', icon: 'camera', key: 'nav.report' },
  { href: '/announcements', icon: 'megaphone', key: 'nav.announcements' },
  { href: '/my', icon: 'user', key: 'nav.mine' },
  { href: '/more', icon: 'dots', key: 'nav.more' },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-100 bg-white shadow-nav">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={
                'flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-semibold transition ' +
                (active ? 'text-brand-600' : 'text-slate-400')
              }
            >
              <Icon
                name={item.icon}
                className="h-6 w-6"
                strokeWidth={active ? 2 : 1.7}
                filled={active && item.icon === 'home'}
              />
              <span className="w-full truncate text-center">{t(item.key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
