'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { useI18n } from '@/lib/i18n';
import { placesForPincode, type PincodePlace } from '@/lib/pincode';

/**
 * Six digits, and back comes the village.
 *
 * A pincode is the one piece of their own address a villager reliably knows and
 * can type without spelling anything. Everything else on an onboarding form —
 * the village's name as the directory spells it, its district, its coordinates —
 * follows from it, and all of that was previously typed on trust or guessed at
 * through a map search.
 *
 * It is also the better question for the person onboarding a village. India has
 * a Rampura in most states, so a name search hands them five and asks them to
 * know which; a pincode hands them the handful of hamlets under one post office.
 */
export default function PincodePicker({
  onPick,
  autoFocus = false,
}: {
  onPick: (place: PincodePlace) => void;
  autoFocus?: boolean;
}) {
  const { t } = useI18n();
  const [pin, setPin] = useState('');
  const [places, setPlaces] = useState<PincodePlace[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pin.length !== 6) {
      setPlaces(null);
      return;
    }

    let alive = true;
    setBusy(true);
    placesForPincode(pin)
      .then((list) => alive && setPlaces(list))
      .catch(() => alive && setPlaces([]))
      .finally(() => alive && setBusy(false));

    return () => {
      alive = false;
    };
  }, [pin]);

  return (
    <div>
      <label className="label" htmlFor="pincode">
        {t('pin.label')}
      </label>
      <p className="-mt-1 mb-2 text-xs text-slate-500">{t('pin.help')}</p>
      <input
        id="pincode"
        inputMode="numeric"
        autoComplete="postal-code"
        autoFocus={autoFocus}
        maxLength={6}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="332001"
        className="field font-mono tracking-[0.2em]"
      />

      {busy && <p className="mt-2 text-sm text-slate-500">{t('common.loading')}</p>}

      {/* Not found is a real answer here, and worth saying plainly: the
          directory ships with the app, so an empty result means the pincode is
          wrong rather than that anything failed. */}
      {!busy && places !== null && places.length === 0 && (
        <p className="mt-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t('pin.notFound')}
        </p>
      )}

      {!busy && places !== null && places.length > 0 && (
        <>
          <p className="mt-3 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {t('pin.pickOne', { n: places.length })}
          </p>
          <ul className="mt-1.5 max-h-64 space-y-1.5 overflow-y-auto">
            {places.map((place) => (
              <li key={place.name + place.pincode}>
                <button
                  type="button"
                  onClick={() => onPick(place)}
                  className="flex w-full items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-3 text-left transition active:scale-[0.99]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                    <Icon name="home" className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-900">
                      {place.name}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {[place.district, place.state].filter(Boolean).join(', ')}
                      {/* Said out loud, because it decides whether the map opens
                          on this village or on nothing. */}
                      {place.lat == null ? ' · ' + t('pin.noCoords') : ''}
                    </span>
                  </span>
                  <Icon name="chevronRight" className="h-5 w-5 shrink-0 text-slate-300" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
