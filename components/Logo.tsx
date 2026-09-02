/* eslint-disable @next/next/no-img-element */

/**
 * The GaonConnect logo, in the two shapes `scripts/logo-assets.mjs` produces.
 *
 * `mark` is a crop of the artwork alone and is what belongs anywhere the logo
 * is small — a header, a drawer, a list row. `full` is the whole badge with its
 * wordmark baked in, for launch and login screens where it is large enough to
 * read; pair that one with `withWordmark` only when the layout needs the name
 * as selectable text too.
 */
export default function Logo({
  className = 'h-9 w-9',
  variant = 'mark',
  withWordmark = false,
  tagline,
  name = 'GaonConnect',
}: {
  className?: string;
  variant?: 'mark' | 'full';
  withWordmark?: boolean;
  tagline?: string;
  name?: string;
}) {
  const full = variant === 'full';
  const mark = (
    <img
      src={full ? '/logo.png' : '/logo-mark.png'}
      alt={withWordmark ? '' : name}
      // The intrinsic size of the generated file, so the box is reserved
      // before the bytes land instead of the header jumping on arrival.
      width={full ? 384 : 192}
      height={full ? 384 : 192}
      // The badge already carries its own rounded silhouette, so only the
      // cropped mark needs a radius of its own.
      className={'shrink-0 object-contain ' + (full ? '' : 'rounded-xl ') + className}
    />
  );

  if (!withWordmark) return mark;

  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {mark}
      <span className="min-w-0">
        <span className="block truncate text-base font-extrabold leading-tight text-slate-900">
          {name}
        </span>
        {tagline && (
          <span className="block truncate text-[11px] leading-tight text-slate-500">{tagline}</span>
        )}
      </span>
    </span>
  );
}
