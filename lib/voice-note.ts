'use client';

/**
 * Recording the complaint itself, not just a transcript of it.
 *
 * This is the part that makes speaking a complaint actually work. Dictation is
 * Chrome-only, needs a connection, and gets Indian-language village vocabulary
 * wrong often enough to matter — and the person most likely to use it is the
 * least able to proofread what it produced. Meanwhile MediaRecorder works in
 * every browser here, offline, and the Sarpanch on the other end is a human who
 * can simply listen.
 *
 * So the audio is the record and the transcript is a convenience. If the
 * transcript never arrives the complaint still says everything it needs to.
 *
 * The clip goes in the complaint's media subcollection alongside the photos,
 * for the same reason they are there: Cloud Storage wants a billing account and
 * a village pilot should not need one. Opus at 24 kbps puts a minute of speech
 * at ~180 KB, ~240 KB once base64 inflates it — comfortably under Firestore's
 * document limit, and small enough not to punish a 3G upload.
 */

/** Long enough to describe a broken drain, short enough to stay small. */
export const MAX_VOICE_SECONDS = 60;

/** Matches the cap the Firestore rules enforce on a media document. */
const MAX_STORED_CHARS = 900_000;

/** The same cap before base64, which adds about a third. */
const MAX_STORED_BYTES = Math.floor((MAX_STORED_CHARS * 3) / 4);

const BITS_PER_SECOND = 24_000;

export function canRecord(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/**
 * The container the browser will actually give us.
 *
 * Android Chrome records WebM/Opus; iOS Safari records MP4/AAC. Neither plays
 * the other's output reliably, so the type is stored with the clip and the
 * player says so rather than showing a silent, broken control.
 */
function pickMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) || '';
}

export interface VoiceClip {
  /** data: URL, ready to store and to hand straight to an <audio> element. */
  dataUrl: string;
  mimeType: string;
  seconds: number;
  bytes: number;
}

export interface VoiceRecorder {
  /** Ends the recording and resolves with the clip, or null if nothing usable. */
  stop: () => Promise<VoiceClip | null>;
  /** Throws the recording away and releases the microphone. */
  cancel: () => void;
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Starts recording, reporting loudness so the UI can show something moving.
 *
 * The meter matters more than it sounds: someone who has never dictated to a
 * phone has no way to tell whether it is listening, and a bar that reacts to
 * their voice answers that question without a word of instruction.
 */
export async function startRecording(options: {
  onLevel?: (level: number) => void;
  onTick?: (seconds: number) => void;
  /** Fired when the hard duration cap ends the recording on its own. */
  onAutoStop?: () => void;
} = {}): Promise<VoiceRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, {
    ...(mimeType ? { mimeType } : {}),
    audioBitsPerSecond: BITS_PER_SECOND,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const startedAt = Date.now();
  let released = false;

  // MediaRecorder flushes its last chunk asynchronously after stop(), so the
  // blob is only complete once onstop has fired. Wiring that here rather than
  // inside stop() matters for the duration cap, which calls recorder.stop()
  // itself — without this the final quarter-second of a complaint that ran to
  // the limit would simply be missing.
  let markFlushed: () => void = () => undefined;
  const flushed = new Promise<void>((resolve) => {
    markFlushed = resolve;
  });
  recorder.onstop = () => markFlushed();

  /* --------------------------- the loudness meter --------------------------- */

  let audioContext: AudioContext | null = null;
  let raf = 0;

  if (options.onLevel) {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new Ctx();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(buffer);
        // Root mean square around the 128 midpoint: a rough but stable
        // loudness, which is all a bar needs.
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          const v = (buffer[i] - 128) / 128;
          sum += v * v;
        }
        options.onLevel?.(Math.min(1, Math.sqrt(sum / buffer.length) * 3.2));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch {
      // No meter, but the recording itself is unaffected.
    }
  }

  const ticker = options.onTick
    ? setInterval(() => options.onTick?.(Math.floor((Date.now() - startedAt) / 1000)), 250)
    : null;

  function release() {
    released = true;
    if (raf) cancelAnimationFrame(raf);
    if (ticker) clearInterval(ticker);
    void audioContext?.close().catch(() => undefined);
    stream.getTracks().forEach((track) => track.stop());
  }

  recorder.start(250);

  // A hard cap, because a phone left in a pocket will happily record until the
  // document limit makes the write fail — after the person has walked away.
  const limit = setTimeout(() => {
    if (recorder.state === 'recording') {
      recorder.stop();
      options.onAutoStop?.();
    }
  }, MAX_VOICE_SECONDS * 1000);

  return {
    stop: async () => {
      clearTimeout(limit);
      const seconds = Math.round((Date.now() - startedAt) / 1000);

      if (recorder.state === 'recording') recorder.stop();
      // Resolved already when the duration cap stopped it a moment ago.
      await flushed;
      if (!released) release();

      const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
      // Under a second is a mis-tap, not a complaint.
      if (!blob.size || seconds < 1) return null;

      // Checked on the blob, before base64 inflates it by a third.
      //
      // iOS Safari records MP4/AAC and ignores audioBitsPerSecond, so a full
      // minute can land well over the document limit. This used to return null
      // and say nothing — and since Safari has no dictation either, the result
      // was a complaint with a placeholder description, no audio and no
      // transcript, filed by someone who believed they had just spoken it.
      if (blob.size > MAX_STORED_BYTES) throw new Error('VOICE_TOO_LARGE');

      const dataUrl = await toDataUrl(blob);
      if (dataUrl.length > MAX_STORED_CHARS) throw new Error('VOICE_TOO_LARGE');

      return { dataUrl, mimeType: blob.type, seconds, bytes: blob.size };
    },

    cancel: () => {
      clearTimeout(limit);
      try {
        if (recorder.state === 'recording') recorder.stop();
      } catch {
        /* nothing to stop */
      }
      release();
    },
  };
}
