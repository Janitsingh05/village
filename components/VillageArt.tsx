/**
 * Hero illustration — inline SVG so it costs nothing extra to fetch and stays
 * crisp on every screen density. Purely decorative.
 */
export default function VillageArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 200" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="va-hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfe8cd" />
          <stop offset="100%" stopColor="#a5dcbb" />
        </linearGradient>
        <linearGradient id="va-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cdeed9" />
          <stop offset="100%" stopColor="#b6e5c8" />
        </linearGradient>
      </defs>

      {/* rolling hills */}
      <path d="M0 118c34-26 62-10 92-22s52-24 86-10 62 8 92-6v120H0z" fill="url(#va-hill)" />
      <path d="M0 146c40-20 74-4 112-12s70-20 108-8 66 6 100-4v78H0z" fill="url(#va-ground)" />

      {/* birds */}
      <g stroke="#6aa985" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7">
        <path d="M36 34c4-4 7-4 10 0M46 34c4-4 7-4 10 0" />
        <path d="M74 20c3-3 5-3 8 0M82 20c3-3 5-3 8 0" />
      </g>

      {/* water tower */}
      <g>
        <rect x="148" y="66" width="34" height="24" rx="5" fill="#7fc39c" />
        <rect x="148" y="66" width="34" height="8" rx="4" fill="#5fae83" />
        <path d="M154 90l4 40M176 90l-4 40M158 108h14" stroke="#5fae83" strokeWidth="3" strokeLinecap="round" />
        <path d="M165 56v10" stroke="#5fae83" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* trees */}
      <g>
        <circle cx="44" cy="120" r="20" fill="#79c096" />
        <rect x="41" y="132" width="6" height="20" rx="3" fill="#7d6a52" />
        <circle cx="290" cy="112" r="16" fill="#6fba8d" />
        <rect x="287" y="122" width="6" height="20" rx="3" fill="#7d6a52" />
        <circle cx="112" cy="128" r="13" fill="#8bcaa5" />
        <rect x="109" y="136" width="5" height="16" rx="2.5" fill="#7d6a52" />
      </g>

      {/* houses */}
      <g>
        <path d="M186 150v-30l26-18 26 18v30z" fill="#fbf6ec" />
        <path d="M180 122l32-22 32 22z" fill="#d98b62" />
        <rect x="204" y="130" width="16" height="20" rx="2" fill="#cfa87f" />
        <rect x="192" y="128" width="9" height="9" rx="1.5" fill="#9fcfb6" />

        <path d="M240 152v-22l20-14 20 14v22z" fill="#fbf6ec" />
        <path d="M236 131l24-17 24 17z" fill="#c97a55" />
        <rect x="253" y="138" width="13" height="14" rx="2" fill="#cfa87f" />

        <path d="M64 154v-20l18-13 18 13v20z" fill="#fbf6ec" />
        <path d="M60 135l22-16 22 16z" fill="#d98b62" />
        <rect x="75" y="142" width="12" height="12" rx="2" fill="#cfa87f" />
      </g>

      {/* foreground grass tufts */}
      <g stroke="#7cc099" strokeWidth="2.5" strokeLinecap="round" opacity="0.85">
        <path d="M22 172c2-6 4-8 4-12M28 172c1-5 3-7 5-10" />
        <path d="M132 178c2-6 4-8 4-12M138 178c1-5 3-7 5-10" />
        <path d="M300 168c2-6 4-8 4-12" />
      </g>
    </svg>
  );
}
