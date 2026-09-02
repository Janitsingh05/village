'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import CategoryIcon from '@/components/CategoryIcon';
import StatsCard from '@/components/StatsCard';
import StatusDonut from '@/components/StatusDonut';
import Icon from '@/components/Icon';
import { subscribeToComplaints, computeStats } from '@/lib/complaints';
import { categoryOf } from '@/lib/config';
import { useI18n } from '@/lib/i18n';
import type { CategoryId, Complaint } from '@/lib/types';

type Period = 'month' | 'week' | 'all';

const CUTOFFS: Record<Period, number> = {
  week: 7 * 86400000,
  month: 30 * 86400000,
  all: Infinity,
};

export default function AdminDashboardPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Complaint[] | null>(null);
  const [period, setPeriod] = useState<Period>('month');

  useEffect(() => {
    return subscribeToComplaints(
      (list) => setRows(list),
      () => setRows([])
    );
  }, []);

  const scoped = useMemo(() => {
    const span = CUTOFFS[period];
    if (span === Infinity) return rows || [];
    const cutoff = Date.now() - span;
    return (rows || []).filter((c) => c.createdAt >= cutoff);
  }, [rows, period]);

  // Two sets on purpose: "total" means everything ever, while the other tiles
  // answer for the period the admin picked. Running the month-scoped figures
  // over an already-period-filtered list double-counted the window and made
  // "this week" drop complaints at the start of a month.
  const allTime = useMemo(() => computeStats(rows || []), [rows]);
  const stats = useMemo(() => computeStats(scoped), [scoped]);

  const topCategories = useMemo(() => {
    const counts = new Map<CategoryId, number>();
    scoped.forEach((c) => counts.set(c.category, (counts.get(c.category) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [scoped]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-900">{t('admin.overview')}</h1>
        <select
          aria-label={t('admin.periodMonth')}
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
        >
          <option value="month">{t('admin.periodMonth')}</option>
          <option value="week">{t('admin.periodWeek')}</option>
          <option value="all">{t('admin.periodAll')}</option>
        </select>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <StatsCard
          icon="doc"
          tone="amber"
          value={String(allTime.total)}
          label={t('admin.statTotal')}
          href="/admin/complaints"
        />
        <StatsCard
          icon="clock"
          tone="blue"
          value={String(stats.total)}
          label={t('admin.statNew')}
          href="/admin/complaints?status=pending"
        />
        <StatsCard
          icon="checkCircle"
          tone="green"
          value={String(stats.resolved)}
          label={t('admin.statResolvedShort')}
          href="/admin/complaints?status=resolved"
        />
        <StatsCard
          icon="users"
          tone="violet"
          value={
            stats.avgResolutionDays == null
              ? t('common.none')
              : stats.avgResolutionDays.toFixed(1) + ' ' + t('common.days')
          }
          label={t('admin.statAvg')}
          href="/admin/performance"
        />
      </div>

      <section className="mt-5 rounded-3xl bg-white p-4 shadow-card">
        <h2 className="mb-4 text-base font-bold text-slate-900">{t('admin.chartHeading')}</h2>
        {rows === null ? (
          <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
        ) : (
          <StatusDonut
            total={stats.total}
            counts={{
              pending: stats.pending,
              in_progress: stats.inProgress,
              resolved: stats.resolved,
              closed: stats.closed,
            }}
          />
        )}
      </section>

      <section className="mt-4 rounded-3xl bg-white p-4 shadow-card">
        <h2 className="mb-3 text-base font-bold text-slate-900">{t('admin.topCategories')}</h2>
        {topCategories.length === 0 ? (
          <p className="text-sm text-slate-500">{t('admin.emptyFilter')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {topCategories.map(([id, count]) => (
              <li key={id}>
                <Link
                  href={'/admin/complaints?category=' + id}
                  className="flex items-center gap-3 py-2.5"
                >
                  <CategoryIcon id={categoryOf(id).id} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
                    {t('category.' + id)}
                  </span>
                  <span className="shrink-0 text-sm font-bold text-slate-900">{count}</span>
                  <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
