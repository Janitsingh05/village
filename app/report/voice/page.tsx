'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import CategoryIcon from '@/components/CategoryIcon';
import CameraCapture from '@/components/CameraCapture';
import VoiceRecorder, { type VoiceResult } from '@/components/VoiceRecorder';
import { createComplaint } from '@/lib/complaints';
import { readReportError, REPORT_ERROR_KEY } from '@/lib/report-errors';
import { CATEGORIES, isValidPhone } from '@/lib/config';
import { guessCategory } from '@/lib/category-guess';
import { canSpeak, speak, stopSpeaking, warmVoices } from '@/lib/speech';
import { reverseGeocode, type Place } from '@/lib/geocode';
import { getMe, rememberMe } from '@/lib/me';
import { complaintHref } from '@/lib/route-id';
import { useI18n } from '@/lib/i18n';
import type { CategoryId } from '@/lib/types';

type Step = 'speak' | 'category' | 'photo' | 'place' | 'phone' | 'sending';

const ORDER: Step[] = ['speak', 'category', 'photo', 'place', 'phone'];

/**
 * Filing a complaint without writing anything.
 *
 * The ordinary form asks five questions at once down a scrolling page, which is
 * fine if you read comfortably and impossible if you do not. This asks one
 * thing per screen, in a sentence, with a single large control under it — and
 * every screen can be read aloud, so someone who cannot read the question can
 * still hear it.
 *
 * Only the phone number has to be typed, and it is typed on a keypad rather
 * than a keyboard: a person who cannot read a form can still dial a number,
 * because that is the one thing every phone has always asked of them.
 */
export default function VoiceReportPage() {
  const router = useRouter();
  const { lang, t } = useI18n();

  const [step, setStep] = useState<Step>('speak');
  const [transcript, setTranscript] = useState('');
  const [voice, setVoice] = useState<VoiceResult['clip']>(null);
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [locating, setLocating] = useState(false);
  const [phone, setPhone] = useState(() => getMe()?.phone ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(warmVoices, []);
  useEffect(() => stopSpeaking, []);

  const index = ORDER.indexOf(step);
  const prompt = t('voice.prompt_' + step);

  // Read each new question aloud, once, without being asked. Someone who needs
  // this flow should not have to discover a speaker button first — and the
  // button stays there for a second listen.
  const spokenFor = useRef<Step | null>(null);
  useEffect(() => {
    if (step === 'sending' || spokenFor.current === step) return;
    spokenFor.current = step;
    if (canSpeak(lang)) speak(prompt, lang);
  }, [step, prompt, lang]);

  function go(next: Step) {
    stopSpeaking();
    setStep(next);
  }

  function nextFrom(current: Step) {
    const at = ORDER.indexOf(current);
    if (at >= 0 && at < ORDER.length - 1) go(ORDER[at + 1]);
  }

  function onSpoken(result: VoiceResult) {
    setVoice(result.clip);
    setTranscript(result.transcript);
    // A guess, pre-selected on the next screen where it is visible and one tap
    // from being changed. Never used without the reporter seeing it.
    setCategory(guessCategory(result.transcript));
    go('category');
  }

  function locate() {
    if (!('geolocation' in navigator)) return nextFrom('place');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const at = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(at);
        try {
          setPlace(await reverseGeocode(at.lat, at.lng, lang));
        } catch {
          /* the fix alone is still useful to the Panchayat */
        }
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  async function submit() {
    setStep('sending');
    setError(null);
    try {
      const id = await createComplaint({
        category: category ?? 'other',
        // A recording with no transcript still needs something on the
        // complaint document, because the feed and the rules both expect a
        // description. Say plainly that it is spoken rather than inventing one.
        description: transcript.trim() || t('voice.spokenComplaint'),
        photoFiles: photo ? [photo] : [],
        voice,
        ward: coords ? 'GPS' : '',
        lat: coords?.lat,
        lng: coords?.lng,
        address: place?.display,
        reporterName: t('common.anon'),
        reporterPhone: phone,
      });
      rememberMe({ name: '', phone });
      router.push(complaintHref(id) + '&new=1');
    } catch (err) {
      // The message from Firestore is developer-facing ("Missing or
      // insufficient permissions"); the person holding the phone needs the one
      // thing they can act on.
      const kind = readReportError(err);
      setError(kind === 'failed' ? t('voice.sendFailed') : t(REPORT_ERROR_KEY[kind]));
      setStep('phone');
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-brand-50 to-slate-50">
      <header className="flex items-center gap-3 px-4 py-3">
        <Link
          href="/report"
          aria-label={t('common.back')}
          className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-700"
        >
          <Icon name="back" className="h-6 w-6" />
        </Link>
        <div className="flex flex-1 items-center gap-1.5" aria-hidden>
          {ORDER.map((s, i) => (
            <span
              key={s}
              className={
                'h-1.5 flex-1 rounded-full ' + (i <= index ? 'bg-brand-600' : 'bg-slate-200')
              }
            />
          ))}
        </div>
        {canSpeak(lang) && step !== 'sending' && (
          <button
            type="button"
            onClick={() => speak(prompt, lang)}
            aria-label={t('voice.readAloud')}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-brand-700 shadow-card"
          >
            <Icon name="speaker" className="h-5 w-5" />
          </button>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-6">
        {step !== 'sending' && (
          <h1 className="mt-4 text-center text-[26px] font-extrabold leading-tight text-brand-900">
            {prompt}
          </h1>
        )}

        {step === 'speak' && (
          <div className="mt-12">
            <VoiceRecorder onResult={onSpoken} />
            <p className="mt-8 text-center text-sm leading-relaxed text-slate-500">
              {t('voice.speakHelp')}
            </p>
          </div>
        )}

        {step === 'category' && (
          <div className="mt-6">
            {/* What the recording became, shown once so it is visible that the
                words were captured. Not editable here — this flow exists for
                someone who cannot proofread it, and the audio is what the
                Panchayat actually receives. */}
            {transcript && (
              <p className="mb-5 rounded-2xl bg-white px-4 py-3 text-center text-[15px] leading-snug text-slate-700 shadow-card">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('voice.heard')}
                </span>
                {transcript}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((cat) => {
                const selected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    aria-pressed={selected}
                    className={
                      'flex flex-col items-center gap-2 rounded-3xl border-2 px-2 py-5 transition active:scale-[0.98] ' +
                      (selected ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white')
                    }
                  >
                    <CategoryIcon id={cat.id} size="lg" />
                    <span className="text-center text-[13px] font-bold leading-tight text-slate-700">
                      {t('category.' + cat.id)}
                    </span>
                  </button>
                );
              })}
            </div>
            <NextButton
              disabled={!category}
              label={t('voice.next')}
              onClick={() => nextFrom('category')}
            />
          </div>
        )}

        {step === 'photo' && (
          <div className="mt-10">
            {photo ? (
              <div className="rounded-3xl bg-white p-3 shadow-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(photo)}
                  alt={t('photo.selectedAlt')}
                  className="max-h-64 w-full rounded-2xl object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  className="mt-3 w-full py-1 text-sm font-semibold text-slate-500"
                >
                  {t('photo.remove')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="mx-auto grid h-32 w-32 place-items-center rounded-full bg-brand-700 text-white shadow-cta ring-8 ring-white transition active:scale-95"
              >
                <Icon name="camera" className="h-14 w-14" strokeWidth={1.8} />
              </button>
            )}

            <NextButton
              label={photo ? t('voice.next') : t('voice.skip')}
              onClick={() => nextFrom('photo')}
            />
          </div>
        )}

        {step === 'place' && (
          <div className="mt-10">
            {place || coords ? (
              <p className="flex items-center justify-center gap-2 rounded-3xl bg-white px-5 py-6 text-center text-lg font-bold text-brand-800 shadow-card">
                <Icon name="pin" className="h-6 w-6 shrink-0" />
                {place?.display ?? t('report.gpsNoPlace')}
              </p>
            ) : (
              <button
                type="button"
                onClick={locate}
                disabled={locating}
                className="mx-auto grid h-32 w-32 place-items-center rounded-full bg-brand-700 text-white shadow-cta ring-8 ring-white transition active:scale-95 disabled:opacity-70"
              >
                <Icon name="pin" className="h-14 w-14" strokeWidth={1.8} />
              </button>
            )}
            {locating && (
              <p className="mt-5 text-center text-sm text-slate-500">{t('report.gpsLocating')}</p>
            )}

            <NextButton
              label={coords ? t('voice.next') : t('voice.skip')}
              onClick={() => nextFrom('place')}
            />
          </div>
        )}

        {step === 'phone' && (
          <div className="mt-6">
            <p
              className="mt-2 text-center font-mono text-3xl font-bold tracking-[0.2em] text-slate-900"
              role="status"
              aria-live="polite"
              aria-label={t('register.phone') + ': ' + (phone.split('').join(' ') || '—')}
            >
              {phone.padEnd(10, '·')}
            </p>
            <Keypad value={phone} onChange={setPhone} />

            {error && (
              <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-center text-sm text-red-700">
                {error}
              </p>
            )}

            <NextButton
              disabled={!isValidPhone(phone)}
              label={t('voice.send')}
              onClick={submit}
            />
            <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
              {t('report.phoneNote')}
            </p>
          </div>
        )}

        {step === 'sending' && (
          <div className="grid flex-1 place-items-center">
            <div className="text-center">
              <span className="mx-auto grid h-20 w-20 animate-pulse place-items-center rounded-full bg-brand-100 text-brand-700">
                <Icon name="checkCircle" className="h-10 w-10" strokeWidth={2} />
              </span>
              <p className="mt-4 text-lg font-bold text-slate-800">{t('report.submitting')}</p>
            </div>
          </div>
        )}
      </main>

      {cameraOpen && (
        <CameraCapture
          onCapture={(file) => setPhoto(file)}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}

function NextButton({
  label,
  onClick,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-8 flex w-full items-center justify-center gap-2 rounded-3xl bg-brand-700 px-5 py-5 text-xl font-bold text-white shadow-cta transition active:scale-[0.99] disabled:opacity-40 disabled:shadow-none"
    >
      {label}
      <Icon name="arrowRight" className="h-6 w-6" strokeWidth={2.4} />
    </button>
  );
}

/**
 * Ten digits, on the one keyboard everybody already knows.
 *
 * A phone number is the only thing this flow cannot avoid asking for, and a
 * text field would summon a full QWERTY keyboard — the exact obstacle the
 * screen exists to route around. Someone who cannot read a form has still
 * dialled a number every day of their life.
 */
function Keypad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <div className="mt-6 grid grid-cols-3 gap-3">
      {keys.map((key, i) =>
        key === '' ? (
          <span key={i} />
        ) : (
          <button
            key={i}
            type="button"
            aria-label={key === 'del' ? t('voice.delete') : key}
            onClick={() =>
              key === 'del'
                ? onChange(value.slice(0, -1))
                : value.length < 10 && onChange(value + key)
            }
            className={
              'grid h-16 place-items-center rounded-2xl text-2xl font-bold shadow-card transition active:scale-95 ' +
              (key === 'del' ? 'bg-slate-100 text-slate-500' : 'bg-white text-slate-900')
            }
          >
            {key === 'del' ? <Icon name="back" className="h-6 w-6" strokeWidth={2.2} /> : key}
          </button>
        )
      )}
    </div>
  );
}
