/**
 * Turns the All India Pincode Directory into something a phone can fetch.
 *
 * Source: data.gov.in, Department of Posts — one row per post office, and India
 * Post keeps a branch in essentially every village, so it doubles as a village
 * directory with district, state and coordinates attached. Roughly 157k rows,
 * about 24 MB of CSV, which is why none of it ships whole.
 *
 * Run with `npm run pincodes -- ./pincode.csv`. Every count this script cares
 * about is printed at the end rather than written into a comment: the directory
 * is reissued periodically and a number in a comment goes stale silently, which
 * is exactly how the figures in an earlier draft of this file came to disagree
 * with the output beside them.
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2];
const OUT = process.argv[3] || './public/pincodes';

if (!SRC || !fs.existsSync(SRC)) {
  console.error(
    'Usage: node scripts/build-pincodes.mjs <pincode.csv> [outDir]\n\n' +
      'Download "All India Pincode Directory" from data.gov.in first.'
  );
  process.exit(1);
}

/**
 * India Post names every branch "<village> B.O" / "S.O" / "H.O", and some rows
 * carry the parent office as well: "Amba B.O (Alauli S.O)". The office code is
 * not part of the place and nobody searching for their own village types it, so
 * the cut happens at the first code rather than only stripping a trailing one.
 */
function cleanName(raw) {
  return raw
    .replace(/\s*[([].*$/, '')
    .replace(/\s+(B|S|H|G\.?P|E\.?D\.?S|M\.?D)\.?\s?[OG]\.?(\s.*)?$/i, '')
    .replace(/\s+R\.?S\.?$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(s) {
  return s
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\b(And|Of|The)\b/g, (w) => w.toLowerCase());
}

/** Minimal CSV reader: this file is quoted and has no embedded newlines. */
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(',').map((h) => h.replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const cells = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) {
        cells.push(cur);
        cur = '';
      } else cur += ch;
    }
    cells.push(cur);
    return Object.fromEntries(head.map((h, i) => [h, (cells[i] ?? '').trim()]));
  });
}

const rows = parseCsv(fs.readFileSync(SRC, 'utf8'));
console.log('rows read:', rows.length);

// prefix -> { d: [districts], s: [states], p: { pincode: [[name, dIdx, sIdx, lat, lng]] } }
const shards = new Map();
const byLetter = new Map();
let skipped = 0;
let swapped = 0;
let noCoords = 0;

// India sits at 6-38N, 68-98E. The two ranges barely overlap, which is what
// makes a transposed pair detectable rather than merely wrong.
const inLat = (v) => v >= 6 && v <= 38;
const inLng = (v) => v >= 68 && v <= 98;

for (const r of rows) {
  const pin = (r.Pincode || '').replace(/\D/g, '');
  const name = cleanName(r.OfficeName || '');
  if (pin.length !== 6 || !name) {
    skipped++;
    continue;
  }

  // Some rows carry "NA" for both coordinates, and some carry latitude and
  // longitude the wrong way round — "Kathrang BO, 813105, lat 84.5, lng 24.2"
  // is Bihar with the pair swapped.
  //
  // Neither is a reason to drop the row. The village name, district and state
  // are what the form fills in; only the map pin needs a fix. A transposed pair
  // is put back; anything still outside India becomes null rather than a point
  // in the Arabian Sea.
  let lat = Number(r.Latitude);
  let lng = Number(r.Longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    lat = lng = null;
    noCoords++;
  } else if (inLat(lng) && inLng(lat)) {
    [lat, lng] = [lng, lat];
    swapped++;
  } else if (!inLat(lat) || !inLng(lng)) {
    lat = lng = null;
    noCoords++;
  }

  const prefix = pin.slice(0, 3);
  let shard = shards.get(prefix);
  if (!shard) {
    shard = { d: [], s: [], p: {} };
    shards.set(prefix, shard);
  }

  const district = titleCase(r.District || '');
  const state = titleCase(r.StateName || '');
  let di = shard.d.indexOf(district);
  if (di < 0) di = shard.d.push(district) - 1;
  let si = shard.s.indexOf(state);
  if (si < 0) si = shard.s.push(state) - 1;

  // [name, districtIdx, stateIdx, lat, lng] — the pair is omitted, not null,
  // when the source had none. Across 157k rows the two dropped elements are
  // worth more than the uniformity.
  (shard.p[pin] ||= []).push(
    lat == null ? [name, di, si] : [name, di, si, Number(lat.toFixed(4)), Number(lng.toFixed(4))]
  );

  const letter = /^[a-z]/i.test(name) ? name[0].toLowerCase() : '_';
  if (!byLetter.has(letter)) byLetter.set(letter, []);
  byLetter.get(letter).push([name, pin, district, state]);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'names'), { recursive: true });

let total = 0;
let biggest = 0;
let biggestName = '';
for (const [prefix, shard] of shards) {
  const json = JSON.stringify(shard);
  fs.writeFileSync(path.join(OUT, prefix + '.json'), json);
  total += json.length;
  if (json.length > biggest) {
    biggest = json.length;
    biggestName = prefix;
  }
}

let nameTotal = 0;
let nameBiggest = 0;
for (const [letter, list] of byLetter) {
  list.sort((a, b) => a[0].localeCompare(b[0]));
  const json = JSON.stringify(list);
  fs.writeFileSync(path.join(OUT, 'names', letter + '.json'), json);
  nameTotal += json.length;
  nameBiggest = Math.max(nameBiggest, json.length);
}

const kb = (n) => Math.round(n / 1024) + ' KB';
console.log(`skipped: ${skipped}  |  lat/lng swapped back: ${swapped}  |  no coords: ${noCoords}`);
console.log(
  `pincode shards: ${shards.size} files, ${kb(total)} total, median ${kb(total / shards.size)}, biggest ${biggestName} at ${kb(biggest)}`
);
console.log(`name shards:    ${byLetter.size} files, ${kb(nameTotal)} total, biggest ${kb(nameBiggest)}`);
