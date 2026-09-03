import type { CategoryId } from '@/lib/types';

/**
 * Full-colour category marks, drawn rather than cropped.
 *
 * These follow the mockup: a blue drain grate over water, a dark road with
 * orange edges and a crack down it, a lamp post throwing yellow light, a water
 * drop with a ripple, a crimson bolt, a green bin, a purple public building.
 *
 * Drawn as SVG instead of cut out of the reference image for three reasons that
 * all matter more here than usual. Eight PNG crops would be eight more requests
 * on a 3G connection, on the screen a villager reaches first. They would be
 * fixed-resolution, and this app is used at every zoom level from a cheap 320px
 * phone to a desktop the secretary uses. And a picture of an icon cannot adapt
 * to a dark theme, while a shape with its own colours can sit on either ground.
 *
 * Colour is deliberate here and not decoration: for someone who does not read,
 * these tiles *are* the form, and the colour is half of what makes one tile
 * different from the next at a glance.
 */
const GLYPHS: Record<CategoryId, React.ReactNode> = {
  // A storm grate with water running beneath it.
  drain: (
    <>
      <path d="M4.4 8.2h15.2l-1.9 6.1a1.2 1.2 0 0 1-1.1.8H7.4a1.2 1.2 0 0 1-1.1-.8z" fill="#60a5fa" />
      <path d="M3.4 6.2h17.2a1 1 0 0 1 0 2H3.4a1 1 0 0 1 0-2z" fill="#2563eb" />
      <g stroke="#eff6ff" strokeWidth="1.5" strokeLinecap="round">
        <path d="M8 9.6v3.6M11 9.6v3.6M14 9.6v3.6M17 9.6v3.6" />
      </g>
      <g stroke="#38bdf8" strokeWidth="1.3" strokeLinecap="round" fill="none">
        <path d="M4.5 17c1.4-1 2.6-1 4 0s2.6 1 4 0 2.6-1 4 0" />
        <path d="M4.5 20c1.4-1 2.6-1 4 0s2.6 1 4 0 2.6-1 4 0" />
      </g>
    </>
  ),

  // Tarmac narrowing into the distance, edged in orange, split by a crack.
  road: (
    <>
      <path d="M8.6 3h6.8l3.4 18H5.2z" fill="#3f3f46" />
      <path d="M8.6 3h1.5L7.4 21H5.2zM15.4 3h-1.5l2.7 18h2.2z" fill="#f59e0b" />
      <g stroke="#fafafa" strokeWidth="1.2" strokeLinecap="round">
        <path d="M11.85 5.2h.3M11.75 9.2h.5M11.6 13.2h.8" />
      </g>
      <path
        d="M12.9 14.4l-2.1 1.7 2 1.4-1.6 1.9"
        fill="none"
        stroke="#e4e4e7"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),

  // A lamp head on a post, with the light it is supposed to be throwing.
  streetlight: (
    <>
      {/* Centred and symmetric, and down to four shapes.
          Two attempts failed here for the same reason: a post, a base, an arm,
          a housing, a bulb and five rays is a fine drawing at 200px and an
          unreadable smudge at the 20px this actually renders at. What survives
          is the silhouette — a lamp on a pole, throwing light. */}
      <path d="M12 8.5V20" fill="none" stroke="#27272a" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8.6 20h6.8" fill="none" stroke="#27272a" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M7.6 3.4h8.8a1 1 0 0 1 .95 1.3l-1.1 3.4H7.75L6.65 4.7a1 1 0 0 1 .95-1.3z" fill="#3f3f46" />
      <path d="M9.3 8.1h5.4l-1.5 3.1h-2.4z" fill="#fde047" />
    </>
  ),

  // A drop with the ripple it lands in.
  water: (
    <>
      <path
        d="M12 2.6c3.4 4 5.4 6.7 5.4 9.3a5.4 5.4 0 0 1-10.8 0c0-2.6 2-5.3 5.4-9.3z"
        fill="#3b82f6"
      />
      <path d="M9.8 12.4c0 1.6 1 2.7 2.4 3" fill="none" stroke="#bfdbfe" strokeWidth="1.4" strokeLinecap="round" />
      <g fill="none" stroke="#60a5fa" strokeWidth="1.3" strokeLinecap="round">
        <path d="M5.6 18.6c1.8 1.2 11 1.2 12.8 0" />
        <path d="M3.6 21c3 1.5 13.8 1.5 16.8 0" />
      </g>
    </>
  ),

  electricity: (
    <>
      <path d="M13.6 2.4L5.8 13.1h4.9L9.8 21.6l8.4-11.2h-5.2z" fill="#e11d48" />
      <path d="M13.6 2.4L5.8 13.1h3.1l6-10.7z" fill="#f43f5e" />
    </>
  ),

  // A bin with its lid and handle.
  garbage: (
    <>
      <path d="M5.9 7.4h12.2l-1 12.1a1.6 1.6 0 0 1-1.6 1.5H8.5a1.6 1.6 0 0 1-1.6-1.5z" fill="#22c55e" />
      <path d="M4.4 5.4h15.2a.9.9 0 0 1 0 1.9H4.4a.9.9 0 0 1 0-1.9z" fill="#16a34a" />
      <path d="M9.6 3h4.8a.9.9 0 0 1 .9.9v1.5H8.7V3.9a.9.9 0 0 1 .9-.9z" fill="#16a34a" />
      <g stroke="#dcfce7" strokeWidth="1.2" strokeLinecap="round">
        <path d="M9.8 10.6v6.4M12 10.6v6.4M14.2 10.6v6.4" />
      </g>
    </>
  ),

  // A pillared building — the panchayat bhavan, the school, the dispensary.
  public_property: (
    <>
      <path d="M12 2.6l9 4.6H3z" fill="#7c3aed" />
      <path d="M2.6 19.4h18.8a.9.9 0 0 1 0 1.9H2.6a.9.9 0 0 1 0-1.9z" fill="#6d28d9" />
      <path d="M3.4 8.4h17.2v1.5H3.4z" fill="#6d28d9" />
      <g fill="#8b5cf6">
        <rect x="5.4" y="10.4" width="2.6" height="8.2" rx=".5" />
        <rect x="10.7" y="10.4" width="2.6" height="8.2" rx=".5" />
        <rect x="16" y="10.4" width="2.6" height="8.2" rx=".5" />
      </g>
    </>
  ),

  other: (
    <g fill="#52525b">
      <circle cx="6.6" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="17.4" cy="12" r="1.9" />
    </g>
  ),
};

/** The tile behind each mark, pitched to sit under its colour without fighting it. */
const TONES: Record<CategoryId, string> = {
  drain: 'bg-sky-50',
  road: 'bg-orange-50',
  streetlight: 'bg-amber-50',
  water: 'bg-blue-50',
  electricity: 'bg-rose-50',
  garbage: 'bg-green-50',
  public_property: 'bg-violet-50',
  other: 'bg-slate-100',
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
  const glyph = size === 'lg' ? 'h-8 w-8' : size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';

  return (
    <span
      className={'grid shrink-0 place-items-center rounded-2xl ' + (className || box) + ' ' + TONES[id]}
    >
      {/* No stroke or fill on the svg itself: every shape below carries its own
          colour, which is what lets one tile read as different from the next
          for someone using these instead of the labels. */}
      <svg viewBox="0 0 24 24" className={glyph} aria-hidden="true">
        {GLYPHS[id]}
      </svg>
    </span>
  );
}
