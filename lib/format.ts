import { LANGUAGES } from './languages';
import type { Lang } from './i18n';

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function locale(lang: Lang): string {
  // Every language carries its own BCP-47 tag, so dates read the way that
  // language writes them rather than falling into Hindi for everything but
  // English.
  return LANGUAGES[lang]?.tag ?? 'hi-IN';
}

/** Short "how long ago" string in the active language. */
export function timeAgo(ms: number, t: Translate): string {
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return t('time.now');
  if (mins < 60) return t('time.minutes', { n: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t('time.hours', { n: hours });
  const days = Math.round(hours / 24);
  if (days < 30) return t('time.days', { n: days });
  return t('time.months', { n: Math.round(days / 30) });
}

export function shortDate(ms: number, lang: Lang): string {
  return new Date(ms).toLocaleDateString(locale(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function dateTime(ms: number, lang: Lang): string {
  return new Date(ms).toLocaleString(locale(lang), {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** 9876543210 -> 98xxxxxx10 for public display. */
/**
 * 9876543210 -> 98xxxxxx10, and never anything else.
 *
 * It used to return its input unchanged when there were fewer than ten digits,
 * which put a raw number on a world-readable document the moment anything
 * upstream let a short one through. A masking function that echoes its input on
 * the unexpected path is not a masking function; validation belongs to the
 * caller and this one masks whatever it is handed.
 */
export function maskPhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length < 10) return 'x'.repeat(digits.length);
  return digits.slice(0, 2) + 'xxxxxx' + digits.slice(-2);
}
