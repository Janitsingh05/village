'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { useI18n } from '@/lib/i18n';
import { getVoiceNote } from '@/lib/complaints';

/**
 * Playing back a spoken complaint.
 *
 * The audio is fetched only when someone presses play, like the full-size
 * photos — a feed row should never drag a recording down a 3G connection to
 * show a button.
 *
 * Recording formats do not travel: Android Chrome writes WebM/Opus and iOS
 * Safari writes MP4/AAC, and neither reliably plays the other. So a failure to
 * play is reported as one, with the transcript still on screen above, rather
 * than left as a control that does nothing when tapped.
 */
export default function VoicePlayer({
  complaintId,
  seconds,
  villageId,
}: {
  complaintId: string;
  seconds: number;
  villageId?: string;
}) {
  const { t } = useI18n();
  const audio = useRef<HTMLAudioElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'missing' | 'unplayable'>(
    'idle'
  );

  useEffect(() => {
    return () => {
      audio.current?.pause();
      audio.current = null;
    };
  }, []);

  async function toggle() {
    if (state === 'playing') {
      audio.current?.pause();
      setState('idle');
      return;
    }

    let url = src;
    if (!url) {
      setState('loading');
      const note = await getVoiceNote(complaintId, villageId).catch(() => null);
      if (!note) {
        setState('missing');
        return;
      }
      url = note.dataUrl;
      setSrc(url);
    }

    const el = audio.current ?? new Audio();
    audio.current = el;
    el.src = url;
    el.onended = () => setState('idle');
    el.onerror = () => setState('unplayable');

    try {
      await el.play();
      setState('playing');
    } catch {
      setState('unplayable');
    }
  }

  if (state === 'missing' || state === 'unplayable') {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
        <Icon name="mic" className="h-4 w-4 shrink-0 text-slate-500" />
        {t(state === 'missing' ? 'voice.playMissing' : 'voice.playUnsupported')}
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={state === 'loading'}
      className="flex w-full items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-left transition active:scale-[0.99] disabled:opacity-70"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
        <Icon
          name={state === 'playing' ? 'stop' : 'play'}
          className="h-5 w-5"
          filled={state !== 'playing'}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-brand-900">{t('voice.recorded')}</span>
        <span className="block text-xs text-brand-700">
          {state === 'loading' ? t('common.loading') : seconds + 's'}
        </span>
      </span>
    </button>
  );
}
