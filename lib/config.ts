import type { Category, ComplaintStatus } from './types';
import type { Lang } from './i18n';

/**
 * Phase 1 runs against a single hardcoded pilot village.
 * Phase 2 swaps this for a value resolved from the URL / logged-in user.
 */
export const VILLAGE_ID = process.env.NEXT_PUBLIC_VILLAGE_ID || 'pilot-village';

/**
 * Where this deployment lives, for absolute URLs in share cards.
 *
 * Open Graph images have to be absolute — a relative path in a WhatsApp preview
 * resolves against nothing and the card comes back blank.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://village-psi-eight.vercel.app';

/**
 * How long a complaint's description may be, everywhere.
 *
 * It lived in app/report/page.tsx and the voice flow never saw it, so a spoken
 * complaint went to Firestore uncapped against a rule that stops at 200 — and
 * thirty seconds of speech is three hundred characters. The flow built for
 * people who cannot type was failing for the people who used it most.
 */
export const DESC_MAX = 200;

/**
 * An Indian mobile number: ten digits starting 6, 7, 8 or 9.
 *
 * The form used to accept any ten digits, so 0000000000 went through, and the
 * rules only capped the length — which meant a direct API write could put
 * anything at all into a field the UI renders as a tel: link. Both sides now
 * use this shape.
 */
export const PHONE_RE = /^[6-9][0-9]{9}$/;

export function isValidPhone(raw: string): boolean {
  return PHONE_RE.test((raw || '').replace(/\D/g, '').slice(-10));
}

/** Injected from package.json by next.config.js. */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0';

export const VILLAGE = {
  id: VILLAGE_ID,
  nameHi: process.env.NEXT_PUBLIC_VILLAGE_NAME_HI || 'ग्राम पंचायत',
  nameEn: process.env.NEXT_PUBLIC_VILLAGE_NAME_EN || 'Gram Panchayat',
  districtHi: process.env.NEXT_PUBLIC_VILLAGE_DISTRICT_HI || '',
  districtEn: process.env.NEXT_PUBLIC_VILLAGE_DISTRICT_EN || '',
};

export function villageName(lang: Lang): string {
  return lang === 'en' ? VILLAGE.nameEn : VILLAGE.nameHi;
}

export function villageDistrict(lang: Lang): string {
  return (lang === 'en' ? VILLAGE.districtEn : VILLAGE.districtHi) || VILLAGE.districtHi;
}

function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);
}

/** Wards / blocks a citizen can pick when GPS is unavailable or denied. */
const WARDS_HI = splitList(
  process.env.NEXT_PUBLIC_WARDS ||
    'वार्ड 1,वार्ड 2,वार्ड 3,वार्ड 4,वार्ड 5,मुख्य बाज़ार,स्कूल के पास,मंदिर के पास'
);

/**
 * English labels for the same wards, matched by position.
 *
 * Defaulted here rather than left to an environment variable: a host that was
 * configured before this existed would otherwise show Devanagari ward names in
 * English mode, and that drift is invisible until someone switches language.
 * NEXT_PUBLIC_WARDS_EN still overrides, for a village with its own names.
 */
const WARDS_EN = splitList(
  process.env.NEXT_PUBLIC_WARDS_EN ||
    'Ward 1,Ward 2,Ward 3,Ward 4,Ward 5,Main Market,Near the School,Near the Temple'
);

export const WARDS = WARDS_HI;

/**
 * The stored value is always the Hindi ward name, so switching language never
 * changes what a complaint actually points at — only how it is displayed.
 */
export function wardOptions(lang: Lang): { value: string; label: string }[] {
  return WARDS_HI.map((value, i) => ({
    value,
    label: lang === 'en' && WARDS_EN[i] ? WARDS_EN[i] : value,
  }));
}

export function wardLabel(value: string, lang: Lang): string {
  const i = WARDS_HI.indexOf(value);
  return lang === 'en' && i >= 0 && WARDS_EN[i] ? WARDS_EN[i] : value;
}

// Labels live in public/locales/*.json under "category.<id>"; only the id and
// its icon belong here.
export const CATEGORIES: Category[] = [
  { id: 'drain', emoji: '🚰' },
  { id: 'road', emoji: '🛣️' },
  { id: 'streetlight', emoji: '💡' },
  { id: 'water', emoji: '💧' },
  { id: 'electricity', emoji: '⚡' },
  { id: 'garbage', emoji: '🗑️' },
  { id: 'public_property', emoji: '🏛️' },
  { id: 'other', emoji: '📝' },
];

export function categoryOf(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

export const STATUS_ORDER: ComplaintStatus[] = ['pending', 'in_progress', 'resolved', 'closed'];

/** The steps drawn in the citizen-facing progress timeline. */
export const STATUS_TIMELINE: ComplaintStatus[] = [
  'pending',
  'in_progress',
  'resolved',
  'closed',
];

/**
 * Public reference for a complaint: GC-YYMMDD-NNNN, where the tail is derived
 * from the document id so it is stable without needing a counter document.
 */
/** Minutes to add to UTC for IST. Fixed, because India has no daylight saving. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * The reference a villager writes on paper and reads out over a phone.
 *
 * Two things had to change. The date stamp was built from the device's own
 * timezone, so the same complaint produced a different reference depending on
 * who was looking and when — near midnight, or on a phone with the wrong zone,
 * the printed reference no longer matched the stored one, and the lookup that
 * is a citizen's only recovery path found nothing. It is IST now, everywhere.
 *
 * And four digits was too narrow. Complaints filed on one day share the stamp,
 * so the tail is a birthday problem over 10,000 buckets: about a 7% chance of a
 * collision at 40 complaints in a day, 39% at 100. Since findComplaintByRef
 * takes the first match, a collision hands somebody a stranger's complaint.
 * Six digits puts 100 same-day complaints at roughly 0.5%.
 */
export function complaintRef(id: string, createdAt: number): string {
  const d = new Date(createdAt + IST_OFFSET_MS);
  const stamp =
    String(d.getUTCFullYear() % 100).padStart(2, '0') +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0');
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 1000000;
  return 'GC-' + stamp + '-' + String(hash).padStart(6, '0');
}

/** A villager can show the problem from a few angles without bloating the feed. */
export const MAX_PHOTOS = 3;
