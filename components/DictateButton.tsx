'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { useI18n } from '@/lib/i18n';
import { canDictate, startDictation, type DictationHandle } from '@/lib/speech';

/**
 * Speaking into a text field, for people who can read but would rather not type.
 *
 * A different job from the voice flow next door. That one records the complaint
 * because its user cannot check a transcript; this one only saves someone
 * thumbing Devanagari into a phone keyboard, and they can see and fix whatever
 * comes out. So no audio is kept, and the button simply is not rendered where
 * dictation does not exist — which is every browser but Chrome and Edge.
 */
export default function DictateButton({
  current,
  onText,
}: {
  /** Existing text, so speaking adds to it rather than wiping it. */
  current: string;
  onText: (text: string) => void;
}) {
  const { lang, t } = useI18n();
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const handle = useRef<DictationHandle | null>(null);

  // Checked after mount: the export is static, the browser API is not, and
  // deciding on the server would render a button half the visitors cannot use.
  useEffect(() => setSupported(canDictate()), []);
  useEffect(() => () => handle.current?.stop(), []);

  if (!supported) return null;

  function toggle() {
    if (listening) {
      handle.current?.stop();
      handle.current = null;
      setListening(false);
      return;
    }

    const base = current.trim();
    handle.current = startDictation({
      lang,
      onText: (text) => onText(base ? base + ' ' + text : text),
      onError: () => setListening(false),
      onEnd: () => setListening(false),
    });
    setListening(handle.current !== null);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      className={
        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ' +
        (listening ? 'bg-red-600 text-white' : 'bg-brand-50 text-brand-700')
      }
    >
      <Icon name={listening ? 'stop' : 'mic'} className="h-3.5 w-3.5" strokeWidth={2} />
      {listening ? t('voice.listening') : t('voice.dictate')}
    </button>
  );
}
