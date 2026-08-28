'use client';

import { useEffect, useMemo, useState } from 'react';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/Icon';
import { subscribeToAnnouncements } from '@/lib/announcements';
import { useI18n } from '@/lib/i18n';
import { shortDate } from '@/lib/format';
import type { Announcement } from '@/lib/types';

const KIND_STYLES = {
  urgent: { chip: 'bg-orange-100 text-orange-700', card: 'border-l-4 border-orange-400' },
  general: { chip: 'bg-blue-100 text-blue-700', card: 'border-l-4 border-blue-300' },
} as const;

export default function AnnouncementsPage() {
  const { lang, t } = useI18n();
  const [rows, setRows] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | 'urgent'>('all');

  useEffect(() => {
    return subscribeToAnnouncements(
      (list) => {
        setRows(list);
        setError(null);
      },
      (e) => setError(e.message)
    );
  }, []);

  const visible = useMemo(
    () => (rows || []).filter((a) => tab === 'all' || a.kind === 'urgent'),
    [rows, tab]
  );

  return (
    <div className="min-h-dvh bg-slate-50 pb-24">
      <AppHeader back="/" title={t('announce.title')} />

      <main className="mx-auto max-w-2xl px-4">
        <div className="mb-4 grid grid-cols-2 rounded-2xl bg-white p-1 shadow-card">
          {(['all', 'urgent'] as const).map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={
                'rounded-xl px-3 py-2.5 text-sm font-bold transition ' +
                (tab === id ? 'bg-brand-600 text-white' : 'text-slate-500')
              }
            >
              {id === 'all' ? t('announce.tabAll') : t('announce.tabUrgent')}
            </button>
          ))}
        </div>

        {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {rows === null ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200/70" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-card">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-600">
              <Icon name="megaphone" className="h-7 w-7" />
            </span>
            <p className="mt-3 font-semibold text-slate-700">{t('announce.empty')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((a) => {
              const style = KIND_STYLES[a.kind];
              return (
                <article
                  key={a.id}
                  className={'rounded-2xl bg-white p-4 shadow-card ' + style.card}
                >
                  <span
                    className={
                      'inline-block rounded-md px-2 py-1 text-[11px] font-bold ' + style.chip
                    }
                  >
                    {a.kind === 'urgent' ? t('announce.kindUrgent') : t('announce.kindGeneral')}
                  </span>
                  <h2 className="mt-2 text-base font-bold leading-snug text-slate-900">
                    {a.title}
                  </h2>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                    {a.body}
                  </p>
                  {a.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.photoUrl}
                      alt=""
                      loading="lazy"
                      className="mt-3 w-full rounded-xl object-cover"
                    />
                  )}
                  <p className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-400">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Icon name="megaphone" className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{a.postedBy || t('announce.postedBy')}</span>
                    </span>
                    <span className="shrink-0">{shortDate(a.createdAt, lang)}</span>
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
