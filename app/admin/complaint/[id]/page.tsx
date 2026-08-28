'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CategoryIcon from '@/components/CategoryIcon';
import PhotoUpload from '@/components/PhotoUpload';
import Icon from '@/components/Icon';
import { getComplaint, updateComplaintStatus } from '@/lib/complaints';
import { categoryOf, STATUS_ORDER, wardLabel } from '@/lib/config';
import { useI18n } from '@/lib/i18n';
import { dateTime, shortDate } from '@/lib/format';
import type { Complaint, ComplaintStatus } from '@/lib/types';

const NOTE_MAX = 200;

export default function AdminComplaintPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const { lang, t } = useI18n();

  const [complaint, setComplaint] = useState<Complaint | null | undefined>(undefined);
  const [status, setStatus] = useState<ComplaintStatus>('pending');
  const [note, setNote] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    getComplaint(id)
      .then((c) => {
        if (!alive) return;
        setComplaint(c);
        if (c) setStatus(c.status);
      })
      .catch(() => alive && setComplaint(null));
    return () => {
      alive = false;
    };
  }, [id]);

  async function save() {
    if (!complaint) return;
    setSaving(true);
    setError(null);
    try {
      await updateComplaintStatus(complaint.id, status, note.trim(), proof);
      setComplaint(await getComplaint(complaint.id));
      setNote('');
      setProof(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  if (complaint === undefined) {
    return <p className="mx-auto max-w-3xl p-4 text-sm text-slate-500">{t('common.loading')}</p>;
  }

  if (complaint === null) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <div className="card text-center">
          <p className="font-semibold text-slate-700">{t('admin.notFound')}</p>
          <Link href="/admin/complaints" className="btn-secondary mt-4">
            {t('admin.backToDashboard')}
          </Link>
        </div>
      </div>
    );
  }

  const cat = categoryOf(complaint.category);
  const dirty = status !== complaint.status || note.trim() !== '' || proof !== null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-4">
      <button
        onClick={() => router.push('/admin/complaints')}
        className="mb-3 flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800"
      >
        <Icon name="back" className="h-4 w-4" />
        {t('admin.updateHeading')}
      </button>

      <div className="flex items-start gap-3 rounded-3xl bg-white p-4 shadow-card">
        {complaint.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={complaint.photoUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded-2xl object-cover"
          />
        ) : (
          <CategoryIcon id={cat.id} />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-snug text-slate-900">
            {complaint.description}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-400">{complaint.ref}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Icon name="pin" className="h-3.5 w-3.5" />
              {wardLabel(complaint.location.ward, lang) || t('common.none')}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="calendar" className="h-3.5 w-3.5" />
              {dateTime(complaint.createdAt, lang)}
            </span>
          </p>
          <a
            href={'tel:' + complaint.reportedBy.phone}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700"
          >
            <Icon name="user" className="h-3.5 w-3.5" />
            {complaint.reportedBy.name || t('common.anon')} · {complaint.reportedBy.phone}
          </a>
        </div>
      </div>

      <section className="mt-4 rounded-3xl bg-white p-4 shadow-card">
        <p className="label">{t('admin.statusPick')}</p>
        <div className="grid grid-cols-2 gap-2">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              aria-pressed={status === s}
              className={
                'flex items-center gap-2 rounded-2xl border-2 px-3 py-3 text-sm font-semibold transition ' +
                (status === s
                  ? 'border-brand-600 bg-brand-50 text-brand-800'
                  : 'border-slate-200 bg-white text-slate-600')
              }
            >
              <span
                className={
                  'grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ' +
                  (status === s ? 'border-brand-600' : 'border-slate-300')
                }
              >
                {status === s && <span className="h-2 w-2 rounded-full bg-brand-600" />}
              </span>
              {t('status.' + s)}
            </button>
          ))}
        </div>

        <div className="mt-5">
          <label className="label" htmlFor="note">
            {t('admin.noteHeading')}
          </label>
          <textarea
            id="note"
            rows={3}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('admin.notePlaceholder')}
            className="field resize-none"
          />
          <p className="mt-1 text-right text-xs text-slate-400">
            {note.length}/{NOTE_MAX}
          </p>
        </div>

        <div className="mt-4">
          <p className="label">{t('admin.proofHeading')}</p>
          <PhotoUpload
            onChange={setProof}
            titleKey="photo.proofHint"
            subKey="report.photoBoxSub"
          />
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <button onClick={save} disabled={!dirty || saving} className="btn-primary mt-5">
          {saving ? t('admin.saving') : saved ? t('admin.saved') : t('admin.saveUpdate')}
        </button>
      </section>

      <section className="mt-4 rounded-3xl bg-white p-4 shadow-card">
        <p className="mb-3 text-sm font-bold text-slate-800">{t('admin.actionsSoFar')}</p>
        <ol className="space-y-3">
          {complaint.timeline.map((e, i) => (
            <li key={i} className="text-sm">
              <span className="font-semibold text-slate-900">{t('status.' + e.status)}</span>
              <span className="ml-2 text-xs text-slate-500">{shortDate(e.at, lang)}</span>
              {e.note && <p className="mt-1 text-slate-600">{e.note}</p>}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
