/** GaonConnect mark: a leaf sheltering a house. */
export default function Logo({
  className = 'h-9 w-9',
  withWordmark = false,
  tagline,
  name = 'GaonConnect',
}: {
  className?: string;
  withWordmark?: boolean;
  tagline?: string;
  name?: string;
}) {
  const mark = (
    <span className={'grid shrink-0 place-items-center rounded-xl bg-brand-600 ' + className}>
      <svg viewBox="0 0 24 24" className="h-[62%] w-[62%]" aria-hidden="true">
        <path
          d="M20 4c0 7.5-4.2 11.5-9.5 11.5H8V13c0-5 4.4-9 12-9z"
          fill="none"
          stroke="#fff"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M4 20v-5.2L8.5 11 13 14.8V20z"
          fill="#fff"
        />
      </svg>
    </span>
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
