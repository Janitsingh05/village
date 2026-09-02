'use client';

import Icon from './Icon';
import { useI18n } from '@/lib/i18n';
import type { VerificationMethod } from '@/lib/types';

export interface VerificationInput {
  verifiedVia: VerificationMethod;
  verifiedNote: string;
  termEndsAt: number | null;
}

const METHODS: { id: VerificationMethod; icon: 'doc' | 'globe' | 'user' | 'shield' }[] = [
  { id: 'document', icon: 'doc' },
  { id: 'directory', icon: 'globe' },
  { id: 'phone', icon: 'user' },
  { id: 'offline', icon: 'shield' },
];

/** A Sarpanch's term runs five years; the others are for staff and stand-ins. */
const PRESET_YEARS = [5, 1] as const;

export const DEFAULT_TERM_YEARS = 5;

export function yearsFromNow(years: number): number {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d.getTime();
}

export function emptyVerification(): VerificationInput {
  return {
    verifiedVia: 'document',
    verifiedNote: '',
    termEndsAt: yearsFromNow(DEFAULT_TERM_YEARS),
  };
}

function toDateInput(ms: number | null): string {
  if (ms == null) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/**
 * What a super admin has to put on the record before granting anyone access.
 *
 * The note is mandatory and free text on purpose. A checklist of tickboxes
 * measures whether someone clicked, not whether they looked; a sentence naming
 * what they actually saw is the thing worth reading a year later when somebody
 * asks why this person can close complaints.
 */
export default function VerificationFields({
  value,
  onChange,
}: {
  value: VerificationInput;
  onChange: (next: VerificationInput) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div>
        <label className="label">{t('verify.method')}</label>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map((m) => {
            const active = value.verifiedVia === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onChange({ ...value, verifiedVia: m.id })}
                aria-pressed={active}
                className={
                  'flex items-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-left text-sm font-semibold transition ' +
                  (active
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white text-slate-600')
                }
              >
                <Icon name={m.icon} className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">{t('verify.method_' + m.id)}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-slate-500">{t('verify.method_' + value.verifiedVia + 'Sub')}</p>
      </div>

      <div>
        <label className="label" htmlFor="verify-note">
          {t('verify.note')} <span className="text-red-500">*</span>
        </label>
        <textarea
          id="verify-note"
          rows={3}
          value={value.verifiedNote}
          onChange={(e) => onChange({ ...value, verifiedNote: e.target.value.slice(0, 300) })}
          placeholder={t('verify.notePlaceholder')}
          className="field resize-none"
        />
        <p className="mt-1.5 text-xs text-slate-500">{t('verify.noteHelp')}</p>
      </div>

      <div>
        <label className="label" htmlFor="verify-term">
          {t('verify.term')}
        </label>
        <div className="mb-2 flex flex-wrap gap-2">
          {PRESET_YEARS.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => onChange({ ...value, termEndsAt: yearsFromNow(y) })}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition active:scale-95"
            >
              {t('verify.termYears', { n: y })}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...value, termEndsAt: null })}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition active:scale-95"
          >
            {t('verify.termNone')}
          </button>
        </div>
        <input
          id="verify-term"
          type="date"
          value={toDateInput(value.termEndsAt)}
          onChange={(e) => {
            const v = e.target.value;
            onChange({ ...value, termEndsAt: v ? new Date(v + 'T23:59:59').getTime() : null });
          }}
          className="field"
        />
        <p className="mt-1.5 text-xs text-slate-500">
          {value.termEndsAt == null ? t('verify.termNoneWarn') : t('verify.termHelp')}
        </p>
      </div>
    </div>
  );
}

/** A note that says nothing is the same as no note. */
export function isVerificationComplete(v: VerificationInput): boolean {
  return v.verifiedNote.trim().length >= 10;
}
