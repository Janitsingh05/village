'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import hi from '@/public/locales/hi.json';
import en from '@/public/locales/en.json';

export type Lang = 'hi' | 'en';

// Bundled rather than fetched: two small dictionaries cost less than an extra
// round trip on a rural connection.
const DICTS: Record<Lang, unknown> = { hi, en };
const STORAGE_KEY = 'gaonconnect:lang';
export const DEFAULT_LANG: Lang = 'hi';

type Vars = Record<string, string | number>;

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Look up a dotted key, e.g. t('report.submit'). Falls back to Hindi, then the key. */
  t: (key: string, vars?: Vars) => string;
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

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'hi' || saved === 'en') setLangState(saved);
    } catch {
      /* private mode — stay on the default */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* preference just won't persist */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Vars) => {
      const hit = lookup(DICTS[lang], key) ?? lookup(DICTS[DEFAULT_LANG], key);
      return hit ? interpolate(hit, vars) : key;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <LanguageProvider>');
  return ctx;
}
