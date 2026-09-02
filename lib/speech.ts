'use client';

import { LANGUAGES, type Lang } from './languages';

/**
 * Speaking and listening, and being honest about when neither is available.
 *
 * Both of these are browser features that exist on paper everywhere and work in
 * about half the places you try them. Dictation is Chrome and Edge only, needs
 * a live connection because the audio is sent away to be transcribed, and its
 * accuracy in an Indian language over a village phone speaker is a coin toss.
 * Speech synthesis depends on voices the device happens to have installed —
 * Android usually ships Hindi and often nothing else Indian at all.
 *
 * So nothing here is load-bearing. Dictation fills in a text field that can
 * also be typed, and the voice flow records the audio itself regardless, so a
 * complaint survives a transcription that never arrives. `canDictate()` and
 * `canSpeak()` exist so the UI can hide a button rather than offer one that
 * does nothing.
 */

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function canDictate(): boolean {
  return recognitionCtor() !== null;
}

export interface DictationHandle {
  stop: () => void;
}

/**
 * Listens until stopped, reporting text as it firms up.
 *
 * `onText` receives the whole utterance every time, final or not, so a caller
 * can render it live and keep the last value without stitching fragments
 * together. `isFinal` marks the point the engine stopped revising.
 */
export function startDictation(options: {
  lang: Lang;
  onText: (text: string, isFinal: boolean) => void;
  onError?: (kind: 'denied' | 'network' | 'nospeech' | 'failed') => void;
  onEnd?: () => void;
}): DictationHandle | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = LANGUAGES[options.lang]?.tag || 'hi-IN';
  // Keep listening through the pauses of someone thinking about what to say,
  // rather than cutting them off at the first silence.
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalText = '';

  recognition.onresult = (event: any) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0]?.transcript ?? '';
      if (result.isFinal) finalText += text;
      else interim += text;
    }
    const combined = (finalText + interim).trim();
    if (combined) options.onText(combined, interim === '');
  };

  recognition.onerror = (event: any) => {
    const code = event?.error || '';
    const kind =
      code === 'not-allowed' || code === 'service-not-allowed'
        ? 'denied'
        : code === 'network'
          ? 'network'
          : code === 'no-speech'
            ? 'nospeech'
            : 'failed';
    options.onError?.(kind);
  };

  recognition.onend = () => options.onEnd?.();

  try {
    recognition.start();
  } catch {
    // Already running, or the page is not allowed to start one. Either way
    // there is nothing to stop.
    return null;
  }

  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    },
  };
}

/* ------------------------------ speaking out ------------------------------ */

let voicesReady = false;

/**
 * The voice list arrives asynchronously on most browsers and is empty on the
 * first call, so anything asking "can this device speak Tamil" before it lands
 * gets a wrong no. Nudging it early makes that window small.
 */
export function warmVoices(): void {
  if (voicesReady || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  if (synth.getVoices().length) {
    voicesReady = true;
    return;
  }
  synth.addEventListener?.('voiceschanged', () => {
    voicesReady = true;
  });
  // Some builds only populate the list once it has been asked for.
  synth.getVoices();
}

function voiceFor(lang: Lang): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const tag = LANGUAGES[lang]?.tag || 'hi-IN';
  const base = tag.split('-')[0];
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === tag) ||
    voices.find((v) => v.lang.replace('_', '-') === tag) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(base)) ||
    null
  );
}

/**
 * Whether this device can read a prompt aloud in this language.
 *
 * Deliberately strict about the language: reading a Hindi prompt in an English
 * voice produces sounds, not speech, and is worse than staying quiet.
 */
export function canSpeak(lang: Lang): boolean {
  return voiceFor(lang) !== null;
}

export function speak(text: string, lang: Lang): void {
  const voice = voiceFor(lang);
  if (!voice || !text) return;

  const synth = window.speechSynthesis;
  // Queued utterances pile up if someone taps the speaker twice; the second
  // tap should replace the first, not wait behind it.
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  // A shade under natural pace. These prompts are read by people hearing an
  // app talk for the first time.
  utterance.rate = 0.92;
  synth.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
}
