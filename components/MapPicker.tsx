'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import Icon from '@/components/Icon';
import { useI18n } from '@/lib/i18n';

/**
 * A map the reporter can put a pin on.
 *
 * The existing `mapEmbedUrl()` iframe can show a point and nothing else — an
 * iframe from another origin cannot hand back where somebody dragged to, so
 * "open the map and pick your street" was not possible with it. This is the
 * same map rendered inside the page, so the drag is an event we can read.
 *
 * Leaflet with OpenStreetMap tiles rather than Google: no API key, no billing
 * account, and about a third of the Google SDK's weight — which matters on a
 * page that already ships ~300 kB before the map arrives.
 *
 * Loaded dynamically for the same reason. Nothing here belongs in the chunk
 * that has to land before the first screen paints on a 3G phone, and most
 * reporters never open the map at all: GPS answers first, and the ward list
 * answers when GPS is refused.
 */

export interface MapPickerProps {
  /** Where to open. The village's own coordinates are the right default. */
  center: { lat: number; lng: number };
  /** The pin's current position, if one has been placed. */
  value?: { lat: number; lng: number } | null;
  onChange: (at: { lat: number; lng: number }) => void;
  /** Tighter for confirming a village, looser for finding a handpump. */
  zoom?: number;
  className?: string;
}

export default function MapPicker({
  center,
  value,
  onChange,
  zoom = 15,
  className = '',
}: MapPickerProps) {
  const { t } = useI18n();
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<import('leaflet').Map | null>(null);
  const pin = useRef<import('leaflet').Marker | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  // Read inside a mount-only effect, so the values are the ones at mount
  // without making the effect depend on objects the parent recreates each
  // render — which would tear the map down under the reporter's finger.
  const initial = useRef({ center, value, zoom, onChange });
  initial.current.onChange = onChange;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { default: L } = await import('leaflet');
        if (cancelled || !holder.current) return;

        const start = initial.current.value ?? initial.current.center;
        const instance = L.map(holder.current, {
          center: [start.lat, start.lng],
          zoom: initial.current.zoom,
          // A map inside a scrolling form must not swallow the scroll. Two
          // fingers pan it, which is the platform convention and the only way
          // a one-thumb reporter gets past it.
          scrollWheelZoom: false,
          zoomControl: true,
          attributionControl: true,
        });

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          // Required by the OSM tile usage policy, and it stays on screen.
          attribution: '&copy; OpenStreetMap',
        }).addTo(instance);

        // A CSS pin rather than Leaflet's own marker image. The default icon
        // resolves its PNG relative to the stylesheet, which a bundler moves,
        // and the usual fix is to hand-wire three image paths. A div needs no
        // paths, weighs nothing, and can be the brand colour.
        const icon = L.divIcon({
          className: '',
          html:
            '<span style="display:block;width:22px;height:22px;border-radius:9999px;' +
            'background:#146b3f;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></span>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const marker = L.marker([start.lat, start.lng], { icon, draggable: true }).addTo(instance);

        const report = (at: { lat: number; lng: number }) =>
          initial.current.onChange({
            lat: Number(at.lat.toFixed(6)),
            lng: Number(at.lng.toFixed(6)),
          });

        marker.on('dragend', () => report(marker.getLatLng()));
        // Tapping is easier than dragging for someone who has not used a map
        // before, so both place the pin.
        instance.on('click', (e: import('leaflet').LeafletMouseEvent) => {
          marker.setLatLng(e.latlng);
          report(e.latlng);
        });

        map.current = instance;
        pin.current = marker;
        setState('ready');
      } catch {
        // No map is a degraded form, not a broken one: GPS and the ward list
        // both still work, so say so instead of leaving a grey box.
        if (!cancelled) setState('failed');
      }
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      pin.current = null;
    };
  }, []);

  // Follow a position set from outside — the GPS button, or a village picked
  // from the pincode list.
  useEffect(() => {
    if (!value || !map.current || !pin.current) return;
    pin.current.setLatLng([value.lat, value.lng]);
    map.current.setView([value.lat, value.lng], map.current.getZoom());
  }, [value?.lat, value?.lng]);

  if (state === 'failed') {
    return (
      <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {t('map.unavailable')}
      </p>
    );
  }

  return (
    <div className={'relative overflow-hidden rounded-3xl shadow-card ' + className}>
      <div ref={holder} className="h-64 w-full bg-slate-100" />
      {state === 'loading' && (
        <p className="absolute inset-0 grid place-items-center text-sm text-slate-500">
          {t('map.loading')}
        </p>
      )}
      {state === 'ready' && (
        <p className="pointer-events-none absolute left-3 right-3 top-3 z-[1000] flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-card">
          <Icon name="pin" className="h-4 w-4 shrink-0 text-brand-700" />
          {t('map.dragHint')}
        </p>
      )}
    </div>
  );
}
