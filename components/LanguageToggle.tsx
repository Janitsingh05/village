'use client';

import { useI18n, type Lang } from '@/lib/i18n';

const OPTIONS: { id: Lang; label: string; aria: string }[] = [
  { id: 'hi', label: 'हिंदी', aria: 'हिंदी' },
  { id: 'en', label: 'EN', aria: 'English' },
];

/**
 * Two-state pill. Both labels are always readable, so someone who cannot read
 * the language currently in use can still find their own.
 */
export default function LanguageToggle({
  tone = 'light',
  className = '',
}: {
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const { lang, setLang } = useI18n();

  const track =
    tone === 'dark' ? 'bg-white/15' : 'bg-slate-100 ring-1 ring-slate-200';
  const active =
    tone === 'dark' ? 'bg-white text-brand-800' : 'bg-brand-600 text-white shadow-sm';
  const idle = tone === 'dark' ? 'text-white/75' : 'text-slate-500';

  return (
    <div className={'flex shrink-0 items-center rounded-full p-1 ' + track + ' ' + className} role="group">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => setLang(opt.id)}
          aria-pressed={lang === opt.id}
          aria-label={opt.aria}
          className={
            'rounded-full px-3.5 py-1.5 text-sm font-bold transition ' +
            (lang === opt.id ? active : idle)
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
