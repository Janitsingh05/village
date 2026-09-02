'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/Icon';
import Logo from '@/components/Logo';
import SarpanchCard from '@/components/SarpanchCard';
import LanguageToggle from '@/components/LanguageToggle';
import { APP_VERSION } from '@/lib/config';
import { useVillage } from '@/lib/village-context';
import { useI18n } from '@/lib/i18n';

/**
 * The menu: everything the bottom bar has no room for, laid out as grouped
 * lists rather than a stack of loose cards. The grouping is what makes a menu
 * this long readable — someone hunting for "Panchayat login" scans three short
 * headings instead of nine identical white boxes.
 */
export default function MorePage() {
  const { lang, t } = useI18n();
  const village = useVillage();
  const install = useInstallPrompt();
  const [shared, setShared] = useState(false);

  async function share() {
    const url = window.location.origin + '/';
    const text = t('more.shareText', { village: village.name(lang) });
    try {
      if (navigator.share) {
        await navigator.share({ title: 'GaonConnect', text, url });
        return;
      }
      await navigator.clipboard.writeText(text + ' ' + url);
      setShared(true);
      setTimeout(() => setShared(false), 2500);
    } catch {
      /* the user dismissed the sheet, or the clipboard is blocked */
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 pb-24">
      <AppHeader back="/" title={t('more.title')} />

      <main className="mx-auto max-w-2xl space-y-5 px-4 pb-6">
        {/* Which village this session is looking at */}
        <section className="flex items-center gap-3.5 rounded-3xl bg-gradient-to-br from-brand-700 to-brand-500 p-4 text-white shadow-cta">
          <Logo className="h-14 w-14 ring-1 ring-white/25" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-100">
              {t('more.panchayatLabel')}
            </p>
            <p className="truncate text-lg font-extrabold leading-tight">{village.name(lang)}</p>
            {village.district(lang) && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-brand-50">
                <Icon name="pin" className="h-4 w-4 shrink-0" />
                <span className="truncate">{village.district(lang)}</span>
              </p>
            )}
          </div>
        </section>

        <SarpanchCard />

        <Group title={t('more.sectionServices')}>
          <Row
            href="/report"
            icon="camera"
            tone="green"
            title={t('more.report')}
            sub={t('more.reportSub')}
          />
          <Row href="/my" icon="user" tone="blue" title={t('mine.title')} sub={t('mine.subtitle')} />
          <Row
            href="/announcements"
            icon="megaphone"
            tone="amber"
            title={t('announce.title')}
            sub={t('announce.subtitle')}
          />
          <Row
            href="/complaints"
            icon="list"
            tone="violet"
            title={t('more.feed')}
            sub={t('more.feedSub')}
          />
        </Group>

        <Group title={t('more.sectionPanchayat')}>
          <Row
            href="/admin/login"
            icon="shield"
            tone="green"
            title={t('more.adminLogin')}
            sub={t('more.adminLoginSub')}
          />
        </Group>

        <Group title={t('more.sectionApp')}>
          <Row icon="globe" tone="blue" title={t('more.language')} sub={t('more.languageSub')}>
            <LanguageToggle />
          </Row>

          {/* Chrome hands over an install prompt only once the app qualifies for
              one, and iOS never does — so without it the row stays the manual
              "add to home screen" hint it has always been. */}
          <Row
            icon="download"
            tone="amber"
            title={t('more.install')}
            sub={t('more.installSub')}
            onClick={install || undefined}
          >
            {install && (
              <span className="shrink-0 rounded-full bg-brand-600 px-3.5 py-1.5 text-sm font-bold text-white">
                {t('more.installCta')}
              </span>
            )}
          </Row>

          <Row
            icon="share"
            tone="violet"
            title={t('more.share')}
            sub={shared ? t('more.shareCopied') : t('more.shareSub')}
            onClick={share}
          />
        </Group>

        <footer className="pt-1 text-center">
          <Logo variant="full" className="mx-auto h-20 w-20" />
          <p className="mt-2 font-bold text-slate-900">{t('more.about')}</p>
          <p className="mt-0.5 text-sm text-slate-500">{t('more.aboutSub')}</p>
          <p className="mt-2 text-xs text-slate-500">{t('more.version', { v: APP_VERSION })}</p>
        </footer>
      </main>

      <BottomNav />
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-card">
        {children}
      </div>
    </section>
  );
}

const TONES = {
  green: 'bg-brand-50 text-brand-600',
  blue: 'bg-sky-50 text-sky-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
} as const;

/**
 * One menu line. A row is a link when it navigates, a button when it acts, and
 * a plain div when it only hosts a control such as the language toggle — so a
 * screen reader is never told to activate something inert, and the toggle is
 * never nested inside another button.
 */
function Row({
  href,
  onClick,
  icon,
  tone,
  title,
  sub,
  children,
}: {
  href?: string;
  onClick?: () => void;
  icon: 'camera' | 'user' | 'megaphone' | 'list' | 'shield' | 'globe' | 'download' | 'share';
  tone: keyof typeof TONES;
  title: string;
  sub: string;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <span className={'grid h-11 w-11 shrink-0 place-items-center rounded-2xl ' + TONES[tone]}>
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-semibold text-slate-900">{title}</span>
        <span className="block truncate text-sm text-slate-500">{sub}</span>
      </span>
      {children}
      {(href || onClick) && !children && (
        <Icon name="chevronRight" className="h-5 w-5 shrink-0 text-slate-300" />
      )}
    </>
  );

  const shell = 'flex w-full items-center gap-3 p-4 transition';

  if (href) {
    return (
      <Link href={href} className={shell + ' active:bg-slate-50'}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shell + ' active:bg-slate-50'}>
        {body}
      </button>
    );
  }

  return <div className={shell}>{body}</div>;
}

/**
 * Returns a function that opens the browser's own install dialog, or null when
 * the browser never offered one.
 */
function useInstallPrompt(): (() => void) | null {
  const [event, setEvent] = useState<Event | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!event) return null;
  return () => {
    (event as Event & { prompt: () => void }).prompt();
    setEvent(null);
  };
}
