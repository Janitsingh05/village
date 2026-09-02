'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import Logo from './Logo';
import { listVillages, rankByProximity, type NearbyVillage } from '@/lib/villages';
import { reverseGeocode, type Place } from '@/lib/geocode';
import { languageChoicesFor, LANGUAGES, type Lang } from '@/lib/languages';
import { preloadLanguage, useI18n } from '@/lib/i18n';
import { setActiveVillage } from '@/lib/tenant';
import type { Village } from '@/lib/types';

type Step = 'place' | 'village' | 'language';

/** Beyond this a "nearby" village is not nearby, it is just the least far. */
const NEARBY_KM = 40;
const SHOWN = 6;

/**
 * First run: where are you, which village, which language — in that order.
 *
 * The order is the point. Asking for a language first means asking a question
 * in a language the reader may not have; asking for the place first lets the
 * app work out which language to offer, so the only question left is one they
 * can answer by recognising their own script.
 *
 * Step one is deliberately bilingual and icon-led, because it is the one screen
 * that has to be readable before anything is known about the reader.
 */
export default function Welcome({ onDone }: { onDone: () => void }) {
  const { t, setLang } = useI18n();

  const [step, setStep] = useState<Step>('place');
  const [villages, setVillages] = useState<Village[] | null>(null);
  const [at, setAt] = useState<{ lat: number; lng: number } | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [locating, setLocating] = useState(false);
  const [gpsFailed, setGpsFailed] = useState(false);
  const [chosen, setChosen] = useState<Village | null>(null);
  const [search, setSearch] = useState('');

  // Fetched up front: the list is needed the moment GPS returns, and starting
  // it now means the two waits overlap instead of stacking.
  useEffect(() => {
    let alive = true;
    listVillages()
      .then((list) => alive && setVillages(list))
      .catch(() => alive && setVillages([]));
    return () => {
      alive = false;
    };
  }, []);

  function locate() {
    if (!('geolocation' in navigator)) {
      setGpsFailed(true);
      setStep('village');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setAt(here);
        try {
          // English on purpose, even though the reader may not want it: the
          // state name coming back is matched against STATE_LANGUAGE, whose
          // keys are English. A Devanagari "राजस्थान" would fall through to the
          // fuzzy match and a Tamil state name would not match at all — which
          // is exactly the language this step exists to work out.
          setPlace(await reverseGeocode(here.lat, here.lng, 'en'));
        } catch {
          /* the coordinates alone are still enough to sort by */
        }
        setLocating(false);
        setStep('village');
      },
      () => {
        // Denied, or no fix indoors. Not an error worth a red box — the list
        // and the search box work without it.
        setLocating(false);
        setGpsFailed(true);
        setStep('village');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }

  const ranked = useMemo(
    () => rankByProximity(villages || [], at, { district: place?.district, state: place?.state }),
    [villages, at, place]
  );

  const nearby = useMemo(() => {
    const close = ranked.filter((r) => r.km == null || r.km <= NEARBY_KM);
    // Nothing within range means the app has not reached here yet; showing the
    // nearest few anyway beats an empty screen with no way forward.
    return (close.length ? close : ranked).slice(0, SHOWN);
  }, [ranked]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return (villages || [])
      .filter((v) =>
        [v.name, v.nameEn, v.district, v.state].some((f) => f.toLowerCase().includes(q))
      )
      .slice(0, 12);
  }, [search, villages]);

  function pick(village: Village) {
    setChosen(village);
    // Warm both dictionaries now so the choice on the next screen is instant.
    languageChoicesFor(village.state).options.forEach(preloadLanguage);
    setStep('language');
  }

  function finish(code: Lang) {
    if (chosen) setActiveVillage(chosen.id);
    setLang(code);
    onDone();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">
      <Logo variant="full" className="mx-auto h-24 w-24" />

      {step === 'place' && (
        <PlaceStep locating={locating} onLocate={locate} onSkip={() => setStep('village')} />
      )}

      {step === 'village' && (
        <VillageStep
          place={place}
          gpsFailed={gpsFailed}
          loading={villages === null}
          nearby={nearby}
          results={results}
          search={search}
          onSearch={setSearch}
          onPick={pick}
          onRetryGps={locate}
        />
      )}

      {step === 'language' && chosen && (
        <LanguageStep village={chosen} onPick={finish} onBack={() => setStep('village')} />
      )}

      <p className="mt-auto pt-8 text-center text-[11px] text-slate-400">{t('more.aboutSub')}</p>
    </main>
  );
}

/* --------------------------------- step 1 --------------------------------- */

/**
 * The only screen written in two languages at once.
 *
 * Nothing is known about the reader yet, so the safe move is to say it twice
 * and lean on the icon — a map pin means the same thing in every state.
 */
function PlaceStep({
  locating,
  onLocate,
  onSkip,
}: {
  locating: boolean;
  onLocate: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="mt-8">
      <h1 className="text-center text-2xl font-extrabold leading-tight text-slate-900">
        आपका गाँव कौन सा है?
      </h1>
      <p className="mt-1 text-center text-lg font-semibold text-slate-500">
        Which village are you in?
      </p>

      <button
        onClick={onLocate}
        disabled={locating}
        className="mt-8 flex w-full items-center gap-4 rounded-3xl bg-brand-700 p-5 text-white shadow-cta transition active:scale-[0.99] disabled:opacity-70"
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/15">
          <Icon name="pin" className="h-7 w-7" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-lg font-bold leading-tight">
            {locating ? 'ढूँढ रहे हैं…' : 'मेरी जगह पता करें'}
          </span>
          <span className="mt-0.5 block text-sm leading-snug text-brand-100">
            {locating ? 'Finding you…' : 'Use my location'}
          </span>
        </span>
      </button>

      <button
        onClick={onSkip}
        className="mt-3 flex w-full items-center gap-4 rounded-3xl border-2 border-slate-200 bg-white p-5 transition active:scale-[0.99]"
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
          <Icon name="list" className="h-7 w-7" />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-lg font-bold leading-tight text-slate-800">
            सूची में से चुनें
          </span>
          <span className="mt-0.5 block text-sm leading-snug text-slate-500">
            Pick from a list
          </span>
        </span>
      </button>

      <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
        जगह सिर्फ़ आपका गाँव ढूँढने के लिए — कहीं सहेजी नहीं जाती।
        <br />
        Location is used only to find your village.
      </p>
    </div>
  );
}

/* --------------------------------- step 2 --------------------------------- */

function VillageStep({
  place,
  gpsFailed,
  loading,
  nearby,
  results,
  search,
  onSearch,
  onPick,
  onRetryGps,
}: {
  place: Place | null;
  gpsFailed: boolean;
  loading: boolean;
  nearby: NearbyVillage[];
  results: Village[] | null;
  search: string;
  onSearch: (q: string) => void;
  onPick: (v: Village) => void;
  onRetryGps: () => void;
}) {
  const shown: NearbyVillage[] = results
    ? results.map((village) => ({ village, km: null }))
    : nearby;

  return (
    <div className="mt-6">
      {place && (
        <p className="flex items-center justify-center gap-1.5 rounded-full bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800">
          <Icon name="pin" className="h-4 w-4 shrink-0" />
          <span className="truncate">{place.display}</span>
        </p>
      )}

      <h1 className="mt-5 text-center text-xl font-extrabold text-slate-900">
        अपना गाँव चुनें
      </h1>
      <p className="mt-0.5 text-center text-base font-semibold text-slate-500">
        Choose your village
      </p>

      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="गाँव का नाम / Village name"
        className="field mt-5"
      />

      {loading ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="mt-6 rounded-3xl bg-white p-6 text-center text-sm leading-relaxed text-slate-500 shadow-card">
          कोई गाँव नहीं मिला।
          <br />
          <span className="text-slate-400">No village found.</span>
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {shown.map(({ village, km }) => (
            <li key={village.id}>
              <button
                onClick={() => onPick(village)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-card transition active:scale-[0.99]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                  <Icon name="home" className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold text-slate-900">
                    {village.name}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {[village.district, village.state].filter(Boolean).join(', ')}
                  </span>
                </span>
                {km != null && (
                  <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">
                    {km < 1 ? '<1' : Math.round(km)} km
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {gpsFailed && !results && (
        <button
          onClick={onRetryGps}
          className="mt-4 w-full text-center text-sm font-semibold text-brand-700"
        >
          फिर से जगह पता करें · Try location again
        </button>
      )}
    </div>
  );
}

/* --------------------------------- step 3 --------------------------------- */

/**
 * Two buttons, each written in its own script.
 *
 * No English gloss under the endonym, no flags. Someone who reads only Tamil
 * recognises தமிழ் the way they recognise a shop sign; adding "Tamil" beneath
 * it in Latin letters helps only the people who never needed the screen.
 */
function LanguageStep({
  village,
  onPick,
  onBack,
}: {
  village: Village;
  onPick: (code: Lang) => void;
  onBack: () => void;
}) {
  const { options, pending } = languageChoicesFor(village.state);

  return (
    <div className="mt-6">
      <p className="text-center text-sm font-semibold text-slate-500">{village.name}</p>
      <h1 className="mt-2 text-center text-xl font-extrabold text-slate-900">
        भाषा चुनें
      </h1>
      <p className="mt-0.5 text-center text-base font-semibold text-slate-500">
        Choose a language
      </p>

      <div className="mt-8 space-y-3">
        {options.map((code) => (
          <button
            key={code}
            onClick={() => onPick(code)}
            lang={code}
            dir={LANGUAGES[code].rtl ? 'rtl' : 'ltr'}
            className="w-full rounded-3xl border-2 border-slate-200 bg-white px-5 py-6 text-center text-2xl font-extrabold text-slate-900 shadow-card transition active:scale-[0.99]"
          >
            {LANGUAGES[code].endonym}
          </button>
        ))}
      </div>

      {pending && (
        // Said out loud rather than hidden: this state's language exists in the
        // app's plans and not yet in its files, and a villager in Tamil Nadu
        // being handed Hindi deserves to know that is a gap, not a decision
        // about what they speak.
        <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-center text-[13px] leading-snug text-amber-900">
          <span lang={pending} className="font-bold">
            {LANGUAGES[pending].endonym}
          </span>{' '}
          अभी तैयार नहीं है · not ready yet
        </p>
      )}

      <button onClick={onBack} className="mt-6 w-full text-center text-sm font-semibold text-slate-400">
        ← गाँव बदलें · Change village
      </button>
    </div>
  );
}
