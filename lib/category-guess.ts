import type { CategoryId } from './types';

/**
 * A first guess at what a spoken complaint is about.
 *
 * Deliberately crude — a word list, not a classifier. Its job is to pre-select
 * one of eight tiles so the usual case is a glance and a tap instead of a
 * decision; the tiles stay on screen and stay changeable, so a wrong guess
 * costs one tap and never files the wrong thing.
 *
 * That is also why there is no confidence threshold or scoring beyond counting
 * hits: anything cleverer would invite trusting it, and the input it works on
 * is a machine transcript of a villager speaking over a phone speaker.
 */
const KEYWORDS: Record<CategoryId, string[]> = {
  drain: ['नाली', 'नाला', 'गटर', 'सीवर', 'बहाव', 'drain', 'sewer', 'gutter', 'nali', 'nala'],
  road: ['सड़क', 'रास्ता', 'गड्ढा', 'गड्ढे', 'पुल', 'road', 'street', 'pothole', 'sadak', 'rasta'],
  streetlight: [
    'स्ट्रीट लाइट',
    'स्ट्रीटलाइट',
    'लाइट',
    'बत्ती',
    'खंभा',
    'streetlight',
    'street light',
    'lamp',
    'batti',
  ],
  water: ['पानी', 'नल', 'टंकी', 'हैंडपंप', 'हैण्डपंप', 'बोरवेल', 'water', 'tap', 'tank', 'handpump'],
  electricity: [
    'बिजली',
    'करंट',
    'ट्रांसफार्मर',
    'तार',
    'कटौती',
    'electricity',
    'power',
    'current',
    'transformer',
    'bijli',
  ],
  garbage: ['कचरा', 'कूड़ा', 'गंदगी', 'सफाई', 'सफ़ाई', 'garbage', 'waste', 'trash', 'kachra'],
  public_property: [
    'स्कूल',
    'पंचायत भवन',
    'अस्पताल',
    'मंदिर',
    'चबूतरा',
    'सरकारी',
    'school',
    'hospital',
    'building',
    'public',
  ],
  // Never matched on purpose: "other" is where nothing landing counts as a
  // guess, not a category with words of its own.
  other: [],
};

/**
 * The category a transcript most likely describes, or null to leave it unset.
 *
 * Null rather than 'other', because "we could not tell" and "the reporter said
 * it is something else" are different answers, and only one of them should be
 * filled in on the reporter's behalf.
 */
export function guessCategory(text: string): CategoryId | null {
  const haystack = (text || '').toLowerCase();
  if (haystack.trim().length < 3) return null;

  let best: CategoryId | null = null;
  let bestHits = 0;

  for (const [id, words] of Object.entries(KEYWORDS) as [CategoryId, string[]][]) {
    const hits = words.reduce((n, word) => (haystack.includes(word) ? n + 1 : n), 0);
    if (hits > bestHits) {
      bestHits = hits;
      best = id;
    }
  }

  return best;
}
