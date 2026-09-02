'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import hi from '@/public/locales/hi.json';
import { LANGUAGES, TRANSLATED, type Lang } from './languages';

export type { Lang };

/**
 * Hindi is bundled; every other language is fetched.
 *
 * This used to bundle both dictionaries, on the reasoning that two small files
 * cost less than a round trip. That holds for two and stops holding at twelve —
 * eleven languages inlined would put ~180 KB of text nobody reads into the
 * first paint of a 3G page. So the fallback ships with the app, because `t()`
 * has to answer synchronously from the very first render, and the rest are
 * fetched from `public/locales/` and cached by the service worker.
 */
const FALLBACK: Lang = 'hi';
const STORAGE_KEY = 'gaonconnect:lang';
export const DEFAULT_LANG: Lang = 'hi';

type Dict = Record<string, unknown>;

/** Fetched dictionaries, kept for the life of the tab. */
const loaded = new Map<Lang, Dict>([[FALLBACK, hi as Dict]]);
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
    if (loaded.has(lang)) return;
    let alive = true;
    void loadDict(lang).then((dict) => {
      if (alive && dict) setRevision((n) => n + 1);
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
    () => ({ lang, setLang, t, available: TRANSLATED }),
    [lang, setLang, t]
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
