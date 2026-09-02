'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import VerificationFields, {
  emptyVerification,
  isVerificationComplete,
  type VerificationInput,
} from '@/components/VerificationFields';
import {
  getVillage,
  listVillageAdmins,
  addVillageAdmin,
  revokeVillageAdmin,
  renewVillageAdmin,
  setVillageLgdCode,
  termState,
  unrecordedPhones,
  type TermState,
} from '@/lib/villages';
import { watchSession } from '@/lib/auth';
import { directorySearchUrl } from '@/lib/lgd';
import { useRouteId } from '@/lib/route-id';
import { useI18n } from '@/lib/i18n';
import { shortDate } from '@/lib/format';
import type { Village, VillageAdmin } from '@/lib/types';

const TERM_CHIP: Record<TermState, string> = {
  active: 'bg-brand-50 text-brand-700',
  expiring: 'bg-amber-50 text-amber-700',
  expired: 'bg-red-50 text-red-700',
  'open-ended': 'bg-slate-100 text-slate-500',
};

/**
 * Who runs this village, and on whose word.
 *
 * Granting access was already possible through the request queue; this is the
 * screen that makes it reversible. Every admin shows the evidence behind them
 * and how long it is good for, and both levers a super admin needs — renew and
 * revoke — sit next to that evidence rather than somewhere else entirely.
 */
export default function SuperVillagePage() {
  const { lang, t } = useI18n();
  const id = useRouteId('/super-admin/village');
  const [village, setVillage] = useState<Village | null | undefined>(undefined);
  const [admins, setAdmins] = useState<VillageAdmin[]>([]);
  const [uid, setUid] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => watchSession((s) => setUid(s?.uid || '')), []);

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const [v, list] = await Promise.all([getVillage(id), listVillageAdmins(id)]);
      setVillage(v);
      setAdmins(list);
    } catch {
      setVillage(null);
      setAdmins([]);
    }
  }, [id]);

  useEffect(() => {
    if (id === undefined) return;
    if (id === null) {
      setVillage(null);
      return;
    }
    void reload();
  }, [id, reload]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch {
      setError(t('super.decideFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (village === undefined) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-4">
        <div className="h-32 animate-pulse rounded-3xl bg-slate-100" />
      </main>
    );
  }

  if (!village) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="rounded-3xl bg-white p-8 text-center text-sm text-slate-500 shadow-card">
          {t('super.villageMissing')}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-4">
      <Link
        href="/super-admin/villages"
        className="inline-block text-sm font-semibold text-slate-500 hover:text-slate-800"
      >
        ← {t('super.villagesTitle')}
      </Link>

      <header className="rounded-3xl bg-white p-4 shadow-card">
        <h1 className="text-lg font-bold text-slate-900">{village.name}</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {[village.district, village.state].filter(Boolean).join(', ')}
        </p>
        <p className="mt-1 font-mono text-[11px] text-slate-400">{village.id}</p>
      </header>

      {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <LgdCard village={village} busy={busy} onSave={(code) => run(() => setVillageLgdCode(village.id, code))} />

      <section>
        <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {t('super.adminsHeading')}
        </h2>

        {admins.length === 0 ? (
          <p className="rounded-3xl bg-white p-6 text-center text-sm text-slate-500 shadow-card">
            {t('super.noAdminRecords')}
          </p>
        ) : (
          <ul className="space-y-3">
            {admins.map((a) => (
              <AdminCard
                key={a.phone}
                admin={a}
                village={village}
                busy={busy}
                uid={uid}
                onRevoke={() => run(() => revokeVillageAdmin(village.id, a.phone))}
                onRenew={(v) =>
                  run(() =>
                    renewVillageAdmin(village.id, a.phone, {
                      termEndsAt: v.termEndsAt,
                      verifiedVia: v.verifiedVia,
                      verifiedNote: v.verifiedNote,
                      verifiedBy: uid,
                    })
                  )
                }
              />
            ))}
          </ul>
        )}

        {/* Numbers on adminPhones with no record behind them: villages that
            predate these records, or an approval made before it was required.
            Surfaced rather than hidden — an admin nobody can account for is
            exactly what this screen is for. */}
        <UnrecordedAdmins
          phones={unrecordedPhones(village, admins)}
          busy={busy}
          onRevoke={(p) => run(() => revokeVillageAdmin(village.id, p))}
        />
      </section>

      <AddAdminCard
        village={village}
        uid={uid}
        busy={busy}
        onAdd={(entry) => run(() => addVillageAdmin(village.id, entry))}
      />
    </main>
  );
}

/* ---------------------------------- LGD ---------------------------------- */

function LgdCard({
  village,
  busy,
  onSave,
}: {
  village: Village;
  busy: boolean;
  onSave: (code: string) => void;
}) {
  const { t } = useI18n();
  const [code, setCode] = useState(village.lgdCode);

  useEffect(() => setCode(village.lgdCode), [village.lgdCode]);

  return (
    <section className="rounded-3xl bg-white p-4 shadow-card">
      <label className="label" htmlFor="lgd">
        {t('super.lgdCode')}
      </label>
      <p className="-mt-1 mb-2 text-xs text-slate-500">{t('super.lgdCodeSub')}</p>
      <div className="flex gap-2">
        <input
          id="lgd"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="123456"
          className="field flex-1"
        />
        <button
          type="button"
          disabled={busy || code === village.lgdCode}
          onClick={() => onSave(code)}
          className="shrink-0 rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-40"
        >
          {t('common.save')}
        </button>
      </div>
      <a
        href={directorySearchUrl({
          villageName: village.name,
          district: village.district,
          state: village.state,
          lgdCode: village.lgdCode,
        })}
        target="_blank"
        rel="noreferrer"
        className="mt-3 flex items-center gap-2 text-sm font-semibold text-brand-700"
      >
        <Icon name="globe" className="h-4 w-4 shrink-0" />
        {t('super.openDirectory')}
      </a>
    </section>
  );
}

/* --------------------------------- admins --------------------------------- */

function AdminCard({
  admin,
  village,
  busy,
  uid,
  onRevoke,
  onRenew,
}: {
  admin: VillageAdmin;
  village: Village;
  busy: boolean;
  uid: string;
  onRevoke: () => void;
  onRenew: (v: VerificationInput) => void;
}) {
  const { lang, t } = useI18n();
  const [renewing, setRenewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [v, setV] = useState<VerificationInput>(emptyVerification);
  const state = termState(admin.termEndsAt);
  const isPrimary = admin.phone === village.adminPhone;

  return (
    <li className="rounded-3xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-900">{admin.name || t('common.anon')}</p>
          <p className="truncate text-sm text-slate-600">
            {admin.role || t('common.none')}
            {isPrimary ? ' · ' + t('super.primaryAdmin') : ''}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500">{admin.phone}</p>
        </div>
        <span className={'shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold ' + TERM_CHIP[state]}>
          {t('verify.state_' + state)}
        </span>
      </div>

      <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-[13px] leading-snug text-slate-600">
        <p className="font-semibold text-slate-700">{t('verify.method_' + admin.verifiedVia)}</p>
        {admin.verifiedNote && <p className="mt-0.5">{admin.verifiedNote}</p>}
        <p className="mt-1.5 text-xs text-slate-400">
          {t('verify.verifiedOn', { date: shortDate(admin.verifiedAt, lang) })}
          {admin.termEndsAt
            ? ' · ' + t('verify.termUntil', { date: shortDate(admin.termEndsAt, lang) })
            : ' · ' + t('verify.termNone')}
        </p>
      </div>

      {renewing ? (
        <div className="mt-3 rounded-2xl bg-slate-50 p-3">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
            {t('super.renewHeading')}
          </p>
          <VerificationFields value={v} onChange={setV} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setRenewing(false)}
              className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600"
            >
              {t('common.cancel')}
            </button>
            <button
              disabled={!isVerificationComplete(v) || busy || !uid}
              onClick={() => {
                onRenew(v);
                setRenewing(false);
              }}
              className="rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {t('super.renew')}
            </button>
          </div>
        </div>
      ) : confirming ? (
        <div className="mt-3 rounded-2xl bg-red-50 p-3">
          <p className="text-[13px] leading-snug text-red-800">
            {t('super.revokeConfirm', { name: admin.name || admin.phone })}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setConfirming(false)}
              className="rounded-xl border-2 border-red-200 bg-white px-3 py-2.5 text-sm font-bold text-red-700"
            >
              {t('common.cancel')}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                onRevoke();
                setConfirming(false);
              }}
              className="rounded-xl bg-red-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {t('super.revoke')}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setConfirming(true)}
            className="rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-600"
          >
            {t('super.revoke')}
          </button>
          <button
            onClick={() => {
              setV(emptyVerification());
              setRenewing(true);
            }}
            className="rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-bold text-white"
          >
            {t('super.renew')}
          </button>
        </div>
      )}
    </li>
  );
}

function UnrecordedAdmins({
  phones,
  busy,
  onRevoke,
}: {
  phones: string[];
  busy: boolean;
  onRevoke: (phone: string) => void;
}) {
  const { t } = useI18n();

  if (phones.length === 0) return null;

  return (
    <div className="mt-3 rounded-3xl bg-amber-50 p-4">
      <p className="text-sm font-bold text-amber-900">{t('super.unrecorded')}</p>
      <p className="mt-1 text-[13px] leading-snug text-amber-800">{t('super.unrecordedSub')}</p>
      <ul className="mt-3 space-y-2">
        {phones.map((p) => (
          <li key={p} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5">
            <span className="min-w-0 flex-1 truncate font-mono text-sm text-slate-700">{p}</span>
            <button
              disabled={busy}
              onClick={() => onRevoke(p)}
              className="shrink-0 rounded-lg border-2 border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-50"
            >
              {t('super.revoke')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------ the invite path ----------------------------- */

/**
 * Granting access without a request at all.
 *
 * This is the safest path in the app: the super admin already knows who they
 * are handing the village to, because they arranged it offline. Nothing is
 * self-declared, so there is nothing to spoof — the only thing that can go
 * wrong is typing the number wrong.
 */
function AddAdminCard({
  village,
  uid,
  busy,
  onAdd,
}: {
  village: Village;
  uid: string;
  busy: boolean;
  onAdd: (entry: {
    phone: string;
    name: string;
    role: string;
    verifiedVia: VerificationInput['verifiedVia'];
    verifiedNote: string;
    verifiedBy: string;
    termEndsAt: number | null;
  }) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [v, setV] = useState<VerificationInput>(() => ({
    ...emptyVerification(),
    verifiedVia: 'offline',
  }));

  const ready =
    phone.length === 10 && name.trim().length >= 2 && isVerificationComplete(v) && !busy && !!uid;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-300 bg-white px-4 py-4 text-sm font-bold text-slate-600 transition active:scale-[0.99]"
      >
        <Icon name="plus" className="h-4 w-4" strokeWidth={2.4} />
        {t('super.addAdmin')}
      </button>
    );
  }

  return (
    <section className="rounded-3xl bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-slate-900">{t('super.addAdmin')}</h2>
      <p className="mt-1 text-xs leading-snug text-slate-500">{t('super.addAdminSub')}</p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="label" htmlFor="add-phone">
            {t('register.phone')} <span className="text-red-500">*</span>
          </label>
          <input
            id="add-phone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="98XXXXXXXX"
            className="field"
          />
        </div>

        <div>
          <label className="label" htmlFor="add-name">
            {t('register.name')} <span className="text-red-500">*</span>
          </label>
          <input
            id="add-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('register.namePlaceholder')}
            className="field"
          />
        </div>

        <div>
          <label className="label" htmlFor="add-role">
            {t('register.role')}
          </label>
          <input
            id="add-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={t('register.rolePlaceholder')}
            className="field"
          />
        </div>

        <VerificationFields value={v} onChange={setV} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => setOpen(false)}
          className="rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-600"
        >
          {t('common.cancel')}
        </button>
        <button
          disabled={!ready}
          onClick={() => {
            onAdd({
              phone,
              name,
              role,
              verifiedVia: v.verifiedVia,
              verifiedNote: v.verifiedNote,
              verifiedBy: uid,
              termEndsAt: v.termEndsAt,
            });
            setOpen(false);
            setPhone('');
            setName('');
            setRole('');
          }}
          className="rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {t('super.addAdminSubmit')}
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-400">{village.name}</p>
    </section>
  );
}
