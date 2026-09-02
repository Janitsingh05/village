'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import CategoryIcon from '@/components/CategoryIcon';
import StatusBadge from '@/components/StatusBadge';
import Icon from '@/components/Icon';
import { subscribeToComplaints } from '@/lib/complaints';
import { CATEGORIES, categoryOf, STATUS_ORDER, wardLabel } from '@/lib/config';
import { useI18n } from '@/lib/i18n';
import { adminComplaintHref } from '@/lib/route-id';
import { shortDate } from '@/lib/format';
import type { Complaint, ComplaintStatus } from '@/lib/types';

type StatusFilter = 'all' | ComplaintStatus;
type DateFilter = 'all' | '7d' | '30d';

export default function AdminComplaintsPage() {
  const { lang, t } = useI18n();
  const [rows, setRows] = useState<Complaint[] | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState<string>('all');

  // The dashboard links here with a filter already chosen — "resolved", or a
  // category from the ranking. Read straight off the URL rather than through
  // useSearchParams, which would need a Suspense boundary in a static export.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('status');
    if (s && (s === 'pending' || s === 'in_progress' || s === 'resolved' || s === 'closed')) {
      setStatus(s);
    }
    const c = params.get('category');
    if (c) setCategory(c);
  }, []);
  const [dateRange, setDateRange] = useState<DateFilter>('all');

  useEffect(() => {
    // Read straight off the URL so this page needs no Suspense boundary.
    const preset = new URLSearchParams(window.location.search).get('category');
    if (preset && CATEGORIES.some((c) => c.id === preset)) setCategory(preset);
  }, []);

  useEffect(() => {
    return subscribeToComplaints(
      (list) => setRows(list),
      () => setRows([])
    );
  }, []);

  const visible = useMemo(() => {
    const cutoff =
      dateRange === '7d'
        ? Date.now() - 7 * 86400000
        : dateRange === '30d'
          ? Date.now() - 30 * 86400000
          : 0;
    return (rows || []).filter(
      (c) =>
        (status === 'all' || c.status === status) &&
        (category === 'all' || c.category === category) &&
        c.createdAt >= cutoff
    );
  }, [rows, status, category, dateRange]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-900">{t('admin.allComplaints')}</h1>
        <span className="shrink-0 text-sm text-slate-500">
          {t('admin.count', { n: visible.length })}
        </span>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <Select value={category} onChange={setCategory} label={t('admin.filterCategoryAll')}>
          <option value="all">{t('admin.filterCategoryAll')}</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {t('category.' + c.id)}
            </option>
          ))}
        </Select>

        <Select
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          label={t('admin.filterStatusAll')}
        >
          <option value="all">{t('admin.filterStatusAll')}</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {t('status.' + s)}
            </option>
          ))}
        </Select>

        <Select
          value={dateRange}
          onChange={(v) => setDateRange(v as DateFilter)}
          label={t('admin.colDate')}
        >
          <option value="all">{t('admin.filterDateAll')}</option>
          <option value="7d">{t('admin.filterDate7')}</option>
          <option value="30d">{t('admin.filterDate30')}</option>
        </Select>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-card">
        <div className="hidden grid-cols-[1fr_10rem_8rem_7rem_1.5rem] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-bold text-slate-500 sm:grid">
          <span>{t('admin.colComplaint')}</span>
          <span>{t('admin.colCategory')}</span>
          <span>{t('admin.colStatus')}</span>
          <span>{t('admin.colDate')}</span>
          <span />
        </div>

        {rows === null ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">{t('admin.emptyFilter')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((c) => (
              <li key={c.id}>
                <Link
                  href={adminComplaintHref(c.id)}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition hover:bg-slate-50 sm:grid-cols-[1fr_10rem_8rem_7rem_1.5rem]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {c.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.photoUrl}
                        alt=""
                        loading="lazy"
                        className="h-11 w-11 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <CategoryIcon id={categoryOf(c.category).id} size="sm" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {c.description}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {wardLabel(c.location.ward, lang) || t('common.none')} · {c.ref}
                      </span>
                    </span>
                  </span>

                  <span className="hidden truncate text-sm text-slate-600 sm:block">
                    {t('category.' + c.category)}
                  </span>
                  <span className="hidden sm:block">
                    <StatusBadge status={c.status} size="sm" />
                  </span>
                  <span className="hidden text-xs text-slate-500 sm:block">
                    {shortDate(c.createdAt, lang)}
                  </span>

                  <span className="flex shrink-0 items-center gap-2 sm:contents">
                    <span className="sm:hidden">
                      <StatusBadge status={c.status} size="sm" />
                    </span>
                    <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-slate-300" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="shrink-0 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
    >
      {children}
    </select>
  );
}
