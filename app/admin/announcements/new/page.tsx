'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import PhotoUpload from '@/components/PhotoUpload';
import Icon from '@/components/Icon';
import { createAnnouncement } from '@/lib/announcements';
import { useI18n } from '@/lib/i18n';
import type { AnnouncementKind } from '@/lib/types';

const TITLE_MAX = 100;
const BODY_MAX = 500;

export default function NewAnnouncementPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [kind, setKind] = useState<AnnouncementKind>('general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPost = title.trim().length >= 3 && body.trim().length >= 3 && !busy;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canPost) return;
    setBusy(true);
    setError(null);
    try {
      await createAnnouncement({
        kind,
        title,
        body,
        photoFile: photo,
        postedBy: t('announce.postedBy'),
      });
      router.push('/admin/announcements');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('announce.failed'));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-4">
      <button
        onClick={() => router.push('/admin/announcements')}
        className="mb-3 flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800"
      >
        <Icon name="back" className="h-4 w-4" />
        {t('announce.newTitle')}
      </button>

      <form onSubmit={onSubmit} className="space-y-5 rounded-3xl bg-white p-4 shadow-card">
        <div>
          <p className="label">{t('announce.kindLabel')}</p>
          <div className="grid grid-cols-2 gap-2">
            {(['general', 'urgent'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={
                  'flex items-center gap-2 rounded-2xl border-2 px-3 py-3 text-sm font-semibold transition ' +
                  (kind === k
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : 'border-slate-200 bg-white text-slate-600')
                }
              >
                <span
                  className={
                    'grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ' +
                    (kind === k ? 'border-brand-600' : 'border-slate-300')
                  }
                >
                  {kind === k && <span className="h-2 w-2 rounded-full bg-brand-600" />}
                </span>
                {k === 'urgent' ? t('announce.kindUrgent') : t('announce.kindGeneral')}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="title">
            {t('announce.fieldTitle')}
          </label>
          <input
            id="title"
            maxLength={TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('announce.fieldTitlePlaceholder')}
            className="field"
          />
          <p className="mt-1 text-right text-xs text-slate-500">
            {title.length}/{TITLE_MAX}
          </p>
        </div>

        <div>
          <label className="label" htmlFor="body">
            {t('announce.fieldBody')}
          </label>
          <textarea
            id="body"
            rows={5}
            maxLength={BODY_MAX}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('announce.fieldBodyPlaceholder')}
            className="field resize-none"
          />
          <p className="mt-1 text-right text-xs text-slate-500">
            {body.length}/{BODY_MAX}
          </p>
        </div>

        <div>
          <p className="label">{t('announce.photoOptional')}</p>
          <PhotoUpload onChange={(files) => setPhoto(files[0] ?? null)} />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
        )}

        <button type="submit" disabled={!canPost} className="btn-primary">
          {busy ? t('announce.posting') : t('announce.post')}
        </button>
      </form>
    </main>
  );
}
