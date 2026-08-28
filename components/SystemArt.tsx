/** Super-admin hero: someone managing the system from a laptop. Decorative. */
export default function SystemArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 160" className={className} aria-hidden="true">
      <ellipse cx="120" cy="140" rx="86" ry="12" fill="#d6f5e3" />

      {/* desk */}
      <rect x="52" y="118" width="136" height="7" rx="3.5" fill="#aee9c8" />

      {/* laptop */}
      <path d="M84 118V92a4 4 0 0 1 4-4h44a4 4 0 0 1 4 4v26z" fill="#146b3f" />
      <path d="M88 92h40v22H88z" fill="#eefbf3" />
      <rect x="76" y="115" width="68" height="6" rx="3" fill="#0f462d" />

      {/* person */}
      <circle cx="150" cy="72" r="13" fill="#f0c9a8" />
      <path d="M137 70c0-9 6-14 13-14s13 5 13 13c-4-4-8-5-13-5s-9 2-13 6z" fill="#3f3a35" />
      <path d="M132 118c0-14 8-24 18-24s18 10 18 24z" fill="#22a35f" />
      <path d="M136 104c-6 3-9 8-9 14h9z" fill="#17864c" />

      {/* floating panels */}
      <g opacity="0.9">
        <rect x="40" y="44" width="40" height="28" rx="6" fill="#fff" stroke="#aee9c8" strokeWidth="2" />
        <path d="M48 62l7-8 6 7 5-5" stroke="#22a35f" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="176" y="34" width="34" height="34" rx="8" fill="#fff" stroke="#aee9c8" strokeWidth="2" />
        <path d="M186 51h14M193 44v14" stroke="#22a35f" strokeWidth="2.4" strokeLinecap="round" />
      </g>

      {/* padlock badge */}
      <g>
        <rect x="196" y="86" width="26" height="22" rx="5" fill="#146b3f" />
        <path d="M203 86v-4a6 6 0 0 1 12 0v4" fill="none" stroke="#146b3f" strokeWidth="3" />
        <circle cx="209" cy="96" r="2.6" fill="#fff" />
      </g>
    </svg>
  );
}
