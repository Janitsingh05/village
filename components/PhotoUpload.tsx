'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { compressPhoto, readableSize } from '@/lib/imageCompress';
import { useI18n } from '@/lib/i18n';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * One dashed drop-box. The input deliberately omits `capture`, so Android and
 * iOS both offer "take a photo" *and* "choose from gallery" in one sheet —
 * which is exactly what the label promises.
 *
 * Compression runs the moment a photo is picked, so the wait happens while the
 * rest of the form is being filled rather than on submit.
 */
export default function PhotoUpload({
  titleKey = 'report.photoBoxTitle',
  subKey = 'report.photoBoxSub',
  onChange,
}: {
  titleKey?: string;
  subKey?: string;
  onChange: (file: File | null) => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);

    if (file.size > MAX_BYTES) {
      setError(t('report.photoLimit'));
      return;
    }

    setBusy(true);
    try {
      const original = file.size;
      const compressed = await compressPhoto(file);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(compressed));
      setNote(readableSize(original) + ' → ' + readableSize(compressed.size));
      onChange(compressed);
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setNote(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {preview ? (
        <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={t('photo.selectedAlt')} className="max-h-64 w-full object-cover" />
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="text-xs text-slate-500">{note}</span>
            <button
              type="button"
              onClick={clear}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              {t('photo.remove')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/40 px-4 py-6 text-center transition active:scale-[0.99] disabled:opacity-60"
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-600 text-white">
            <Icon name="camera" className="h-6 w-6" strokeWidth={1.8} />
          </span>
          <span className="text-sm font-bold text-brand-700">
            {busy ? t('photo.preparing') : t(titleKey)}
          </span>
          <span className="text-xs text-slate-500">{t(subKey)}</span>
        </button>
      )}

      <p className="mt-2 text-center text-[11px] text-slate-400">{t('report.photoLimit')}</p>
      {error && <p className="mt-1 text-center text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
