'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { subscribeToAdminReports, markReportReviewed } from '@/lib/admin-reports';
import { useI18n } from '@/lib/i18n';
import { shortDate } from '@/lib/format';
import type { AdminReport } from '@/lib/types';

/**
 * What villagers say about the people running their villages.
 *
 * These are anonymous and unverified by design, so nothing here is evidence on
 * its own — three reports naming the same village are a reason to go and look,
 * not a reason to revoke. Marking one reviewed says a human read it, which is
 * the least this screen owes someone who bothered to write in.
 */
export default function AdminReportsPage() {
  const { lang, t } = useI18n();
  const [rows, setRows] = useState<AdminReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeToAdminReports(
        (list) => {
          setRows(list);
          setError(null);
        },
        (e) => setError(e.message)
      ),
    []
  );

  const open = useMemo(() => (rows || []).filter((r) => r.status === 'open').length, [rows]);

  async function review(id: string) {
    setBusy(id);
    try {
      await markReportReviewed(id);
    } catch {
      setError(t('super.decideFailed'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-4">
      <Link
        href="/super-admin/villages"
        className="mb-4 inline-block text-sm font-semibold text-slate-500 hover:text-slate-800"
      >
        ← {t('super.villagesTitle')}
      </Link>

      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-900">{t('super.reports')}</h1>
        {open > 0 && (
          <span className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
            {t('super.reportsOpen', { n: open })}
          </span>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {rows === null ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-3xl bg-white p-8 text-center text-sm text-slate-400 shadow-card">
          {t('super.noReports')}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl bg-white p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-900">{r.villageName}</p>
                  {r.aboutName && (
                    <p className="truncate text-sm text-slate-600">
                      {t('super.reportAbout', { name: r.aboutName })}
                    </p>
                  )}
                </div>
                {r.status === 'open' ? (
                  <span className="shrink-0 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                    {t('super.reportOpen')}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                    {t('super.reportReviewed')}
                  </span>
                )}
              </div>

              <p className="mt-2 whitespace-pre-wrap text-[13px] leading-snug text-slate-700">
                {r.reason}
              </p>
              <p className="mt-2 text-xs text-slate-400">{shortDate(r.createdAt, lang)}</p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link
                  href={'/super-admin/village?id=' + encodeURIComponent(r.villageId)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-600"
                >
                  <Icon name="shield" className="h-4 w-4" />
                  {t('super.openVillage')}
                </Link>
                <button
                  disabled={busy === r.id || r.status === 'reviewed'}
                  onClick={() => review(r.id)}
                  className="rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                >
                  {t('super.markReviewed')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
