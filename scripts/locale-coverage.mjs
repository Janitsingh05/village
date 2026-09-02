/**
 * What each language still needs. Run with `npm run locales`.
 *
 * Hindi is the reference, because it is the fallback every missing key falls
 * through to. A language is only listed as ready when it has every key — a
 * screen that starts in Tamil and finishes in Hindi reads as broken software,
 * so `TRANSLATED` in lib/languages.ts should only name languages this reports
 * at 100%.
 *
 * Adding a language is three steps: copy hi.json to public/locales/<code>.json,
 * translate the values, add the code to TRANSLATED. This tells you when step
 * two is actually finished.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'public', 'locales');
const REFERENCE = 'hi';

/** Every dotted key with a string value, e.g. "report.submit". */
function flatten(node, prefix = '') {
  const out = new Map();
  for (const [key, value] of Object.entries(node ?? {})) {
    const dotted = prefix ? prefix + '.' + key : key;
    if (typeof value === 'string') out.set(dotted, value);
    else if (value && typeof value === 'object') {
      for (const [k, v] of flatten(value, dotted)) out.set(k, v);
    }
  }
  return out;
}

async function readDict(code) {
  const raw = await fs.readFile(path.join(dir, code + '.json'), 'utf8');
  return flatten(JSON.parse(raw));
}

const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
const reference = await readDict(REFERENCE);

console.log('Reference: ' + REFERENCE + '.json — ' + reference.size + ' keys\n');

for (const file of files.sort()) {
  const code = path.basename(file, '.json');
  if (code === REFERENCE) continue;

  const dict = await readDict(code);
  const missing = [...reference.keys()].filter((k) => !dict.has(k));
  const extra = [...dict.keys()].filter((k) => !reference.has(k));
  // A value copied verbatim from Hindi is almost always an untranslated stub
  // rather than a word two languages happen to share.
  const untouched = [...dict.entries()].filter(([k, v]) => reference.get(k) === v);

  const done = reference.size - missing.length - untouched.length;
  const pct = Math.round((done / reference.size) * 100);

  console.log(code + '.json  ' + String(pct).padStart(3) + '%  (' + done + '/' + reference.size + ')');
  if (missing.length) console.log('   missing  ' + missing.length + ': ' + missing.slice(0, 8).join(', ') + (missing.length > 8 ? ' …' : ''));
  if (untouched.length) console.log('   same as ' + REFERENCE + ' ' + untouched.length + ': ' + untouched.slice(0, 8).map(([k]) => k).join(', ') + (untouched.length > 8 ? ' …' : ''));
  if (extra.length) console.log('   not in ' + REFERENCE + ' ' + extra.length + ': ' + extra.slice(0, 8).join(', ') + (extra.length > 8 ? ' …' : ''));
  console.log('');
}
