/**
 * Turns GPS coordinates into a place a person can read.
 *
 * A pair of coordinates tells the Sarpanch nothing; "रामपुरा, सीकर" tells them
 * where to send someone.
 *
 * Two providers, tried in order. Nominatim resolves the smallest units — it
 * names villages and hamlets, which is exactly what this app is about — but its
 * usage policy is strict and it may refuse. BigDataCloud's client endpoint is
 * built for browser use and does not refuse, but is coarser. Neither needs an
 * API key or a billing account, which is the same reason photos live in
 * Firestore.
 *
 * This does send the reporter's coordinates to a third party, and only when
 * they tap "use my location" themselves.
 */
export interface Place {
  /** Village or town — the most specific name available. */
  place: string;
  district: string;
  state: string;
  /** One line, fit to show as-is. */
  display: string;
}

const TIMEOUT_MS = 12_000;

function compose(place: string, district: string, state: string): Place | null {
  const display = [place, district, state].filter(Boolean).join(', ');
  return display ? { place, district, state, display } : null;
}

async function getJson(url: string): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fromNominatim(lat: number, lng: number, lang: string): Promise<Place | null> {
  const data = await getJson(
    'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14' +
      '&lat=' + encodeURIComponent(String(lat)) +
      '&lon=' + encodeURIComponent(String(lng)) +
      '&accept-language=' + encodeURIComponent(lang)
  );
  const a = data?.address;
  if (!a) return null;

  // The smallest mapped unit is named differently depending on the place, so
  // take the first that exists rather than assuming one field.
  return compose(
    a.village || a.hamlet || a.town || a.suburb || a.city || a.municipality || '',
    // state_district is the administrative district ("सीकर"); county often
    // holds the tehsil ("Sikar Tehsil"), which is both narrower and usually
    // untranslated, so prefer the district.
    a.state_district || a.district || a.county || '',
    a.state || ''
  );
}

async function fromBigDataCloud(lat: number, lng: number, lang: string): Promise<Place | null> {
  const data = await getJson(
    'https://api.bigdatacloud.net/data/reverse-geocode-client' +
      '?latitude=' + encodeURIComponent(String(lat)) +
      '&longitude=' + encodeURIComponent(String(lng)) +
      '&localityLanguage=' + encodeURIComponent(lang)
  );
  if (!data) return null;

  return compose(
    data.locality || data.city || '',
    data.localityInfo?.administrative?.find((x: any) => x.adminLevel === 5)?.name || '',
    data.principalSubdivision || ''
  );
}

/**
 * Results already looked up, keyed to about a 100-metre square.
 *
 * Nominatim's usage policy caps bulk traffic and a whole village shares one
 * tower's address, so the same handpump reported twice should not be two
 * lookups. Rounding to three decimals is roughly a street corner — precise
 * enough that the cached name still describes the place.
 */
const PLACE_CACHE_KEY = 'gaonconnect:places';

function cacheKey(lat: number, lng: number, lang: string): string {
  return lat.toFixed(3) + ',' + lng.toFixed(3) + ',' + lang;
}

function readCache(): Record<string, Place> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(PLACE_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

export async function reverseGeocode(lat: number, lng: number, lang = 'hi'): Promise<Place | null> {
  const key = cacheKey(lat, lng, lang);
  const cache = readCache();
  if (cache[key]) return cache[key];

  const place =
    (await fromNominatim(lat, lng, lang)) ??
    (await fromBigDataCloud(lat, lng, lang)) ??
    // Offline or both refused — the complaint still carries its coordinates,
    // it just has no readable name attached.
    null;

  if (place) {
    try {
      // Bounded, so a well-travelled phone does not fill its storage quota.
      const entries = Object.entries(cache).slice(-40);
      window.localStorage.setItem(
        PLACE_CACHE_KEY,
        JSON.stringify({ ...Object.fromEntries(entries), [key]: place })
      );
    } catch {
      /* private mode, or quota — the lookup still worked */
    }
  }

  return place;
}

/* ----------------------------- forward search ----------------------------- */

export interface PlaceResult {
  id: string;
  /** Village / town name on its own. */
  name: string;
  district: string;
  state: string;
  /** Full line as the map service describes it. */
  display: string;
  lat: number;
  lng: number;
  /** village, town, city, hamlet … — worth showing so lookalikes are separable. */
  kind: string;
}

/**
 * Search Indian places by name, so a village is picked off the map rather than
 * typed from memory. Restricted to India and biased towards settlements —
 * onboarding a Gram Panchayat should not surface a restaurant of the same name.
 */
export async function searchPlaces(term: string, lang = 'hi'): Promise<PlaceResult[]> {
  const q = term.trim();
  if (q.length < 3) return [];

  const data = await getJson(
    'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8' +
      '&countrycodes=in' +
      '&q=' + encodeURIComponent(q) +
      '&accept-language=' + encodeURIComponent(lang)
  );
  if (!Array.isArray(data)) return [];

  // A settlement is what is being onboarded, so those come first; a district
  // or tehsil sharing the name is still offered, just lower down.
  const RANK: Record<string, number> = {
    village: 0,
    hamlet: 1,
    town: 2,
    city: 3,
    suburb: 4,
    municipality: 5,
  };
  const rankOf = (kind: string) => (kind in RANK ? RANK[kind] : 9);

  const seen = new Set<string>();

  return data
    .map((row: any): PlaceResult | null => {
      const a = row.address || {};
      const name =
        a.village || a.hamlet || a.town || a.city || a.suburb || a.municipality || row.name || '';
      if (!name) return null;

      return {
        id: String(row.osm_type || '') + String(row.osm_id || row.place_id || ''),
        name,
        district: a.state_district || a.district || a.county || '',
        state: a.state || '',
        display: row.display_name || name,
        lat: Number(row.lat),
        lng: Number(row.lon),
        kind: row.addresstype || row.type || '',
      };
    })
    .filter((r): r is PlaceResult => r != null && Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .filter((r) => {
      // The same settlement often comes back more than once from different
      // OSM objects; one row per place is enough to choose from.
      const key = [r.name, r.district, r.state].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => rankOf(a.kind) - rankOf(b.kind));
}

/** Keyless map preview — an <iframe src> centred on the point. */
export function mapEmbedUrl(lat: number, lng: number, span = 0.02): string {
  const bbox = [lng - span, lat - span / 2, lng + span, lat + span / 2].join(',');
  return (
    'https://www.openstreetmap.org/export/embed.html?bbox=' +
    encodeURIComponent(bbox) +
    '&layer=mapnik&marker=' +
    encodeURIComponent(lat + ',' + lng)
  );
}

/** For the "open in Google Maps" escape hatch, which needs no key either. */
export function googleMapsUrl(lat: number, lng: number): string {
  return 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng;
}
