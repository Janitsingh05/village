'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import VerificationFields, {
  emptyVerification,
  isVerificationComplete,
  type VerificationInput,
} from '@/components/VerificationFields';
import {
  subscribeToAdminRequests,
  decideAdminRequest,
  getRequestProof,
  type ProofKind,
} from '@/lib/admin-requests';
import { listVillages } from '@/lib/villages';
import { watchSession } from '@/lib/auth';
import { directorySearchUrl, VERIFICATION_STEPS } from '@/lib/lgd';
import { useI18n } from '@/lib/i18n';
import { shortDate } from '@/lib/format';
import type { AdminRequest, Village } from '@/lib/types';

const CHIP = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-brand-50 text-brand-700',
  rejected: 'bg-slate-100 text-slate-500',
} as const;

/**
 * Where an application to run a village is actually judged.
 *
 * The old version of this screen showed four fields, all of them typed by the
 * applicant, above an Approve button — so approving meant trusting a stranger's
 * self-description. Now the evidence they uploaded sits next to a link into the
 * government's own record, and no approval goes through without the reviewer
 * writing down what they checked.
 */
export default function AdminRequestsPage() {
  const { lang, t } = useI18n();
  const [rows, setRows] = useState<AdminRequest[] | null>(null);
  const [villages, setVillages] = useState<Record<string, Village>>({});
  const [uid, setUid] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => watchSession((s) => setUid(s?.uid || '')), []);

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

  // The village behind each request, for the directory link and its LGD code.
  useEffect(() => {
    let alive = true;
    listVillages()
      .then((list) => {
        if (!alive) return;
        setVillages(Object.fromEntries(list.map((v) => [v.id, v])));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const pending = useMemo(() => (rows || []).filter((r) => r.status === 'pending').length, [rows]);

  async function decide(request: AdminRequest, decision: 'approved' | 'rejected', v: VerificationInput) {
    setBusy(request.id);
    setError(null);
    try {
      await decideAdminRequest(request, decision, {
        by: uid,
        verifiedVia: v.verifiedVia,
        verifiedNote: v.verifiedNote,
        // A rejection grants nothing, so a term on it would be meaningless.
        termEndsAt: decision === 'approved' ? v.termEndsAt : null,
      });
      setOpenId(null);
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

              <ProofStrip request={r} />

              {r.status === 'pending' ? (
                openId === r.id ? (
                  <ReviewPanel
                    request={r}
                    village={villages[r.villageId]}
                    busy={busy === r.id}
                    onCancel={() => setOpenId(null)}
                    onDecide={(decision, v) => decide(r, decision, v)}
                  />
                ) : (
                  <button
                    onClick={() => setOpenId(r.id)}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-bold text-white transition active:scale-[0.99]"
                  >
                    <Icon name="shield" className="h-4 w-4" strokeWidth={2.2} />
                    {t('super.review')}
                  </button>
                )
              ) : (
                <DecisionRecord request={r} />
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/* ------------------------------- the evidence ------------------------------ */

function ProofStrip({ request }: { request: AdminRequest }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<ProofKind | null>(null);

  const items: { kind: ProofKind; thumb: string | null; label: string }[] = [
    { kind: 'id-proof', thumb: request.idProofUrl, label: t('register.idProof') },
    { kind: 'post-proof', thumb: request.postProofUrl, label: t('register.postProof') },
  ];

  // Requests filed before proof was required have no images. Say so plainly —
  // an empty space would read as "nothing to check here".
  if (!request.idProofUrl && !request.postProofUrl) {
    return (
      <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-900">
        <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0" />
        {t('super.noProof')}
      </p>
    );
  }

  return (
    <>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {items.map((it) => (
          <li key={it.kind}>
            {it.thumb ? (
              <button
                type="button"
                onClick={() => setOpen(it.kind)}
                className="w-full overflow-hidden rounded-xl border-2 border-slate-200 text-left transition active:scale-[0.98]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.thumb} alt={it.label} className="h-24 w-full object-cover" />
                <span className="block px-2 py-1.5 text-[11px] font-semibold text-slate-600">
                  {it.label}
                </span>
              </button>
            ) : (
              <p className="grid h-full place-items-center rounded-xl border-2 border-dashed border-slate-200 px-2 py-4 text-center text-[11px] text-slate-400">
                {it.label} · {t('common.none')}
              </p>
            )}
          </li>
        ))}
      </ul>

      {open && <ProofViewer requestId={request.id} kind={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** Full-size proof, fetched only when someone actually opens it. */
function ProofViewer({
  requestId,
  kind,
  onClose,
}: {
  requestId: string;
  kind: ProofKind;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [src, setSrc] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getRequestProof(requestId, kind)
      .then((d) => alive && setSrc(d))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [requestId, kind]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/80 p-4"
      onClick={onClose}
    >
      <div className="max-h-full w-full max-w-lg overflow-auto" onClick={(e) => e.stopPropagation()}>
        {src === undefined ? (
          <p className="text-center text-sm text-white">{t('common.loading')}</p>
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={t('super.proofFull')} className="w-full rounded-2xl bg-white" />
        ) : (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-600">
            {t('super.proofMissing')}
          </p>
        )}
        <button
          onClick={onClose}
          className="mx-auto mt-3 block rounded-full bg-white px-5 py-2 text-sm font-bold text-slate-800"
        >
          {t('nav.close')}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------- the review ------------------------------- */

function ReviewPanel({
  request,
  village,
  busy,
  onCancel,
  onDecide,
}: {
  request: AdminRequest;
  village: Village | undefined;
  busy: boolean;
  onCancel: () => void;
  onDecide: (decision: 'approved' | 'rejected', v: VerificationInput) => void;
}) {
  const { t } = useI18n();
  const [v, setV] = useState<VerificationInput>(emptyVerification);
  const ready = isVerificationComplete(v) && !busy;

  const directory = directorySearchUrl({
    villageName: village?.name || request.villageName,
    district: village?.district || '',
    state: village?.state || '',
    lgdCode: village?.lgdCode,
  });

  return (
    <div className="mt-3 rounded-2xl bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
        {t('super.checklist')}
      </p>
      <ul className="mt-2 space-y-1.5">
        {VERIFICATION_STEPS.map((key) => (
          <li key={key} className="flex items-start gap-2 text-[13px] leading-snug text-slate-600">
            <Icon name="checkCircle" className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
            {t(key)}
          </li>
        ))}
      </ul>

      <a
        href={directory}
        target="_blank"
        rel="noreferrer"
        className="mt-3 flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"
      >
        <Icon name="globe" className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 truncate">{t('super.openDirectory')}</span>
        <Icon name="arrowRight" className="h-4 w-4 shrink-0 text-slate-300" />
      </a>
      {village && !village.lgdCode && (
        <p className="mt-1.5 text-xs text-amber-700">{t('super.noLgd')}</p>
      )}

      <div className="mt-4">
        <VerificationFields value={v} onChange={setV} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => onDecide('rejected', v)}
          disabled={!ready}
          className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600 disabled:opacity-50"
        >
          {t('super.reject')}
        </button>
        <button
          onClick={() => onDecide('approved', v)}
          disabled={!ready}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          <Icon name="checkCircle" className="h-4 w-4" strokeWidth={2.4} />
          {t('super.approve')}
        </button>
      </div>

      {!isVerificationComplete(v) && (
        <p className="mt-2 text-center text-xs text-slate-500">{t('super.noteRequired')}</p>
      )}

      <button onClick={onCancel} className="mt-2 w-full py-1 text-xs font-semibold text-slate-400">
        {t('common.cancel')}
      </button>
    </div>
  );
}

/** What was decided, by whom, and on what basis. */
function DecisionRecord({ request }: { request: AdminRequest }) {
  const { lang, t } = useI18n();
  if (!request.verifiedNote && !request.decidedAt) return null;

  return (
    <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-[13px] leading-snug text-slate-600">
      {request.verifiedVia && (
        <p className="font-semibold text-slate-700">{t('verify.method_' + request.verifiedVia)}</p>
      )}
      {request.verifiedNote && <p className="mt-0.5">{request.verifiedNote}</p>}
      <p className="mt-1.5 text-xs text-slate-400">
        {request.decidedAt ? shortDate(request.decidedAt, lang) : ''}
        {request.termEndsAt
          ? ' · ' + t('verify.termUntil', { date: shortDate(request.termEndsAt, lang) })
          : ''}
      </p>
    </div>
  );
}
