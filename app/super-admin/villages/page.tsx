'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { listVillages } from '@/lib/villages';
import { useI18n } from '@/lib/i18n';
import { googleMapsUrl } from '@/lib/geocode';
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

      <Link
        href="/super-admin/requests"
        className="mb-4 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card transition active:scale-[0.99]"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600">
          <Icon name="user" className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1 font-semibold text-slate-900">{t('super.requests')}</span>
        <Icon name="chevronRight" className="h-5 w-5 shrink-0 text-slate-300" />
      </Link>

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
          {rows.map((v) => (
            <li key={v.id} className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-card">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                <Icon name="home" className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-slate-900">{v.name}</p>
                <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                  {[v.district, v.state].filter(Boolean).join(', ')}
                  {v.location && (
                    // Onboarded by picking a real point rather than typing a
                    // district, so the location is worth trusting.
                    <a
                      href={googleMapsUrl(v.location.lat, v.location.lng)}
                      target="_blank"
                      rel="noreferrer"
                      title={t('search.verified')}
                      className="inline-flex shrink-0 items-center gap-0.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700"
                    >
                      <Icon name="pin" className="h-3 w-3" />
                      {t('search.verified')}
                    </a>
                  )}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {v.adminName} · {v.adminPhone} · {shortDate(v.createdAt, lang)}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-slate-400">{v.id}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
