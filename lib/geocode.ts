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

export async function reverseGeocode(lat: number, lng: number, lang = 'hi'): Promise<Place | null> {
  return (
    (await fromNominatim(lat, lng, lang)) ??
    (await fromBigDataCloud(lat, lng, lang)) ??
    // Offline or both refused — the complaint still carries its coordinates,
    // it just has no readable name attached.
    null
  );
}
