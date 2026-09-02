/**
 * The languages this app can speak, and which one a place speaks.
 *
 * Two rules shape everything here.
 *
 * A language is named in its own script and nowhere else. Writing "Tamil" in
 * Latin letters helps exactly the people who did not need help; a reader who
 * only knows Tamil finds their language by recognising தமிழ், the way they
 * recognise a shop sign. So `endonym` is the label, always.
 *
 * And a language is only offered once it has a dictionary. Half a translation
 * is worse than none — a screen that starts in Tamil and finishes in Hindi
 * reads as broken software, and this app asks people to trust it with a
 * complaint about their own village. `hasDictionary` is the gate, and
 * `npm run locales` reports what is still missing.
 */

export type Lang =
  | 'hi'
  | 'en'
  | 'mr'
  | 'bn'
  | 'ta'
  | 'te'
  | 'gu'
  | 'kn'
  | 'ml'
  | 'pa'
  | 'or'
  | 'as'
  | 'ur';

export interface LanguageInfo {
  code: Lang;
  /** The name of the language, written in that language. The only useful label. */
  endonym: string;
  /** BCP-47 tag, for <html lang>, Intl date formatting and geocoder queries. */
  tag: string;
  /**
   * A shorter label for the header toggle, where width is scarce. Only English
   * has a conventional abbreviation; every Indic endonym is already short.
   */
  short?: string;
  /** Right-to-left scripts need `dir` set or the whole page reads backwards. */
  rtl?: boolean;
}

/**
 * Eleven languages cover roughly 95% of rural India. The rest of the list is
 * not a promise — it is the shape a dictionary has to fit when someone writes
 * one, so that adding a language is dropping a file in `public/locales/`.
 */
export const LANGUAGES: Record<Lang, LanguageInfo> = {
  hi: { code: 'hi', endonym: 'हिंदी', tag: 'hi-IN' },
  en: { code: 'en', endonym: 'English', tag: 'en-IN', short: 'EN' },
  mr: { code: 'mr', endonym: 'मराठी', tag: 'mr-IN' },
  bn: { code: 'bn', endonym: 'বাংলা', tag: 'bn-IN' },
  ta: { code: 'ta', endonym: 'தமிழ்', tag: 'ta-IN' },
  te: { code: 'te', endonym: 'తెలుగు', tag: 'te-IN' },
  gu: { code: 'gu', endonym: 'ગુજરાતી', tag: 'gu-IN' },
  kn: { code: 'kn', endonym: 'ಕನ್ನಡ', tag: 'kn-IN' },
  ml: { code: 'ml', endonym: 'മലയാളം', tag: 'ml-IN' },
  pa: { code: 'pa', endonym: 'ਪੰਜਾਬੀ', tag: 'pa-IN' },
  or: { code: 'or', endonym: 'ଓଡ଼ିଆ', tag: 'or-IN' },
  as: { code: 'as', endonym: 'অসমীয়া', tag: 'as-IN' },
  ur: { code: 'ur', endonym: 'اردو', tag: 'ur-IN', rtl: true },
};

/**
 * Languages with a dictionary in `public/locales/`, so they can actually be
 * offered. Adding one here without adding the file leaves users staring at
 * untranslated keys, so the two go together.
 */
export const TRANSLATED: Lang[] = ['hi', 'en', 'mr'];

export function hasDictionary(code: Lang): boolean {
  return TRANSLATED.includes(code);
}

/**
 * The everyday language of each state and union territory.
 *
 * A state is not a language, and this list rounds off real edges: Goa also
 * speaks Marathi, Bihar's villages speak Bhojpuri and Maithili long before
 * they speak textbook Hindi, and Manipur's hills and valley do not share a
 * tongue at all. It is a starting guess that saves most people a decision —
 * never a claim about what someone speaks. The picker always offers English
 * beside it, and the toggle in the header changes it forever after.
 *
 * The four states left on English are not an oversight: Nagaland, Meghalaya,
 * Mizoram and Arunachal Pradesh conduct official business in English, and each
 * holds dozens of languages with no single dominant one.
 */
export const STATE_LANGUAGE: Record<string, Lang> = {
  'Andhra Pradesh': 'te',
  'Arunachal Pradesh': 'en',
  Assam: 'as',
  Bihar: 'hi',
  Chhattisgarh: 'hi',
  Goa: 'mr',
  Gujarat: 'gu',
  Haryana: 'hi',
  'Himachal Pradesh': 'hi',
  Jharkhand: 'hi',
  Karnataka: 'kn',
  Kerala: 'ml',
  'Madhya Pradesh': 'hi',
  Maharashtra: 'mr',
  Manipur: 'en',
  Meghalaya: 'en',
  Mizoram: 'en',
  Nagaland: 'en',
  Odisha: 'or',
  Punjab: 'pa',
  Rajasthan: 'hi',
  Sikkim: 'hi',
  'Tamil Nadu': 'ta',
  Telangana: 'te',
  Tripura: 'bn',
  'Uttar Pradesh': 'hi',
  Uttarakhand: 'hi',
  'West Bengal': 'bn',
  'Andaman and Nicobar Islands': 'hi',
  Chandigarh: 'pa',
  'Dadra and Nagar Haveli and Daman and Diu': 'gu',
  Delhi: 'hi',
  'Jammu and Kashmir': 'ur',
  Ladakh: 'hi',
  Lakshadweep: 'ml',
  Puducherry: 'ta',
};

/** Loose match, because a geocoder may return "Rajasthan" or "राजस्थान". */
const ALIASES: Record<string, string> = {
  राजस्थान: 'Rajasthan',
  'उत्तर प्रदेश': 'Uttar Pradesh',
  बिहार: 'Bihar',
  'मध्य प्रदेश': 'Madhya Pradesh',
  महाराष्ट्र: 'Maharashtra',
  गुजरात: 'Gujarat',
  पंजाब: 'Punjab',
  हरियाणा: 'Haryana',
  झारखंड: 'Jharkhand',
  छत्तीसगढ़: 'Chhattisgarh',
  उत्तराखंड: 'Uttarakhand',
  'हिमाचल प्रदेश': 'Himachal Pradesh',
  दिल्ली: 'Delhi',
  'पश्चिम बंगाल': 'West Bengal',
  ओडिशा: 'Odisha',
  केरल: 'Kerala',
  कर्नाटक: 'Karnataka',
  'तमिलनाडु': 'Tamil Nadu',
  तेलंगाना: 'Telangana',
  'आंध्र प्रदेश': 'Andhra Pradesh',
  असम: 'Assam',
};

/**
 * The language a state most likely speaks, or null when nothing matched.
 *
 * Returns the language whether or not it has been translated yet — deciding
 * what to do about that belongs to the screen doing the asking, which can say
 * "not ready yet" rather than silently pretending the state speaks Hindi.
 */
export function localLanguageFor(state: string): Lang | null {
  const raw = (state || '').trim();
  if (!raw) return null;

  const canonical = ALIASES[raw] || raw;
  if (canonical in STATE_LANGUAGE) return STATE_LANGUAGE[canonical];

  // Geocoders return "Rajasthan", "State of Rajasthan", "राजस्थान, भारत" and
  // worse, so fall back to a contains match before giving up.
  const lower = canonical.toLowerCase();
  const hit = Object.keys(STATE_LANGUAGE).find(
    (s) => lower.includes(s.toLowerCase()) || s.toLowerCase().includes(lower)
  );
  return hit ? STATE_LANGUAGE[hit] : null;
}

/**
 * What to offer someone standing in a given state: their own language first
 * when it exists, English second because it is the one that travels.
 *
 * Hindi stands in when the local language has no dictionary yet — not because
 * it is anyone's local language there, but because it is the app's fallback
 * and half of India can read it. The screen says as much rather than
 * pretending otherwise.
 */
export function languageChoicesFor(state: string): {
  options: Lang[];
  /** The local language, when it exists but has not been translated yet. */
  pending: Lang | null;
} {
  const local = localLanguageFor(state);

  if (local && hasDictionary(local)) {
    return { options: local === 'en' ? ['en', 'hi'] : [local, 'en'], pending: null };
  }

  return { options: ['hi', 'en'], pending: local && local !== 'en' ? local : null };
}
