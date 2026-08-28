'use client';

import { useEffect, useMemo, useState } from 'react';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import ComplaintCard from '@/components/ComplaintCard';
import { subscribeToComplaints } from '@/lib/complaints';
import { STATUS_ORDER } from '@/lib/config';
import { useI18n } from '@/lib/i18n';
import type { Complaint, ComplaintStatus } from '@/lib/types';

type Filter = 'all' | ComplaintStatus;
const FILTERS: Filter[] = ['all', ...STATUS_ORDER];

export default function AllComplaintsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Complaint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    return subscribeToComplaints(
      (list) => {
        setRows(list);
        setError(null);
      },
      (e) => setError(e.message)
    );
  }, []);

  const visible = useMemo(
    () => (rows || []).filter((c) => filter === 'all' || c.status === filter),
    [rows, filter]
  );

  return (
    <div className="min-h-dvh bg-slate-50 pb-24">
      <AppHeader back="/" title={t('home.feedTitle')} />

      <main className="mx-auto max-w-2xl px-4">
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                'shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ' +
                (filter === f ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 shadow-card')
              }
            >
              {f === 'all' ? t('home.filterAll') : t('status.' + f)}
            </button>
          ))}
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
        ) : visible.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-card">
            <p className="text-4xl" aria-hidden>
              🌾
            </p>
            <p className="mt-2 font-semibold text-slate-700">{t('home.emptyTitle')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((c) => (
              <ComplaintCard key={c.id} complaint={c} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
