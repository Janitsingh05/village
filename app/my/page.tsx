'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import ComplaintCard from '@/components/ComplaintCard';
import Icon from '@/components/Icon';
import { subscribeToComplaints, findComplaintByRef } from '@/lib/complaints';
import { complaintHref } from '@/lib/route-id';
import { ensureAnonymous } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { Complaint } from '@/lib/types';

export default function MyComplaintsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [rows, setRows] = useState<Complaint[] | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    // Matched on this device's anonymous account rather than on a phone number
    // read out of localStorage. The number is no longer on the complaint, and
    // masked numbers collide — two neighbours could both be 85xxxxxx07, and
    // "my complaints" would have shown one to the other.
    void ensureAnonymous().then((id) => setUid(id ?? ''));
  }, []);

  // Queried by owner rather than fetched-then-filtered. The window is the whole
  // village's newest forty, so filtering after the fact meant a citizen's
  // complaint disappeared from their own list as soon as forty newer ones
  // existed — and the empty state told them they had never filed anything.
  useEffect(() => {
    if (!uid) return;
    return subscribeToComplaints(
      (list) => setRows(list),
      () => setRows([]),
      { reporterUid: uid, max: 50 }
    );
  }, [uid]);

  // An empty phone means this device has never filed anything. Say so directly
  // rather than relying on the filter happening to match nothing.
  const mine =
    uid === null || rows === null
      ? null
      : uid === ''
        ? []
        : rows.filter((c) => c.reporterUid === uid);

  return (
    <div className="min-h-dvh bg-slate-50 pb-24">
      <AppHeader back="/" title={t('mine.title')} />

      <main className="mx-auto max-w-2xl px-4">
        <p className="mb-4 text-sm text-slate-500">{t('mine.subtitle')}</p>

        {/* The recovery path. This list is tied to one browser on one phone, so
            a cleared cache or a new handset loses it — and the reference on the
            receipt is the only thing the villager still has. */}
        <TrackByRef
          onFound={(id) => router.push(complaintHref(id))}
        />

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

/**
 * Looks a complaint up by the reference printed on its receipt.
 *
 * Deliberately here rather than behind a menu: the person who needs it is the
 * one staring at an empty "my complaints" list wondering where their report
 * went.
 */
function TrackByRef({ onFound }: { onFound: (id: string) => void }) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);

  async function look(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setMissing(false);
    try {
      const hit = await findComplaintByRef(code);
      if (hit) onFound(hit.id);
      else setMissing(true);
    } catch {
      setMissing(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={look} className="mb-5 rounded-3xl bg-white p-4 shadow-card">
      <label className="label" htmlFor="track-ref">
        {t('mine.trackLabel')}
      </label>
      <p className="-mt-1 mb-2 text-xs text-slate-500">{t('mine.trackHelp')}</p>
      <div className="flex gap-2">
        <input
          id="track-ref"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setMissing(false);
          }}
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="GC-260828-0012"
          className="field flex-1 font-mono"
        />
        <button
          type="submit"
          disabled={!code.trim() || busy}
          className="shrink-0 rounded-2xl bg-brand-600 px-4 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy ? t('common.loading') : t('mine.trackCta')}
        </button>
      </div>
      {missing && (
        <p className="mt-2 text-sm font-medium text-red-700">{t('mine.trackMissing')}</p>
      )}
    </form>
  );
}
