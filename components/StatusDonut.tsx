'use client';

import { useI18n } from '@/lib/i18n';
import type { ComplaintStatus } from '@/lib/types';

/**
 * Status palette for chart marks. These are a step darker than the badge
 * colours so every arc clears 3:1 against the white card, and the neutral grey
 * for "closed" is deliberate — it reads as inactive rather than as a category.
 * Checked with the palette validator: lightness band, CVD separation and
 * normal-vision separation all pass.
 */
export const STATUS_MARK: Record<ComplaintStatus, string> = {
  pending: '#d97706',
  in_progress: '#2563eb',
  resolved: '#22a35f',
  closed: '#64748b',
};

const SIZE = 132;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;
/** 2px of surface between neighbouring arcs, as a fraction of the circle. */
const GAP = 2;

export default function StatusDonut({
  counts,
  total,
}: {
  counts: Record<ComplaintStatus, number>;
  total: number;
}) {
  const { t } = useI18n();
  const entries = (Object.keys(STATUS_MARK) as ComplaintStatus[])
    .map((status) => ({ status, value: counts[status] || 0 }))
    .filter((e) => e.value > 0);

  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} role="img" aria-label={t('admin.chartHeading')}>
          <g transform={'rotate(-90 ' + SIZE / 2 + ' ' + SIZE / 2 + ')'}>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth={STROKE}
            />
            {entries.map(({ status, value }) => {
              const length = total > 0 ? (value / total) * CIRC : 0;
              const dash = Math.max(length - (entries.length > 1 ? GAP : 0), 0.001);
              const circle = (
                <circle
                  key={status}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={STATUS_MARK[status]}
                  strokeWidth={STROKE}
                  strokeDasharray={dash + ' ' + (CIRC - dash)}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += length;
              return circle;
            })}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-2xl font-extrabold leading-none text-slate-900">{total}</p>
            <p className="mt-1 text-[10px] font-medium text-slate-400">{t('admin.statTotal')}</p>
          </div>
        </div>
      </div>

      {/* Identity is never colour alone: every slice is named and counted here. */}
      <ul className="min-w-0 flex-1 space-y-2">
        {(Object.keys(STATUS_MARK) as ComplaintStatus[]).map((status) => {
          const value = counts[status] || 0;
          const pct = total > 0 ? Math.round((value / total) * 100) : 0;
          return (
            <li key={status} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: STATUS_MARK[status] }}
              />
              <span className="min-w-0 flex-1 truncate text-slate-600">{t('status.' + status)}</span>
              <span className="shrink-0 font-semibold text-slate-900">{value}</span>
              <span className="w-10 shrink-0 text-right text-xs text-slate-400">({pct}%)</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
