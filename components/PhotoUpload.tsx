'use client';

import { useRef, useState } from 'react';
import Icon from './Icon';
import CameraCapture from './CameraCapture';
import { preparePhoto, readableSize } from '@/lib/imageCompress';
import { useI18n } from '@/lib/i18n';

const MAX_BYTES = 5 * 1024 * 1024;

interface Picked {
  file: File;
  thumb: string;
  note: string;
}

/**
 * Photo picker for one or several images.
 *
 * The input deliberately omits `capture`, so Android and iOS both offer "take a
 * photo" *and* "choose from gallery" in one sheet — which is what the label
 * promises. Compression runs the moment a photo is picked, so the wait happens
 * while the rest of the form is filled rather than on submit, and an unusable
 * image is rejected before the complaint is written.
 */
export default function PhotoUpload({
  max = 1,
  onChange,
}: {
  max?: number;
  onChange: (files: File[]) => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  function publish(next: Picked[]) {
    setPicked(next);
    onChange(next.map((p) => p.file));
  }

  async function handleFiles(fileList: FileList | File[] | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setBusy(true);

    const room = max - picked.length;
    const incoming = Array.from(fileList).slice(0, Math.max(room, 0));
    const accepted: Picked[] = [];

    try {
      for (const file of incoming) {
        if (file.size > MAX_BYTES) {
          setError(t('report.photoLimit'));
          continue;
        }
        try {
          const prepared = await preparePhoto(file);
          accepted.push({
            file,
            thumb: prepared.thumb,
            note: readableSize(prepared.originalBytes) + ' → ' + readableSize(prepared.fullBytes),
          });
        } catch (err) {
          const code = err instanceof Error ? err.message : '';
          setError(
            code === 'PHOTO_TOO_LARGE'
              ? t('report.photoTooLarge')
              : code === 'UNSUPPORTED_FORMAT'
                ? t('report.photoFormat')
                : t('report.photoFailed')
          );
        }
      }
      if (accepted.length) publish([...picked, ...accepted]);
    } finally {
      setBusy(false);
      // Let the same file be chosen again after a removal.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function removeAt(index: number) {
    publish(picked.filter((_, i) => i !== index));
    setError(null);
  }

  const room = max - picked.length;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={max > 1}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {picked.length > 0 && (
        <ul className={'mb-3 grid gap-2 ' + (max > 1 ? 'grid-cols-3' : 'grid-cols-1')}>
          {picked.map((p, i) => (
            <li key={i} className="relative overflow-hidden rounded-2xl border-2 border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.thumb}
                alt={t('photo.selectedAlt')}
                className={'w-full object-cover ' + (max > 1 ? 'h-24' : 'max-h-64')}
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={t('photo.remove')}
                className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-slate-900/70 text-white"
              >
                <Icon name="plus" className="h-4 w-4 rotate-45" strokeWidth={2.6} />
              </button>
              {max === 1 && (
                <p className="px-3 py-2 text-xs text-slate-500">{p.note}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {room > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {/* The camera comes first: someone standing in front of the problem
              should not have to hunt for it. */}
          <button
            type="button"
            disabled={busy}
            onClick={() => setCameraOpen(true)}
            className="flex flex-col items-center gap-2 rounded-2xl border-2 border-brand-300 bg-brand-50/60 px-3 py-5 text-center transition active:scale-[0.98] disabled:opacity-60"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-600 text-white">
              <Icon name="camera" className="h-6 w-6" strokeWidth={1.8} />
            </span>
            <span className="text-sm font-bold leading-tight text-brand-700">
              {busy ? t('photo.preparing') : t('camera.open')}
            </span>
            <span className="text-[11px] leading-tight text-slate-500">{t('camera.openSub')}</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-3 py-5 text-center transition active:scale-[0.98] disabled:opacity-60"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-500">
              <Icon name="doc" className="h-6 w-6" strokeWidth={1.8} />
            </span>
            <span className="text-sm font-bold leading-tight text-slate-700">
              {t('camera.gallery')}
            </span>
            <span className="text-[11px] leading-tight text-slate-500">
              {t('camera.gallerySub')}
            </span>
          </button>
        </div>
      )}

      {cameraOpen && (
        <CameraCapture
          onCapture={(file) => handleFiles([file])}
          onClose={() => setCameraOpen(false)}
        />
      )}

      <p className="mt-2 text-center text-[11px] text-slate-500">
        {max > 1 ? t('report.photoLimitMulti', { n: max, used: picked.length }) : t('report.photoLimit')}
      </p>
      {error && <p className="mt-1 text-center text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
