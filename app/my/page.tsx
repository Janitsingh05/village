'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import ComplaintCard from '@/components/ComplaintCard';
import Icon from '@/components/Icon';
import { subscribeToComplaints } from '@/lib/complaints';
import { getMe } from '@/lib/me';
import { useI18n } from '@/lib/i18n';
import type { Complaint } from '@/lib/types';

export default function MyComplaintsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Complaint[] | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    setPhone(getMe()?.phone ?? '');
  }, []);

  useEffect(() => {
    return subscribeToComplaints(
      (list) => setRows(list),
      () => setRows([])
    );
  }, []);

  const mine =
    phone === null || rows === null ? null : rows.filter((c) => c.reportedBy.phone === phone);

  return (
    <div className="min-h-dvh bg-slate-50 pb-24">
      <AppHeader title={t('mine.title')} />

      <main className="mx-auto max-w-2xl px-4">
        <p className="mb-4 text-sm text-slate-500">{t('mine.subtitle')}</p>

        {mine === null ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-3xl bg-slate-200/70" />
            ))}
          </div>
        ) : mine.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-card">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-600">
              <Icon name="user" className="h-7 w-7" />
            </span>
            <p className="mt-3 font-semibold text-slate-700">{t('mine.empty')}</p>
            <Link
              href="/report"
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 font-bold text-white"
            >
              <Icon name="camera" className="h-5 w-5" />
              {t('mine.emptyCta')}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {mine.map((c) => (
              <ComplaintCard key={c.id} complaint={c} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
