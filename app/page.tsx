'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import ComplaintCard from '@/components/ComplaintCard';
import StatsCard from '@/components/StatsCard';
import VillageArt from '@/components/VillageArt';
import SarpanchCard from '@/components/SarpanchCard';
import Icon from '@/components/Icon';
import { subscribeToComplaints, computeStats, countComplaints } from '@/lib/complaints';
import { useVillage } from '@/lib/village-context';
import { useI18n } from '@/lib/i18n';
import type { Complaint } from '@/lib/types';

const RECENT_COUNT = 4;

export default function HomePage() {
  const { lang, t } = useI18n();
  const village = useVillage();
  const [rows, setRows] = useState<Complaint[] | null>(null);
  const [counts, setCounts] = useState<{ total: number; resolved: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A short window, because this page draws four rows and four numbers. The
  // window feeds the averages; the totals are counted on the server.
  useEffect(() => {
    return subscribeToComplaints(
      (list) => {
        setRows(list);
        setError(null);
      },
      (e) => setError(e.message),
      { max: 20 }
    );
  }, []);

  useEffect(() => {
    let alive = true;
    countComplaints()
      .then((c) => alive && setCounts(c))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => computeStats(rows || []), [rows]);
  const recent = (rows || []).slice(0, RECENT_COUNT);

  return (
    <div className="min-h-dvh bg-slate-50 pb-24">
      <AppHeader unread />

      <main className="mx-auto max-w-2xl">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-slate-50 px-4 pb-6 pt-1">
          <VillageArt className="pointer-events-none absolute bottom-0 right-0 h-40 w-[50%] [mask-image:linear-gradient(to_right,transparent,black_26%)] sm:h-48 sm:w-[44%]" />

          <div className="relative max-w-[64%]">
            <p className="text-xl font-semibold text-slate-800">
              {t('home.greeting')} <span aria-hidden>👋</span>
            </p>
            <h1 className="mt-1 text-[22px] font-extrabold leading-tight text-slate-900 sm:text-[26px]">
              {village.name(lang)}
            </h1>
            <p className="mt-1 text-sm text-slate-600">{t('home.tagline')}</p>
            {village.district(lang) && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
                <Icon name="pin" className="h-4 w-4 shrink-0" />
                <span className="truncate">{village.district(lang)}</span>
              </p>
            )}
          </div>
        </section>

        {/* Primary call to action */}
        <section className="space-y-2 px-4">
          <Link
            href="/report"
            className="flex items-center gap-4 rounded-3xl bg-brand-700 p-4 text-white shadow-cta transition active:scale-[0.99]"
          >
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/15">
              <Icon name="camera" className="h-7 w-7" strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold leading-tight">{t('home.reportCta')}</span>
              <span className="mt-0.5 block text-sm leading-snug text-brand-100">
                {t('home.reportCtaSub')}
              </span>
            </span>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-brand-700">
              <Icon name="arrowRight" className="h-5 w-5" strokeWidth={2.2} />
            </span>
          </Link>

          {/* Beside the form, not hidden inside it. Someone who does not write
              needs to see the way in before they open something they cannot
              fill. */}
          <Link
            href="/report/voice"
            className="flex items-center gap-3 rounded-3xl border-2 border-brand-200 bg-white p-3.5 transition active:scale-[0.99]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
              <Icon name="mic" className="h-6 w-6" strokeWidth={1.8} filled />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold leading-tight text-slate-900">
                {t('voice.entry')}
              </span>
              <span className="block truncate text-sm text-slate-500">{t('voice.entrySub')}</span>
            </span>
            <Icon name="chevronRight" className="h-5 w-5 shrink-0 text-slate-300" />
          </Link>
        </section>

        {/* Stats */}
        <section className="mt-4 grid grid-cols-4 gap-2 px-4">
          <StatsCard
            icon="doc"
            tone="amber"
            value={String(counts?.total ?? stats.total)}
            label={t('admin.statTotal')}
            sub={t('home.statTotalSub')}
          />
          <StatsCard
            icon="checkCircle"
            tone="green"
            value={String(counts?.resolved ?? stats.resolvedThisMonth)}
            label={t('home.statResolvedLabel')}
            sub={t('home.statResolvedSub')}
          />
          <StatsCard
            icon="clock"
            tone="blue"
            value={
              stats.avgResolutionDays == null
                ? t('common.none')
                : stats.avgResolutionDays.toFixed(1) + ' ' + t('common.days')
            }
            label={t('home.statAvgLabel')}
            sub={t('home.statAvgSub')}
          />
          <StatsCard
            icon="users"
            tone="violet"
            value={String(stats.uniqueReporters)}
            label={t('home.statPeopleLabel')}
            sub={t('home.statPeopleSub')}
          />
        </section>

        <div className="mt-4 px-4">
          <SarpanchCard />
        </div>

        {/* Recent complaints */}
        <section className="mt-5 px-4">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">{t('home.recent')}</h2>
            <Link
              href="/complaints"
              className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-brand-600"
            >
              {t('home.viewAll')}
              <Icon name="chevronRight" className="h-4 w-4" strokeWidth={2.2} />
            </Link>
          </div>

          {error && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {t('home.loadError', { msg: error })}
            </p>
          )}

          {rows === null ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-3xl bg-slate-200/70" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="rounded-3xl bg-white p-6 text-center shadow-card">
              <p className="text-4xl" aria-hidden>
                🌾
              </p>
              <p className="mt-2 font-semibold text-slate-700">{t('home.emptyTitle')}</p>
              <p className="text-sm text-slate-500">{t('home.emptyBody')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recent.map((c) => (
                <ComplaintCard key={c.id} complaint={c} />
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
