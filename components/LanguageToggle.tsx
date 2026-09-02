'use client';

import { useI18n } from '@/lib/i18n';
import { LANGUAGES, type Lang } from '@/lib/languages';

function label(code: Lang): string {
  const info = LANGUAGES[code];
  return info.short || info.endonym;
}

/**
 * Switching language from anywhere in the app.
 *
 * A pill while there are two languages, because both labels stay visible and
 * someone who cannot read the one in use can still see their own. Past two it
 * becomes a native select — three Indic endonyms will not fit across a 360px
 * header, and the platform's own picker is the one control every low-end
 * Android renders properly and every screen reader already knows.
 */
export default function LanguageToggle({
  tone = 'light',
  className = '',
}: {
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const { lang, setLang, available } = useI18n();

  const track = tone === 'dark' ? 'bg-white/15' : 'bg-slate-100 ring-1 ring-slate-200';
  const active = tone === 'dark' ? 'bg-white text-brand-800' : 'bg-brand-600 text-white shadow-sm';
  const idle = tone === 'dark' ? 'text-white/75' : 'text-slate-500';

  if (available.length > 2) {
    return (
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label={LANGUAGES[lang].endonym}
        className={
          'shrink-0 appearance-none rounded-full px-3.5 py-1.5 text-sm font-bold ' +
          (tone === 'dark' ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700') +
          ' ' +
          className
        }
      >
        {available.map((code) => (
          <option key={code} value={code} lang={code}>
            {LANGUAGES[code].endonym}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div
      className={'flex shrink-0 items-center rounded-full p-1 ' + track + ' ' + className}
      role="group"
    >
      {available.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          aria-label={LANGUAGES[code].endonym}
          lang={code}
          className={
            'rounded-full px-3.5 py-1.5 text-sm font-bold transition ' +
            (lang === code ? active : idle)
          }
        >
          {label(code)}
        </button>
      ))}
    </div>
  );
}
