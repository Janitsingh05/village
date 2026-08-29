'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import CategoryIcon from '@/components/CategoryIcon';
import StatusBadge from '@/components/StatusBadge';
import Icon from '@/components/Icon';
import { subscribeToComplaints } from '@/lib/complaints';
import { useI18n } from '@/lib/i18n';
import { adminComplaintHref } from '@/lib/route-id';
import type { CategoryId, Complaint } from '@/lib/types';

const DAY = 86400000;

/** When a complaint was actually marked resolved, not merely last touched. */
function resolvedAt(c: Complaint): number | null {
  const e = [...c.timeline].reverse().find((t) => t.status === 'resolved');
  return e ? e.at : null;
}

export default function PerformancePage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Complaint[] | null>(null);

  useEffect(
    () =>
      subscribeToComplaints(
        (list) => setRows(list),
        () => setRows([])
      ),
    []
  );

  const view = useMemo(() => {
    const all = rows || [];

    const solved = all
      .map((c) => {
        const done = resolvedAt(c);
        return done == null ? null : { c, days: (done - c.createdAt) / DAY };
      })
      .filter((x): x is { c: Complaint; days: number } => x != null && x.days >= 0)
      .sort((a, b) => a.days - b.days);

    const byCat = new Map<CategoryId, number[]>();
    solved.forEach(({ c, days }) => {
      const list = byCat.get(c.category) || [];
      list.push(days);
      byCat.set(c.category, list);
    });

    const open = all
      .filter((c) => c.status === 'pending' || c.status === 'in_progress')
      .map((c) => ({ c, days: (Date.now() - c.createdAt) / DAY }))
      .sort((a, b) => b.days - a.days)
      .slice(0, 5);

    return {
      solved,
      avg: solved.length ? solved.reduce((s, x) => s + x.days, 0) / solved.length : null,
      categories: [...byCat.entries()]
        .map(([id, days]) => ({
          id,
          avg: days.reduce((a, b) => a + b, 0) / days.length,
        }))
        .sort((a, b) => b.avg - a.avg),
      open,
    };
  }, [rows]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-4">
      <Link
        href="/admin/dashboard"
        className="mb-4 inline-block text-sm font-semibold text-slate-500 hover:text-slate-800"
      >
        {t('admin.backToDashboard')}
      </Link>

      <h1 className="text-lg font-bold text-slate-900">{t('perf.title')}</h1>
      <p className="mb-4 text-sm text-slate-500">{t('perf.subtitle')}</p>

      <section className="rounded-3xl bg-white p-5 text-center shadow-card">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-blue-500">
          <Icon name="clock" className="h-6 w-6" strokeWidth={2} />
        </span>
        {view.avg == null ? (
          <p className="mt-3 text-sm text-slate-500">{t('perf.noResolved')}</p>
        ) : (
          <>
            <p className="mt-3 text-3xl font-bold leading-none text-slate-900">
              {view.avg.toFixed(1)} {t('common.days')}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-700">{t('perf.avgAll')}</p>
            <p className="text-xs text-slate-400">
              {t('perf.resolvedCount', { n: view.solved.length })}
            </p>
          </>
        )}
      </section>

      {view.solved.length > 1 && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Extreme label={t('perf.fastest')} entry={view.solved[0]} tone="text-brand-700" />
          <Extreme
            label={t('perf.slowest')}
            entry={view.solved[view.solved.length - 1]}
            tone="text-amber-700"
          />
        </div>
      )}

      {view.categories.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-base font-bold text-slate-900">{t('perf.byCategory')}</h2>
          <ul className="space-y-2">
            {view.categories.map((row) => (
              <li key={row.id} className="rounded-2xl bg-white p-3 shadow-card">
                <Link
                  href={'/admin/complaints?category=' + row.id}
                  className="flex items-center gap-3"
                >
                  <CategoryIcon id={row.id} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {t('category.' + row.id)}
                    </span>
                    {/* Bar is relative to the slowest category, so the worst
                        offender stands out without reading every number. */}
                    <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full bg-blue-400"
                        style={{
                          width:
                            Math.max(6, (row.avg / (view.categories[0].avg || 1)) * 100) + '%',
                        }}
                      />
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-bold text-slate-900">
                      {row.avg.toFixed(1)}
                    </span>
                    <span className="block text-[10px] text-slate-400">{t('common.days')}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-5">
        <h2 className="mb-2 text-base font-bold text-slate-900">{t('perf.longestOpen')}</h2>
        {view.open.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-slate-500 shadow-card">
            {t('perf.noOpen')}
          </p>
        ) : (
          <ul className="space-y-2">
            {view.open.map(({ c, days }) => (
              <li key={c.id}>
                <Link
                  href={adminComplaintHref(c.id)}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card"
                >
                  <CategoryIcon id={c.category} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {c.description}
                    </span>
                    <span className="text-xs text-slate-400">
                      {t('perf.openFor', { n: Math.round(days) })}
                    </span>
                  </span>
                  <StatusBadge status={c.status} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Extreme({
  label,
  entry,
  tone,
}: {
  label: string;
  entry: { c: Complaint; days: number };
  tone: string;
}) {
  const { t } = useI18n();
  return (
    <Link
      href={adminComplaintHref(entry.c.id)}
      className="rounded-2xl bg-white p-3 shadow-card transition active:scale-[0.98]"
    >
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <p className={'mt-1 text-lg font-bold leading-none ' + tone}>
        {t('perf.resolvedIn', { n: entry.days.toFixed(1) })}
      </p>
      <p className="mt-1 truncate text-xs text-slate-500">{t('category.' + entry.c.category)}</p>
    </Link>
  );
}
