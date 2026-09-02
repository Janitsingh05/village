'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { searchPlaces, mapEmbedUrl, googleMapsUrl, type PlaceResult } from '@/lib/geocode';
import { useI18n } from '@/lib/i18n';

const DEBOUNCE_MS = 700;

/**
 * Find a village on the map instead of typing its district from memory.
 *
 * Onboarding used to take a name and two dropdowns on trust, so a typo or the
 * wrong district went in unnoticed. Picking a real point fixes the spelling,
 * the district and the coordinates in one go, and shows the map so whoever is
 * onboarding can see they picked the right place.
 */
export default function VillageSearch({
  onPick,
  onClear,
  picked,
}: {
  onPick: (place: PlaceResult) => void;
  onClear: () => void;
  picked: PlaceResult | null;
}) {
  const { lang, t } = useI18n();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const runId = useRef(0);

  useEffect(() => {
    if (picked) return;
    const q = term.trim();
    if (q.length < 3) {
      setResults(null);
      return;
    }

    // Debounced: the map service is a shared free service, and this fires on
    // every keystroke otherwise.
    const id = ++runId.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      setFailed(false);
      try {
        const found = await searchPlaces(q, lang);
        if (runId.current === id) setResults(found);
      } catch {
        if (runId.current === id) setFailed(true);
      } finally {
        if (runId.current === id) setBusy(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [term, lang, picked]);

  if (picked) {
    return (
      <div className="rounded-2xl border-2 border-brand-300 bg-brand-50/40 p-3">
        <div className="flex items-start gap-2">
          <Icon name="checkCircle" className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={2.2} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
              {t('search.verified')}
            </p>
            <p className="truncate text-sm font-bold text-slate-900">{picked.name}</p>
            <p className="text-xs text-slate-600">
              {[picked.district, picked.state].filter(Boolean).join(', ')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-slate-600 hover:bg-white"
          >
            {t('search.change')}
          </button>
        </div>

        <iframe
          title={picked.name}
          src={mapEmbedUrl(picked.lat, picked.lng)}
          className="mt-3 h-44 w-full rounded-xl border border-brand-200 bg-white"
          loading="lazy"
        />

        <a
          href={googleMapsUrl(picked.lat, picked.lng)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs font-semibold text-brand-700 underline"
        >
          {t('search.openMaps')}
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t('search.placeholder')}
          className="field pr-10"
          aria-label={t('search.label')}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
          <Icon name="pin" className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-1.5 text-xs text-slate-500">{t('search.hint')}</p>

      {busy && <p className="mt-2 text-sm text-slate-500">{t('search.searching')}</p>}
      {failed && <p className="mt-2 text-sm text-red-600">{t('search.offline')}</p>}

      {!busy && results !== null && results.length === 0 && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t('search.noResults')}
        </p>
      )}

      {results !== null && results.length > 0 && (
        <ul className="mt-2 space-y-2">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onPick(r)}
                className="flex w-full items-start gap-2.5 rounded-2xl border-2 border-slate-200 bg-white p-3 text-left transition active:scale-[0.99] hover:border-brand-300"
              >
                <Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900">
                    {r.name}
                    {r.kind && (
                      <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                        {r.kind}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-slate-500">{r.display}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
