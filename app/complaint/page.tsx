'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import CategoryIcon from '@/components/CategoryIcon';
import StatusBadge, { STATUS_DOT } from '@/components/StatusBadge';
import Icon from '@/components/Icon';
import { getComplaint, getComplaintPhotos, getFullPhoto, submitFeedback } from '@/lib/complaints';
import { categoryOf, STATUS_TIMELINE, wardLabel } from '@/lib/config';
import { useI18n } from '@/lib/i18n';
import { complaintShareUrl, useRouteId } from '@/lib/route-id';
import { dateTime, maskPhone } from '@/lib/format';
import type { Complaint } from '@/lib/types';

export default function ComplaintDetailPage() {
  const id = useRouteId('/complaint');
  const { lang, t } = useI18n();

  const [complaint, setComplaint] = useState<Complaint | null | undefined>(undefined);
  const [justCreated, setJustCreated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // The complaint carries only a thumbnail so the feed stays light; the full
  // image is a separate document, fetched once this page is actually open.
  const [photos, setPhotos] = useState<string[]>([]);
  const [fullProof, setFullProof] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setJustCreated(new URLSearchParams(window.location.search).get('new') === '1');
  }, []);

  useEffect(() => {
    if (id === undefined) return;
    if (!id) {
      setComplaint(null);
      return;
    }
    let alive = true;
    getComplaint(id)
      .then((c) => alive && setComplaint(c))
      .catch(() => alive && setComplaint(null));
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !complaint) return;
    let alive = true;
    if (complaint.photoCount > 0) {
      getComplaintPhotos(id, complaint.photoCount)
        .then((list) => alive && setPhotos(list))
        .catch(() => {
          /* the thumbnail stays on screen */
        });
    }
    if (complaint.resolutionPhotoUrl) {
      getFullPhoto(id, 'proof')
        .then((d) => alive && setFullProof(d))
        .catch(() => {
          /* the thumbnail stays on screen */
        });
    }
    return () => {
      alive = false;
    };
  }, [id, complaint]);

  async function share() {
    const url = complaintShareUrl(window.location.origin, id || '');
    if (navigator.share) {
      try {
        await navigator.share({ title: 'GaonConnect', url });
        return;
      } catch {
        /* user dismissed the sheet */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      flash(t('detail.shareCopied'));
    } catch {
      /* clipboard blocked — nothing useful to say */
    }
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function sendFeedback(verdict: 'still_open' | 'confirmed') {
    if (!complaint || sending) return;
    setSending(true);
    try {
      await submitFeedback(complaint.id, verdict);
      setComplaint({ ...complaint, feedback: { verdict, at: Date.now() } });
      flash(t('detail.feedbackThanks'));
    } finally {
      setSending(false);
    }
  }

  if (complaint === undefined) {
    return (
      <div className="min-h-dvh bg-slate-50">
        <AppHeader back="/" title={t('common.loading')} />
        <div className="space-y-3 p-4">
          <div className="h-56 animate-pulse rounded-3xl bg-slate-200/70" />
          <div className="h-24 animate-pulse rounded-3xl bg-slate-200/70" />
        </div>
      </div>
    );
  }

  if (complaint === null) {
    return (
      <div className="min-h-dvh bg-slate-50">
        <AppHeader back="/" title={t('detail.notFound')} />
        <div className="card m-4 text-center">
          <p className="font-semibold text-slate-700">{t('detail.notFound')}</p>
          <Link href="/" className="btn-secondary mt-4">
            {t('detail.goHome')}
          </Link>
        </div>
      </div>
    );
  }

  const cat = categoryOf(complaint.category);
  const catName = t('category.' + cat.id);
  const canGiveFeedback = complaint.status === 'resolved' && !complaint.feedback;

  return (
    <div className="min-h-dvh bg-slate-50 pb-24">
      <AppHeader
        back="/"
        title={t('detail.title')}
        action={
          <button
            type="button"
            onClick={share}
            aria-label={t('common.share')}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-700 hover:bg-slate-100"
          >
            <Icon name="share" className="h-5 w-5" />
          </button>
        }
      />

      <main className="mx-auto max-w-2xl space-y-4 px-4">
        <p className="text-xs font-medium text-slate-400">
          {t('detail.refLabel')}: <span className="font-mono">{complaint.ref}</span>
        </p>

        {justCreated && (
          <div className="rounded-2xl bg-brand-50 p-4 text-center">
            <p className="font-bold text-brand-800">{t('detail.successTitle')}</p>
            <p className="mt-0.5 text-sm text-brand-700">{t('detail.successBody')}</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {complaint.photoUrl ? (
            // One photo fills the slot; several become a swipeable strip, so a
            // villager can show the problem from more than one angle.
            <div
              className={
                photos.length > 1
                  ? 'flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-2xl'
                  : ''
              }
            >
              {(photos.length ? photos : [complaint.photoUrl]).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt={catName + ' ' + (i + 1)}
                  className={
                    'h-48 rounded-2xl bg-slate-200 object-cover ' +
                    (photos.length > 1 ? 'w-4/5 shrink-0 snap-center' : 'w-full')
                  }
                />
              ))}
            </div>
          ) : (
            <div className="grid h-48 w-full place-items-center rounded-2xl bg-white shadow-card">
              <CategoryIcon id={cat.id} size="lg" />
            </div>
          )}

          <div className="rounded-2xl bg-white p-4 shadow-card">
            <div className="mb-3">
              <StatusBadge status={complaint.status} />
            </div>
            <Meta icon="calendar" label={t('detail.dateLabel')} value={dateTime(complaint.createdAt, lang)} />
            <Meta
              icon="pin"
              label={t('detail.location')}
              value={wardLabel(complaint.location.ward, lang) || t('common.none')}
            />
            <Meta icon="doc" label={t('detail.categoryLabel')} value={catName} />
            {complaint.location.address && (
              <Meta
                icon="pin"
                label={t('detail.addressLabel')}
                value={complaint.location.address}
              />
            )}
            {complaint.location.lat != null && (
              <a
                className="mt-2 inline-block text-sm font-semibold text-brand-700 underline"
                target="_blank"
                rel="noreferrer"
                href={
                  'https://www.google.com/maps?q=' +
                  complaint.location.lat +
                  ',' +
                  complaint.location.lng
                }
              >
                {t('detail.gpsLink')}
              </a>
            )}
          </div>
        </div>

        <section>
          <h2 className="mb-2 text-base font-bold text-slate-900">{t('detail.descHeading')}</h2>
          <p className="whitespace-pre-wrap rounded-2xl bg-white p-4 text-[15px] leading-relaxed text-slate-700 shadow-card">
            {complaint.description}
          </p>
        </section>

        <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
            <Icon name="user" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">{t('detail.reporterCard')}</p>
            <p className="truncate font-semibold text-slate-900">
              {complaint.reportedBy.name || t('common.anon')}
            </p>
            <p className="font-mono text-xs text-slate-500">
              {maskPhone(complaint.reportedBy.phone)}
            </p>
          </div>
        </div>

        <section>
          <h2 className="mb-3 text-base font-bold text-slate-900">{t('detail.statusUpdates')}</h2>
          <div className="rounded-2xl bg-white p-4 shadow-card">
            <Timeline complaint={complaint} />
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-base font-bold text-slate-900">{t('detail.proofHeading')}</h2>
          {complaint.resolutionPhotoUrl ? (
            <div className="overflow-hidden rounded-2xl bg-white shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fullProof || complaint.resolutionPhotoUrl}
                alt={t('detail.proofHeading')}
                className="w-full object-cover"
              />
              {complaint.resolutionNote && (
                <p className="p-4 text-sm text-slate-700">{complaint.resolutionNote}</p>
              )}
            </div>
          ) : (
            <p className="rounded-2xl bg-white p-4 text-sm text-slate-400 shadow-card">
              {t('common.notAvailable')}
            </p>
          )}
        </section>

        {canGiveFeedback && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => sendFeedback('still_open')}
              disabled={sending}
              className="rounded-2xl border-2 border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 disabled:opacity-60"
            >
              {t('detail.stillOpen')}
            </button>
            <button
              onClick={() => sendFeedback('confirmed')}
              disabled={sending}
              className="rounded-2xl bg-brand-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {t('detail.confirmResolved')}
            </button>
          </div>
        )}

        {complaint.feedback && (
          <p className="rounded-2xl bg-brand-50 p-3 text-center text-sm font-medium text-brand-800">
            {t('detail.feedbackThanks')}
          </p>
        )}
      </main>

      {toast && (
        <p className="fixed inset-x-0 bottom-24 z-40 mx-auto w-fit rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </p>
      )}

      <BottomNav />
    </div>
  );
}

function Meta({
  icon,
  label,
  value,
}: {
  icon: 'calendar' | 'pin' | 'doc';
  label: string;
  value: string;
}) {
  return (
    <div className="mt-2 flex items-start gap-2 text-sm">
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <span className="min-w-0">
        <span className="block text-[11px] leading-none text-slate-400">{label}</span>
        <span className="block font-medium text-slate-800">{value}</span>
      </span>
    </div>
  );
}

function Timeline({ complaint }: { complaint: Complaint }) {
  const { lang, t } = useI18n();
  const reached = new Map(complaint.timeline.map((e) => [e.status, e]));
  const currentIndex = STATUS_TIMELINE.indexOf(complaint.status);

  return (
    <ol>
      {STATUS_TIMELINE.map((status, i) => {
        const event = reached.get(status);
        // An admin can skip a step, so anything at or before the current
        // status counts as done rather than leaving a gap above a green tick.
        const done = Boolean(event) || (currentIndex >= 0 && currentIndex >= i);
        const isLast = i === STATUS_TIMELINE.length - 1;
        return (
          <li key={status} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={
                  'mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ' +
                  (done ? STATUS_DOT[status] + ' ring-white' : 'bg-slate-200 ring-white')
                }
              />
              {!isLast && (
                <span className={'w-0.5 flex-1 ' + (done ? 'bg-brand-200' : 'bg-slate-100')} />
              )}
            </div>
            <div className={isLast ? 'pb-0' : 'pb-5'}>
              <p className={'text-sm font-bold ' + (done ? 'text-slate-900' : 'text-slate-300')}>
                {t('status.' + status)}
              </p>
              {event ? (
                <>
                  <p className="text-xs text-slate-400">{dateTime(event.at, lang)}</p>
                  {event.note && (
                    <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {event.note}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-300">—</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
