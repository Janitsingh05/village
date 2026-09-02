'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import hi from '@/public/locales/hi.json';
import en from '@/public/locales/en.json';
import { LANGUAGES, TRANSLATED, type Lang } from './languages';

export type { Lang };

/**
 * The dictionaries that exist today ship with the app; the rest are fetched.
 *
 * The bundle argument cuts both ways and the line is at two. Inlining eleven
 * languages would put ~180 KB of text nobody reads into the first paint of a 3G
 * page — but making the header toggle wait on a network round trip turns an
 * instant switch into a second of nothing happening, on the connection least
 * able to afford it, and reads as a broken button.
 *
 * So Hindi and English are both bundled: Hindi because `t()` has to answer
 * synchronously from the first render and is what every missing key falls
 * through to, English because switching to it has to feel immediate. A twelfth
 * language is fetched from `public/locales/` and cached by the service worker,
 * and this comment is the reason to keep it that way rather than adding each
 * new one to the bundle.
 */
const FALLBACK: Lang = 'hi';
const STORAGE_KEY = 'gaonconnect:lang';
export const DEFAULT_LANG: Lang = 'hi';

type Dict = Record<string, unknown>;

/** Bundled up front, fetched ones added as they land; kept for the tab's life. */
const loaded = new Map<Lang, Dict>([
  [FALLBACK, hi as Dict],
  ['en', en as Dict],
]);
const inFlight = new Map<Lang, Promise<Dict | null>>();

async function loadDict(lang: Lang): Promise<Dict | null> {
  const cached = loaded.get(lang);
  if (cached) return cached;

  const running = inFlight.get(lang);
  if (running) return running;

  const request = fetch('/locales/' + lang + '.json', { cache: 'force-cache' })
    .then((res) => (res.ok ? (res.json() as Promise<Dict>) : null))
    .then((dict) => {
      if (dict) loaded.set(lang, dict);
      return dict;
    })
    .catch(() => null)
    .finally(() => inFlight.delete(lang));

  inFlight.set(lang, request);
  return request;
}

type Vars = Record<string, string | number>;

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Look up a dotted key, e.g. t('report.submit'). Falls back to Hindi, then the key. */
  t: (key: string, vars?: Vars) => string;
  /** Languages with a dictionary, for the header toggle and the welcome screen. */
  available: Lang[];
  /** True while a chosen language is still being fetched. */
  loading: boolean;
}

const I18nContext = createContext<I18nValue | null>(null);

function lookup(dict: unknown, key: string): string | null {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return null;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : null;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    name in vars ? String(vars[name]) : whole
  );
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Always start at the default so server and client markup agree; the stored
  // preference is applied after mount.
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);
  // Bumped when a fetched dictionary lands, to re-render with the new strings.
  // The dictionaries themselves live in a module-level map: two providers would
  // otherwise each fetch their own copy of the same file.
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && (TRANSLATED as string[]).includes(saved)) setLangState(saved as Lang);
    } catch {
      /* private mode — stay on the default */
    }
  }, []);

  // Fetch whatever is selected but not yet in hand. Until it lands, `t` answers
  // from Hindi, so the page renders in the fallback for a moment rather than
  // flashing raw keys.
  useEffect(() => {
    if (loaded.has(lang)) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    void loadDict(lang).then((dict) => {
      if (!alive) return;
      setLoading(false);
      if (dict) setRevision((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [lang]);

  useEffect(() => {
    const info = LANGUAGES[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = info?.rtl ? 'rtl' : 'ltr';
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    // Start the fetch before the state change, so the new dictionary is
    // usually in hand by the time React re-renders with it.
    void loadDict(next);
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* preference just won't persist */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Vars) => {
      const dict = loaded.get(lang);
      const hit = (dict && lookup(dict, key)) ?? lookup(hi, key);
      return hit ? interpolate(hit, vars) : key;
    },
    // `revision` is not read here, but a landed dictionary has to produce a new
    // `t` identity or memoised consumers keep rendering the old language.
    [lang, revision]
  );

  const value = useMemo(
    () => ({ lang, setLang, t, available: TRANSLATED, loading }),
    [lang, setLang, t, loading]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <LanguageProvider>');
  return ctx;
}

/** Warms a dictionary before it is selected — the welcome screen uses this. */
export function preloadLanguage(lang: Lang): void {
  void loadDict(lang);
}
