'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { listVillages, accountsNeedingReview } from '@/lib/villages';
import { useI18n } from '@/lib/i18n';
import { shortDate } from '@/lib/format';
import type { Village } from '@/lib/types';

export default function VillagesPage() {
  const { lang, t } = useI18n();
  const [rows, setRows] = useState<Village[] | null>(null);

  useEffect(() => {
    let alive = true;
    listVillages()
      .then((v) => alive && setRows(v))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-900">{t('super.villagesTitle')}</h1>
        <Link
          href="/super-admin/villages/new"
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-bold text-white"
        >
          <Icon name="plus" className="h-4 w-4" strokeWidth={2.4} />
          {t('super.addVillage')}
        </Link>
      </div>

      <div className="mb-4 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-card">
        <Link
          href="/super-admin/requests"
          className="flex items-center gap-3 p-4 transition active:bg-slate-50"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600">
            <Icon name="user" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1 font-semibold text-slate-900">{t('super.requests')}</span>
          <Icon name="chevronRight" className="h-5 w-5 shrink-0 text-slate-300" />
        </Link>
        <Link
          href="/super-admin/reports"
          className="flex items-center gap-3 p-4 transition active:bg-slate-50"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
            <Icon name="megaphone" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-slate-900">{t('super.reports')}</span>
            <span className="block truncate text-xs text-slate-500">{t('super.reportsSub')}</span>
          </span>
          <Icon name="chevronRight" className="h-5 w-5 shrink-0 text-slate-300" />
        </Link>
      </div>

      {rows === null ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-3xl bg-white p-8 text-center text-sm text-slate-400 shadow-card">
          {t('super.empty')}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((v) => {
            // Computed from the public document: the full records live in a
            // subcollection, and reading one per village to render a list would
            // cost a query each.
            const needsReview = accountsNeedingReview(v).length;

            return (
            <li key={v.id}>
            <Link
              href={'/super-admin/village?id=' + encodeURIComponent(v.id)}
              className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-card transition active:scale-[0.99]"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                <Icon name="home" className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-slate-900">{v.name}</p>
                <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                  {[v.district, v.state].filter(Boolean).join(', ')}
                  {v.location && (
                    // Onboarded by picking a real point rather than typing a
                    // district, so the location is worth trusting. A plain
                    // badge, not a link — the row is one now, and an anchor
                    // inside an anchor is invalid markup that browsers resolve
                    // by dropping one of them.
                    <span
                      title={t('search.verified')}
                      className="inline-flex shrink-0 items-center gap-0.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700"
                    >
                      <Icon name="pin" className="h-3 w-3" />
                      {t('search.verified')}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {v.adminName || t('common.none')} · {shortDate(v.createdAt, lang)}
                </p>
                {needsReview > 0 && (
                  <p className="mt-1 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                    <Icon name="clock" className="h-3 w-3" />
                    {t('super.needsReview', { n: needsReview })}
                  </p>
                )}
              </div>
              <Icon name="chevronRight" className="h-5 w-5 shrink-0 text-slate-300" />
            </Link>
            </li>
          );
          })}
        </ul>
      )}
    </main>
  );
}
