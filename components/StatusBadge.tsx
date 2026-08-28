'use client';

import type { ComplaintStatus } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

const STYLES: Record<ComplaintStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  in_progress: 'bg-blue-50 text-blue-700',
  resolved: 'bg-brand-50 text-brand-700',
  closed: 'bg-slate-100 text-slate-600',
};

export const STATUS_DOT: Record<ComplaintStatus, string> = {
  pending: 'bg-amber-500',
  in_progress: 'bg-blue-500',
  resolved: 'bg-brand-500',
  closed: 'bg-slate-400',
};

export default function StatusBadge({
  status,
  size = 'md',
}: {
  status: ComplaintStatus;
  size?: 'sm' | 'md';
}) {
  const { t } = useI18n();
  return (
    <span
      className={
        'inline-flex shrink-0 items-center rounded-lg font-semibold ' +
        STYLES[status] +
        (size === 'sm' ? ' px-2.5 py-1.5 text-xs' : ' px-3 py-2 text-sm')
      }
    >
      {t('status.' + status)}
    </span>
  );
}
