'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { useI18n } from '@/lib/i18n';
import { canDictate, startDictation, type DictationHandle } from '@/lib/speech';
import {
  canRecord,
  startRecording,
  MAX_VOICE_SECONDS,
  type VoiceClip,
  type VoiceRecorder as Recorder,
} from '@/lib/voice-note';

/**
 * Bars in the level meter. Odd, so one sits dead centre under the mic, and
 * enough of them to reach past it — at 21 the whole meter hid behind the
 * button, which is a strange way to build a thing whose job is to be seen.
 */
const BARS = 41;

/**
 * The shape the meter rests at.
 *
 * Uneven rather than flat, so the control reads as something to do with sound
 * before it is touched — and low enough that it never suggests the microphone
 * is already listening, which would be a lie told to exactly the person least
 * able to catch it.
 */
const IDLE = Array.from({ length: BARS }, (_, i) => 0.06 + 0.12 * Math.abs(Math.sin(i * 1.1)));

export interface VoiceResult {
  clip: VoiceClip | null;
  transcript: string;
}

/**
 * Press, speak, stop — with the recording as the real output.
 *
 * Two things run at once: MediaRecorder, which works everywhere and offline,
 * and dictation, which works on Chrome with a connection and is treated as a
 * bonus. Whichever arrives is used; the complaint needs only one of them, and
 * the audio is the one that always shows up.
 *
 * The bars are not decoration. Someone who has never spoken to a phone has no
 * way to know it is listening, and a meter that jumps when they talk says so
 * without a word of instruction — in any language.
 */
export default function VoiceRecorder({
  onResult,
  size = 'lg',
}: {
  onResult: (result: VoiceResult) => void;
  size?: 'lg' | 'sm';
}) {
  const { lang, t } = useI18n();

  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(IDLE);
  const [transcript, setTranscript] = useState('');
  const [dictationState, setDictationState] = useState<
    'idle' | 'working' | 'failed' | 'unsupported'
  >('idle');
  const [error, setError] = useState<string | null>(null);

  const recorder = useRef<Recorder | null>(null);
  const dictation = useRef<DictationHandle | null>(null);
  // Read inside stop(), which is created before the last render's state lands.
  const latestTranscript = useRef('');

  useEffect(() => {
    return () => {
      recorder.current?.cancel();
      dictation.current?.stop();
    };
  }, []);

  const supported = canRecord();

  async function start() {
    setError(null);
    setTranscript('');
    latestTranscript.current = '';
    setSeconds(0);
    setBusy(true);

    // Dictation first, then the recorder.
    //
    // Both want the microphone, and on Android the one that asks second is the
    // one that loses — with getUserMedia already holding it, Chrome's
    // recogniser tends to come back with nothing at all. Starting the recogniser
    // first is what makes a transcript show up on the phones this runs on.
    if (canDictate()) {
      dictation.current = startDictation({
        lang,
        onText: (text) => {
          latestTranscript.current = text;
          setTranscript(text);
          setDictationState('working');
        },
        onError: (kind) => setDictationState(kind === 'nospeech' ? 'idle' : 'failed'),
      });
      setDictationState(dictation.current ? 'idle' : 'failed');
    } else {
      setDictationState('unsupported');
    }

    try {
      recorder.current = await startRecording({
        onLevel: (level) =>
          // Newest sample on the right, like every other meter — the bars scroll
          // rather than redrawing at random.
          setLevels((prev) => [...prev.slice(1), Math.max(0.04, level)]),
        onTick: setSeconds,
        onAutoStop: () => void finish(),
      });
    } catch {
      // Denied, or no microphone. The written form is still right there.
      dictation.current?.stop();
      dictation.current = null;
      setBusy(false);
      setError(t('voice.micDenied'));
      return;
    }

    setBusy(false);
    setRecording(true);
  }

  async function finish() {
    if (!recorder.current) return;
    setBusy(true);
    setRecording(false);

    dictation.current?.stop();
    dictation.current = null;

    let clip: VoiceClip | null = null;
    let tooLong = false;
    try {
      clip = await recorder.current.stop();
    } catch (e) {
      // A recording too big to store is not the same as one that never
      // happened, and the difference matters: the first is fixed by speaking
      // for less time, the second by speaking at all.
      tooLong = e instanceof Error && e.message === 'VOICE_TOO_LARGE';
    }
    recorder.current = null;

    setBusy(false);
    setLevels(IDLE);

    if (tooLong) {
      setError(t('voice.tooLong'));
      return;
    }

    if (!clip && !latestTranscript.current) {
      setError(t('voice.tooShort'));
      return;
    }
    onResult({ clip, transcript: latestTranscript.current });
  }

  if (!supported) {
    return (
      <p className="rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm text-slate-600">
        {t('voice.unsupported')}
      </p>
    );
  }

  const big = size === 'lg';
  const button = big ? 'h-32 w-32' : 'h-20 w-20';

  return (
    <div className="flex flex-col items-center">
      {/* The meter is its own band, above the button rather than behind it.
          Crossing the two crowds the mic and leaves the waveform half hidden;
          stacked, each is a whole shape and the button is unmistakably the
          thing to press. */}
      <div
        aria-hidden
        className={
          'flex w-full items-center justify-between ' + (big ? 'h-24' : 'h-14')
        }
      >
        {levels.map((level, i) => (
          <span
            key={i}
            className={
              'w-[3px] shrink-0 rounded-full transition-[height] duration-75 ' +
              (recording ? 'bg-brand-500' : 'bg-brand-300/60')
            }
            style={{ height: Math.round(6 + level * (big ? 90 : 50)) + 'px' }}
          />
        ))}
      </div>

      <div className={'flex w-full items-center justify-center ' + (big ? 'mt-6' : 'mt-4')}>
        <button
          type="button"
          onClick={() => (recording ? finish() : start())}
          disabled={busy}
          aria-pressed={recording}
          aria-label={recording ? t('voice.stop') : t('voice.start')}
          className={
            'relative grid shrink-0 place-items-center rounded-full text-white ring-8 ring-white transition active:scale-95 disabled:opacity-70 ' +
            button +
            ' ' +
            (recording ? 'animate-pulse bg-red-600 shadow-cta' : 'bg-brand-700 shadow-cta')
          }
        >
          <Icon
            name={recording ? 'stop' : 'mic'}
            className={big ? 'h-14 w-14' : 'h-9 w-9'}
            strokeWidth={1.8}
            filled={!recording}
          />
        </button>
      </div>

      <p className="mt-5 text-center text-base font-bold text-slate-800">
        {busy
          ? t('common.loading')
          : recording
            ? t('voice.listening') + ' · ' + seconds + 's'
            : t('voice.tapToSpeak')}
      </p>

      {recording && (
        <p className="mt-1 text-center text-xs text-slate-500">
          {t('voice.maxLength', { n: MAX_VOICE_SECONDS })}
        </p>
      )}

      {/* Shown live so the words appearing are visible proof it is working —
          and never presented as something to check, because the person this is
          built for cannot check it. */}
      {transcript && (
        <p className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-center text-[15px] leading-snug text-slate-700 shadow-card">
          {transcript}
        </p>
      )}

      {/* Said quietly, and only while recording. The complaint is going through
          on the audio either way, so this explains a blank space rather than
          reporting a failure — but leaving it unexplained is what makes people
          think the button is broken. */}
      {recording && !transcript && dictationState !== 'idle' && (
        <p className="mt-3 text-center text-xs leading-snug text-slate-500">
          {t(dictationState === 'unsupported' ? 'voice.noTextHere' : 'voice.noTextNow')}
        </p>
      )}

      {error && (
        <p className="mt-4 w-full rounded-2xl bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
