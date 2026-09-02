'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { useI18n } from '@/lib/i18n';

type Facing = 'environment' | 'user';

/**
 * In-app camera. Someone standing in front of the problem should be able to
 * photograph it without leaving the form.
 *
 * The stream is held open only while this is mounted — every track is stopped
 * on close, otherwise the phone's camera light stays on after it is dismissed.
 */
export default function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facing, setFacing] = useState<Facing>('environment');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shot, setShot] = useState<{ url: string; file: File } | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setReady(false);
      setError(null);
      stop();

      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t('camera.unavailable'));
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tk) => tk.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (e) {
        const name = e instanceof DOMException ? e.name : '';
        setError(name === 'NotFoundError' ? t('camera.unavailable') : t('camera.denied'));
      }
    }

    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [facing, stop, t]);

  useEffect(() => {
    return () => {
      if (shot) URL.revokeObjectURL(shot.url);
    };
  }, [shot]);

  function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], 'photo-' + Date.now() + '.jpg', { type: 'image/jpeg' });
        setShot({ url: URL.createObjectURL(blob), file });
      },
      'image/jpeg',
      0.92
    );
  }

  function accept() {
    if (!shot) return;
    stop();
    onCapture(shot.file);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-3 py-3 text-white">
        <button
          type="button"
          onClick={() => {
            stop();
            onClose();
          }}
          aria-label={t('nav.close')}
          className="grid h-11 w-11 place-items-center rounded-full bg-white/10"
        >
          <Icon name="plus" className="h-5 w-5 rotate-45" strokeWidth={2.4} />
        </button>

        {!shot && !error && (
          <button
            type="button"
            onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
            aria-label={t('camera.switch')}
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10"
          >
            <Icon name="camera" className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="relative flex-1 overflow-hidden">
        {/* The video stays mounted and the review sits on top of it. Swapping
            the two out would hand React a fresh <video> on every retake, with
            no stream attached — the shutter then silently did nothing. */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={'h-full w-full object-cover ' + (shot ? 'invisible' : '')}
        />

        {shot && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shot.url}
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}

        {!ready && !shot && !error && (
          <p className="absolute inset-0 grid place-items-center text-sm text-white/80">
            {t('camera.starting')}
          </p>
        )}

        {error && (
          <div className="absolute inset-0 grid place-items-center p-6">
            <p className="rounded-2xl bg-white/95 p-4 text-center text-sm font-medium text-slate-800">
              {error}
            </p>
          </div>
        )}
      </div>

      <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-5">
        {shot ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(shot.url);
                setShot(null);
              }}
              className="flex-1 rounded-2xl border-2 border-white/30 px-4 py-3.5 text-base font-bold text-white"
            >
              {t('camera.retake')}
            </button>
            <button
              type="button"
              onClick={accept}
              className="flex-1 rounded-2xl bg-brand-600 px-4 py-3.5 text-base font-bold text-white"
            >
              {t('camera.use')}
            </button>
          </div>
        ) : (
          !error && (
            <button
              type="button"
              onClick={takePhoto}
              disabled={!ready}
              aria-label={t('camera.shutter')}
              className="mx-auto grid h-20 w-20 place-items-center rounded-full border-4 border-white/60 disabled:opacity-40"
            >
              <span className="h-16 w-16 rounded-full bg-white" />
            </button>
          )
        )}
      </div>
    </div>
  );
}
