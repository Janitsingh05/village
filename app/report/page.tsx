'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import AppHeader from '@/components/AppHeader';
import CategoryPicker from '@/components/CategoryPicker';
import PhotoUpload from '@/components/PhotoUpload';
import Icon from '@/components/Icon';
import { createComplaint } from '@/lib/complaints';
import { MAX_PHOTOS, wardOptions } from '@/lib/config';
import { useI18n } from '@/lib/i18n';
import { reverseGeocode, type Place } from '@/lib/geocode';
import { rememberMe } from '@/lib/me';
import { complaintHref } from '@/lib/route-id';
import type { CategoryId } from '@/lib/types';

const DESC_MAX = 200;

export default function ReportPage() {
  const router = useRouter();
  const { lang, t } = useI18n();

  const [category, setCategory] = useState<CategoryId | null>(null);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [locMode, setLocMode] = useState<'gps' | 'ward'>('gps');
  const [ward, setWard] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsState, setGpsState] = useState<'idle' | 'locating' | 'done' | 'denied'>('idle');
  const [place, setPlace] = useState<Place | null>(null);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getLocation() {
    if (!('geolocation' in navigator)) {
      setGpsState('denied');
      setLocMode('ward');
      return;
    }
    setGpsState('locating');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const at = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(at);
        setGpsState('done');

        // Coordinates alone tell the Panchayat nothing, so resolve a readable
        // place. A failure here is not fatal — the complaint keeps the fix.
        setPlaceBusy(true);
        try {
          setPlace(await reverseGeocode(at.lat, at.lng, lang));
        } finally {
          setPlaceBusy(false);
        }
      },
      () => {
        setGpsState('denied');
        setLocMode('ward');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  const phoneDigits = phone.replace(/\D/g, '');
  const hasLocation = locMode === 'gps' ? coords != null : ward !== '';
  const canSubmit =
    !!category &&
    description.trim().length >= 5 &&
    hasLocation &&
    phoneDigits.length === 10 &&
    !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !category) return;

    setSubmitting(true);
    setError(null);
    try {
      const id = await createComplaint({
        category,
        description,
        photoFiles: photos,
        ward: ward || (coords ? 'GPS' : ''),
        lat: coords?.lat,
        lng: coords?.lng,
        address: place?.display,
        reporterName: name.trim() || t('common.anon'),
        reporterPhone: phoneDigits,
      });
      rememberMe({ name: name.trim(), phone: phoneDigits });
      router.push(complaintHref(id) + '&new=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('report.failed'));
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 pb-6">
      <AppHeader back="/" title={t('report.title')} />

      <main className="mx-auto max-w-2xl px-4 pb-4">
        <div className="mb-5 flex items-start gap-2.5 rounded-2xl bg-brand-50 p-3">
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
            <Icon name="checkCircle" className="h-4 w-4" strokeWidth={2.4} />
          </span>
          <p className="text-[13px] leading-snug text-brand-800">{t('report.notice')}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <section>
            <p className="label">{t('report.step1New')}</p>
            <CategoryPicker value={category} onChange={setCategory} />
          </section>

          <section>
            <label className="label" htmlFor="desc">
              {t('report.step2New')}
            </label>
            <textarea
              id="desc"
              rows={4}
              maxLength={DESC_MAX}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('report.descPlaceholderNew')}
              className="field resize-none"
            />
            <p className="mt-1 text-right text-xs text-slate-400">
              {description.length}/{DESC_MAX}
            </p>
          </section>

          <section>
            <p className="label">{t('report.step3New')}</p>
            <PhotoUpload max={MAX_PHOTOS} onChange={setPhotos} />
          </section>

          <section>
            <p className="label">{t('report.step4New')}</p>
            <div className="space-y-2">
              <LocationOption
                selected={locMode === 'gps'}
                onSelect={() => setLocMode('gps')}
                title={t('report.gpsOption')}
                sub={
                  placeBusy
                    ? t('report.gpsResolving')
                    : place
                      ? place.display
                      : gpsState === 'done'
                        ? t('report.gpsNoPlace')
                        : t('report.gpsOptionSub')
                }
                highlight={Boolean(place)}
                action={
                  <button
                    type="button"
                    onClick={getLocation}
                    disabled={gpsState === 'locating'}
                    className="shrink-0 rounded-xl bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 disabled:opacity-60"
                  >
                    {gpsState === 'locating' ? t('report.gpsLocating') : t('report.gpsGet')}
                  </button>
                }
              />

              <LocationOption
                selected={locMode === 'ward'}
                onSelect={() => setLocMode('ward')}
                title={t('report.wardOption')}
                sub={t('report.wardOptionSub')}
              />

              {locMode === 'ward' && (
                <select
                  aria-label={t('report.wardOption')}
                  value={ward}
                  onChange={(e) => setWard(e.target.value)}
                  className="field appearance-none"
                >
                  <option value="">{t('report.wardPlaceholder')}</option>
                  {wardOptions(lang).map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <p className="label">{t('report.step5')}</p>

            {/* Both fields carry their own visible label: the section holds a
                name and a phone number, so one heading cannot describe both. */}
            <div>
              <label className="label" htmlFor="reporter-name">
                {t('report.nameLabel')}
              </label>
              <input
                id="reporter-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('report.namePlaceholder')}
                className="field"
              />
            </div>

            <div>
              <label className="label" htmlFor="phone">
                {t('report.phoneLabel')}
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder={t('report.phonePlaceholder')}
                className="field"
              />
              <p className="mt-1.5 text-xs text-slate-500">{t('report.phoneNote')}</p>
            </div>
          </section>

          {error && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={!canSubmit} className="btn-primary">
            {submitting ? t('report.submitting') : t('report.submitNew')}
          </button>

          {!canSubmit && !submitting && (
            <p className="text-center text-xs text-slate-500">{t('report.requirements')}</p>
          )}

          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
            <Icon name="checkCircle" className="h-3.5 w-3.5 shrink-0" />
            {t('report.footerNote')}
          </p>
        </form>
      </main>
    </div>
  );
}

function LocationOption({
  selected,
  onSelect,
  title,
  sub,
  action,
  highlight = false,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  sub: string;
  action?: React.ReactNode;
  /** A resolved place is the answer, not a caption — show it as such. */
  highlight?: boolean;
}) {
  return (
    <div
      onClick={onSelect}
      className={
        'flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 transition ' +
        (selected ? 'border-brand-600 bg-brand-50/50' : 'border-slate-200 bg-white')
      }
    >
      <span
        role="radio"
        aria-checked={selected}
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
        className={
          'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ' +
          (selected ? 'border-brand-600' : 'border-slate-300')
        }
      >
        {selected && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span
          className={
            'block text-xs ' +
            (highlight ? 'font-semibold text-brand-700' : 'truncate text-slate-500')
          }
        >
          {sub}
        </span>
      </span>
      {action}
    </div>
  );
}
