'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { subscribeToAnnouncements } from '@/lib/announcements';
import { useI18n } from '@/lib/i18n';
import { shortDate } from '@/lib/format';
import type { Announcement } from '@/lib/types';

export default function AdminAnnouncementsPage() {
  const { lang, t } = useI18n();
  const [rows, setRows] = useState<Announcement[] | null>(null);

  useEffect(() => {
    return subscribeToAnnouncements(
      (list) => setRows(list),
      () => setRows([])
    );
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-900">{t('announce.title')}</h1>
        <Link
          href="/admin/announcements/new"
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-bold text-white"
        >
          <Icon name="plus" className="h-4 w-4" strokeWidth={2.4} />
          {t('announce.newTitle')}
        </Link>
      </div>

      {rows === null ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-3xl bg-white p-8 text-center text-sm text-slate-500 shadow-card">
          {t('announce.empty')}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => (
            <li key={a.id} className="rounded-3xl bg-white p-4 shadow-card">
              <span
                className={
                  'inline-block rounded-md px-2 py-1 text-[11px] font-bold ' +
                  (a.kind === 'urgent'
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-blue-100 text-blue-700')
                }
              >
                {a.kind === 'urgent' ? t('announce.kindUrgent') : t('announce.kindGeneral')}
              </span>
              <p className="mt-2 font-bold text-slate-900">{a.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{a.body}</p>
              <p className="mt-2 text-xs text-slate-500">{shortDate(a.createdAt, lang)}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
