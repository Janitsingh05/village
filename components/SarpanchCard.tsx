'use client';

import { useState } from 'react';
import Icon from './Icon';
import { useI18n } from '@/lib/i18n';
import { useVillage } from '@/lib/village-context';
import { termEndFor, termState } from '@/lib/villages';
import { reportAdmin } from '@/lib/admin-reports';
import { shortDate } from '@/lib/format';

/**
 * Who the villagers should approach.
 *
 * A complaint feed is impersonal; putting a face and a name on it tells a
 * resident there is a specific person on the other end. Shown only once the
 * admin has actually filled their profile in — an empty card would say less
 * than nothing.
 *
 * It also carries the two things that make the name accountable: when a super
 * admin last checked this person really holds the post, and a way for anyone
 * who knows better to say so. A village of two thousand people who all know
 * each other is the strongest verification this app has; it just needs somewhere
 * to land.
 */
export default function SarpanchCard() {
  const { lang, t } = useI18n();
  const { village, id, name } = useVillage();
  const [reporting, setReporting] = useState(false);

  if (!village?.adminName) return null;

  const phone = village.adminPhone;
  // Both come off the public village document: a date, and a date. The note
  // behind them is a super admin's and stays where villagers cannot read it.
  const verifiedAt = village.adminVerifiedAt;
  const stale = termState(termEndFor(village, village.adminPhone)) === 'expired';

  return (
    <section className="rounded-3xl bg-white p-4 shadow-card">
      <div className="flex items-center gap-3">
        {village.adminPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={village.adminPhotoUrl}
            alt={village.adminName}
            className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-brand-100"
          />
        ) : (
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
            <Icon name="user" className="h-8 w-8" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
            {t('village.yourSarpanch')}
          </p>
          <p className="truncate text-base font-bold text-slate-900">{village.adminName}</p>
          {village.adminRole && (
            <p className="truncate text-sm text-slate-500">{village.adminRole}</p>
          )}
        </div>

        {phone && (
          <a
            href={'tel:' + phone}
            aria-label={t('village.contact')}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-600 text-white transition active:scale-95"
          >
            <Icon name="user" className="h-5 w-5" />
          </a>
        )}
      </div>

      {/* The badge states a date, not a fact. "Verified" with nothing behind it
          is the kind of reassurance that stops people looking. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-100 pt-3">
        {verifiedAt ? (
          <span
            className={
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ' +
              (stale ? 'bg-amber-50 text-amber-700' : 'bg-brand-50 text-brand-700')
            }
          >
            <Icon name="shield" className="h-3.5 w-3.5" strokeWidth={2.2} />
            {stale
              ? t('village.termEnded')
              : t('village.verifiedOn', { date: shortDate(verifiedAt, lang) })}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
            <Icon name="clock" className="h-3.5 w-3.5" />
            {t('village.notVerified')}
          </span>
        )}

        <button
          type="button"
          onClick={() => setReporting(true)}
          className="text-[11px] font-semibold text-slate-400 underline underline-offset-2"
        >
          {t('village.reportWrong')}
        </button>
      </div>

      {reporting && (
        <ReportDialog
          villageId={id}
          villageName={name(lang)}
          aboutName={village.adminName}
          onClose={() => setReporting(false)}
        />
      )}
    </section>
  );
}

function ReportDialog({
  villageId,
  villageName,
  aboutName,
  onClose,
}: {
  villageId: string;
  villageName: string;
  aboutName: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);

  async function submit() {
    setBusy(true);
    setError(false);
    try {
      await reportAdmin({ villageId, villageName, aboutName, reason });
      setDone(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-end bg-slate-900/60 sm:place-items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <>
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600">
              <Icon name="checkCircle" className="h-6 w-6" strokeWidth={2.2} />
            </span>
            <p className="mt-3 text-center font-bold text-slate-900">{t('village.reportSent')}</p>
            <p className="mt-1 text-center text-sm text-slate-500">{t('village.reportSentSub')}</p>
            <button onClick={onClose} className="btn-secondary mt-5">
              {t('nav.close')}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-slate-900">{t('village.reportTitle')}</h2>
            <p className="mt-1 text-sm leading-snug text-slate-500">
              {t('village.reportSub', { name: aboutName })}
            </p>

            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              placeholder={t('village.reportPlaceholder')}
              className="field mt-4 resize-none"
            />
            <p className="mt-1.5 text-xs text-slate-500">{t('village.reportAnon')}</p>

            {error && (
              <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {t('village.reportFailed')}
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={onClose} className="btn-secondary">
                {t('common.cancel')}
              </button>
              <button
                onClick={submit}
                disabled={reason.trim().length < 5 || busy}
                className="rounded-2xl bg-brand-600 px-4 py-3 text-base font-bold text-white disabled:opacity-50"
              >
                {busy ? t('register.sending') : t('village.reportSubmit')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
