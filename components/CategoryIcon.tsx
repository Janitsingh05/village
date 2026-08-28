import type { CategoryId } from '@/lib/types';

/** Pastel tile + line glyph per category, as in the design spec. */
const TONES: Record<CategoryId, string> = {
  drain: 'bg-sky-50 text-sky-500',
  road: 'bg-orange-50 text-orange-500',
  streetlight: 'bg-amber-50 text-amber-500',
  water: 'bg-cyan-50 text-cyan-500',
  electricity: 'bg-rose-50 text-rose-500',
  garbage: 'bg-brand-50 text-brand-600',
  public_property: 'bg-violet-50 text-violet-500',
  other: 'bg-slate-100 text-slate-500',
};

const GLYPHS: Record<CategoryId, React.ReactNode> = {
  drain: (
    <>
      <path d="M3 7h18M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7" />
      <path d="M8 11v5M12 11v5M16 11v5" />
    </>
  ),
  road: (
    <>
      <path d="M6 21L9 3M18 21l-3-18" />
      <path d="M12 5v3M12 11v3M12 17v3" />
    </>
  ),
  streetlight: (
    <>
      <path d="M9 22h6M12 22V9" />
      <path d="M7.5 9h9l-1.6-4.2a1 1 0 0 0-.9-.8h-4a1 1 0 0 0-.9.8z" />
      <path d="M10 12.5l-1.5 2M14 12.5l1.5 2" />
    </>
  ),
  water: (
    <>
      <path d="M12 3s5 5.4 5 9a5 5 0 0 1-10 0c0-3.6 5-9 5-9z" />
    </>
  ),
  electricity: <path d="M13 2L4.5 13.5H11l-1 8.5 8.5-11.5H12z" />,
  garbage: (
    <>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  public_property: (
    <>
      <path d="M3 10l9-6 9 6" />
      <path d="M5 10v9M19 10v9M9 10v9M15 10v9M3 20h18" />
    </>
  ),
  other: (
    <>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
};

export default function CategoryIcon({
  id,
  size = 'md',
  className = '',
}: {
  id: CategoryId;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const box = size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  const glyph = size === 'lg' ? 'h-7 w-7' : size === 'sm' ? 'h-[18px] w-[18px]' : 'h-5 w-5';

  return (
    <span className={'grid shrink-0 place-items-center rounded-2xl ' + (className || box) + ' ' + TONES[id]}>
      <svg
        viewBox="0 0 24 24"
        className={glyph}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {GLYPHS[id]}
      </svg>
    </span>
  );
}
