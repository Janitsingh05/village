'use client';

/**
 * India's villages, from India Post, shipped with the app.
 *
 * Nominatim names villages where OSM has mapped them, and across rural India
 * that is patchy — the exact places this app exists for are the ones most often
 * missing. It also cannot answer the question a villager actually asks, which is
 * a pincode, not a name.
 *
 * So the directory is bundled instead of queried: the All India Pincode
 * Directory (data.gov.in) names one branch per village and carries its district,
 * state and, for most of them, coordinates. No API key, no billing account, no
 * third-party call, and it works with no signal — which is the whole reason to
 * prefer it here.
 *
 * The file is several megabytes, so it is not one file. `npm run pincodes`
 * splits it by the first three digits of the pincode — that is India Post's own
 * sorting district, so a lookup only ever needs one shard. A shard is a few
 * kilobytes gzipped, and the service worker keeps it after the first use.
 */

export interface PincodePlace {
  /** Village or locality, with the "B.O" / "S.O" office code stripped. */
  name: string;
  pincode: string;
  district: string;
  state: string;
  /** Null where the source carried no usable fix. */
  lat: number | null;
  lng: number | null;
}

/** [name, districtIndex, stateIndex, lat?, lng?] */
type PackedPlace = [string, number, number, number?, number?];

interface Shard {
  d: string[];
  s: string[];
  p: Record<string, PackedPlace[]>;
}

const shards = new Map<string, Shard | null>();
const inFlight = new Map<string, Promise<Shard | null>>();

async function loadShard(prefix: string): Promise<Shard | null> {
  if (shards.has(prefix)) return shards.get(prefix) ?? null;

  const running = inFlight.get(prefix);
  if (running) return running;

  const request = fetch('/pincodes/' + prefix + '.json', { cache: 'force-cache' })
    .then((res) => (res.ok ? (res.json() as Promise<Shard>) : null))
    .then((shard) => {
      shards.set(prefix, shard);
      return shard;
    })
    .catch(() => null)
    .finally(() => inFlight.delete(prefix));

  inFlight.set(prefix, request);
  return request;
}

function unpack(row: PackedPlace, pincode: string, shard: Shard): PincodePlace {
  return {
    name: row[0],
    pincode,
    district: shard.d[row[1]] ?? '',
    state: shard.s[row[2]] ?? '',
    lat: row[3] ?? null,
    lng: row[4] ?? null,
  };
}

/**
 * Every village under one pincode.
 *
 * This is the lookup the report form and the welcome screen want: six digits a
 * villager already knows, and back comes a list to tap, with the district and
 * state filled in behind it so nobody has to spell "Jhunjhunu".
 */
export async function placesForPincode(raw: string): Promise<PincodePlace[]> {
  const pin = (raw || '').replace(/\D/g, '');
  if (pin.length !== 6) return [];

  const shard = await loadShard(pin.slice(0, 3));
  const rows = shard?.p[pin];
  if (!shard || !rows) return [];

  return rows.map((row) => unpack(row, pin, shard)).sort((a, b) => a.name.localeCompare(b.name));
}

/** Whether a pincode exists at all — for validating the field as it is typed. */
export async function pincodeExists(raw: string): Promise<boolean> {
  return (await placesForPincode(raw)).length > 0;
}

/* ------------------------------ name search ------------------------------ */

/**
 * Transliteration is not spelling.
 *
 * The same village is written Rampura, Rampur, Ramapura and Ram Pura by four
 * people who all say the same word, because Devanagari came into Latin letters
 * without a rule. A villager typing their own village name will not match the
 * directory's spelling often enough to rely on equality, so the comparison is
 * done on a squashed form: doubled letters collapsed, the vowel pairs that
 * carry no distinction folded together, and the consonant pairs that English
 * spells two ways treated as one.
 */
function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/ph/g, 'f')
    .replace(/ksh|x/g, 'ks')
    .replace(/[vw]/g, 'v')
    .replace(/[jz]/g, 'j')
    .replace(/aa|ah/g, 'a')
    .replace(/ee|ie|iy/g, 'i')
    .replace(/oo|ou/g, 'u')
    .replace(/(.)\1+/g, '$1');
}

/** Levenshtein, capped: past three edits the answer is "no" and the cost is wasted. */
function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      best = Math.min(best, row[j]);
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

const nameShards = new Map<string, [string, string, string, string][]>();

async function loadNames(letter: string) {
  const cached = nameShards.get(letter);
  if (cached) return cached;
  try {
    const res = await fetch('/pincodes/names/' + letter + '.json', { cache: 'force-cache' });
    const list = res.ok ? ((await res.json()) as [string, string, string, string][]) : [];
    nameShards.set(letter, list);
    return list;
  } catch {
    return [];
  }
}

/**
 * Villages by name, typo-tolerantly.
 *
 * Sharded by first letter rather than loaded whole, and only the super-admin
 * onboarding screen searches nationally — a villager never needs this. They
 * arrive on a `?v=` link, or the welcome screen ranks villages already onboarded
 * by distance. So the heavy index stays off every citizen-facing path.
 *
 * `preferState` is what makes the result usable. India has a Rampura in most
 * states — the raw search returns five of them and the reporter cannot tell
 * which is theirs. The state is already known by then, from reverseGeocode() or
 * from the pincode, so matching rows are floated to the top rather than the
 * reporter being asked to recognise a district they may never have named.
 * Biasing by state rather than by distance keeps the index free of coordinates,
 * which is a large part of its size for a worse answer.
 */
export async function searchVillages(
  term: string,
  options: { preferState?: string; limit?: number } = {}
): Promise<(PincodePlace & { score: number })[]> {
  const q = term.trim();
  if (q.length < 3) return [];

  const folded = fold(q);
  if (!folded) return [];

  // A misspelling usually keeps its first sound, so one shard is enough. Both
  // are checked when the fold changes the first letter (Vasant / Wasant), and
  // a name starting with a digit or a Devanagari character lands in '_'.
  const first = q[0].toLowerCase();
  const letters = new Set([/[a-z]/.test(first) ? first : '_', folded[0]]);
  const lists = await Promise.all([...letters].map(loadNames));

  const hits: (PincodePlace & { score: number })[] = [];

  for (const list of lists) {
    for (const [name, pincode, district, state] of list) {
      const target = fold(name);
      let score: number;

      if (target === folded) score = 0;
      else if (target.startsWith(folded)) score = 1 + (target.length - folded.length) / 100;
      else if (target.includes(folded)) score = 2;
      else {
        const d = editDistance(folded, target);
        // Allow one edit per four characters, so a short name is not matched loosely.
        if (d > Math.max(1, Math.floor(folded.length / 4))) continue;
        score = 3 + d;
      }

      // Half a point ahead of everything with the same spelling score, and
      // never enough to outrank a better spelling match in another state.
      if (options.preferState && fold(state) === fold(options.preferState)) score -= 0.5;

      hits.push({ name, pincode, district, state, lat: null, lng: null, score });
    }
  }

  hits.sort((a, b) => a.score - b.score || a.name.length - b.name.length);

  // One row per village+district: the directory lists a branch per hamlet and
  // eight identical "Rampura, Sikar" rows is a worse answer than one.
  const seen = new Set<string>();
  const unique = hits.filter((h) => {
    const key = fold(h.name) + '|' + h.district;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, options.limit ?? 12);
}
