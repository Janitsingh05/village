'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { subscribeToAdminRequests, decideAdminRequest } from '@/lib/admin-requests';
import { useI18n } from '@/lib/i18n';
import { shortDate } from '@/lib/format';
import type { AdminRequest } from '@/lib/types';

const CHIP = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-brand-50 text-brand-700',
  rejected: 'bg-slate-100 text-slate-500',
} as const;

export default function AdminRequestsPage() {
  const { lang, t } = useI18n();
  const [rows, setRows] = useState<AdminRequest[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeToAdminRequests(
        (list) => {
          setRows(list);
          setError(null);
        },
        (e) => setError(e.message)
      ),
    []
  );

  const pending = useMemo(() => (rows || []).filter((r) => r.status === 'pending').length, [rows]);

  async function decide(request: AdminRequest, decision: 'approved' | 'rejected') {
    setBusy(request.id);
    setError(null);
    try {
      await decideAdminRequest(request, decision);
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
        <h1 className="text-lg font-bold text-slate-900">{t('super.requests')}</h1>
        {pending > 0 && (
          <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
            {t('super.requestsPending', { n: pending })}
          </span>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {rows === null ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-card">
          {t('super.noRequests')}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl bg-white p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold text-slate-900">{r.name}</p>
                  <p className="truncate text-sm text-slate-600">
                    {r.villageName}
                    {r.role ? ' · ' + r.role : ''}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-500">{r.phone}</p>
                  <p className="mt-1 text-xs text-slate-400">{shortDate(r.createdAt, lang)}</p>
                </div>
                <span
                  className={'shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold ' + CHIP[r.status]}
                >
                  {t('super.status' + r.status.charAt(0).toUpperCase() + r.status.slice(1))}
                </span>
              </div>

              {r.status === 'pending' && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => decide(r, 'rejected')}
                    disabled={busy === r.id}
                    className="rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-600 disabled:opacity-50"
                  >
                    {t('super.reject')}
                  </button>
                  <button
                    onClick={() => decide(r, 'approved')}
                    disabled={busy === r.id}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    <Icon name="checkCircle" className="h-4 w-4" strokeWidth={2.4} />
                    {t('super.approve')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
