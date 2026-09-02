import {
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Village, VillageAdmin, VerificationMethod } from './types';

function col() {
  return collection(db(), 'villages');
}

function toMillis(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'number') return v;
  return Date.now();
}

export async function listVillages(): Promise<Village[]> {
  const snap = await getDocs(query(col(), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => {
    const data = d.data();
    return fromDoc(d.id, data);
  });
}

/* ------------------------------ finding one ------------------------------ */

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance. Plenty accurate at village scale. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

export interface NearbyVillage {
  village: Village;
  /** Null when the village was matched by district rather than by distance. */
  km: number | null;
}

/**
 * The villages closest to a point, nearest first.
 *
 * A village onboarded off the map has coordinates and can be measured. One
 * typed in by hand has none, so it is matched on district instead and listed
 * after everything measurable — still findable, just not claiming a precision
 * it does not have.
 *
 * Every village is read and sorted in the browser. At pilot scale that is one
 * query instead of a geo index; past a few hundred villages it stops being the
 * right answer, and the fix is a district field on the query.
 */
export function rankByProximity(
  villages: Village[],
  at: { lat: number; lng: number } | null,
  place: { district?: string; state?: string } = {}
): NearbyVillage[] {
  const district = (place.district || '').trim().toLowerCase();
  const state = (place.state || '').trim().toLowerCase();

  const measured: NearbyVillage[] = [];
  const guessed: NearbyVillage[] = [];

  for (const village of villages) {
    if (at && village.location) {
      measured.push({ village, km: distanceKm(at, village.location) });
      continue;
    }
    const inDistrict = district && village.district.trim().toLowerCase() === district;
    const inState = state && village.state.trim().toLowerCase() === state;
    if (inDistrict || inState) guessed.push({ village, km: null });
  }

  measured.sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
  return [...measured, ...guessed];
}

export interface NewVillageInput {
  name: string;
  /** The panchayat's Local Government Directory code, if it is known. */
  lgdCode?: string;
  /** Set when the village was picked off the map rather than typed. */
  location?: { lat: number; lng: number } | null;
  mapPlace?: string;
  /** Optional English name so the language toggle can switch it. */
  nameEn?: string;
  state: string;
  district: string;
  address: string;
  /**
   * The public contact card, if it is known yet. All optional: a village can be
   * created before anyone runs it, and the first Sarpanch fills these in from
   * their own profile once their application is approved.
   */
  adminName?: string;
  adminPhone?: string;
  adminRole?: string;
}

/** Strip to ASCII and kebab-case; returns '' for a purely non-Latin string. */
function asciiSlug(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[^ -~]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Short stable suffix so two same-district villages never collide. */
function shortHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) % 46656;
  return h.toString(36).padStart(3, '0');
}

/**
 * Tenant id, e.g. "Rampura" in Sikar -> rampura-sikar. Village names are
 * usually typed in Devanagari, which would leave nothing ASCII to slug — in
 * that case we fall back to the district plus a short hash of the name, so the
 * id stays URL-safe and stable rather than becoming percent-encoded soup.
 */
export function villageIdFrom(name: string, district: string): string {
  const nameSlug = asciiSlug(name);
  const districtSlug = asciiSlug(district);

  if (nameSlug) return [nameSlug, districtSlug].filter(Boolean).join('-');
  if (districtSlug) return districtSlug + '-' + shortHash(name);
  return 'village-' + shortHash(name + district);
}

export async function createVillage(input: NewVillageInput): Promise<string> {
  const id = villageIdFrom(input.name, input.district);
  const record: Village = {
    id,
    name: input.name.trim(),
    nameEn: (input.nameEn || '').trim(),
    state: input.state,
    district: input.district,
    address: input.address.trim(),
    lgdCode: (input.lgdCode || '').replace(/\D/g, '').slice(0, 10),
    adminName: (input.adminName || '').trim(),
    adminRole: (input.adminRole || '').trim(),
    adminPhotoUrl: null,
    adminPhone: (input.adminPhone || '').replace(/\D/g, '').slice(-10),
    // Empty on purpose. A village exists before anyone runs it; the first
    // Sarpanch registers, a super admin approves them, and that approval is
    // what puts a UID here. Onboarding grants nobody anything.
    adminUserIds: [],
    adminTermEnds: {},
    adminVerifiedAt: null,
    location: input.location ?? null,
    mapPlace: (input.mapPlace || '').trim(),
    createdAt: Date.now(),
  };

  await setDoc(doc(col(), id), { ...record, createdAt: serverTimestamp() });

  return id;
}

function fromDoc(id: string, data: Record<string, any>): Village {
  return {
    id,
    name: data.name ?? '',
    nameEn: data.nameEn ?? '',
    state: data.state ?? '',
    district: data.district ?? '',
    address: data.address ?? '',
    lgdCode: data.lgdCode ?? '',
    adminName: data.adminName ?? '',
    adminRole: data.adminRole ?? '',
    adminPhotoUrl: data.adminPhotoUrl ?? null,
    adminPhone: data.adminPhone ?? '',
    adminUserIds: data.adminUserIds ?? [],
    // Villages onboarded before this existed carry neither; their primary admin
    // still works, they just show as unverified until someone reviews them.
    adminTermEnds: data.adminTermEnds ?? {},
    adminVerifiedAt: typeof data.adminVerifiedAt === 'number' ? data.adminVerifiedAt : null,
    location: data.location ?? null,
    mapPlace: data.mapPlace ?? '',
    createdAt: toMillis(data.createdAt),
  };
}

function toAdmin(data: Record<string, any>): VillageAdmin {
  return {
    uid: data.uid ?? '',
    email: data.email ?? '',
    phone: data.phone ?? '',
    name: data.name ?? '',
    role: data.role ?? '',
    verifiedVia: (data.verifiedVia as VerificationMethod) ?? 'offline',
    verifiedNote: data.verifiedNote ?? '',
    verifiedAt: toMillis(data.verifiedAt),
    verifiedBy: data.verifiedBy ?? '',
    termEndsAt: typeof data.termEndsAt === 'number' ? data.termEndsAt : null,
  };
}

export async function getVillage(id: string): Promise<Village | null> {
  const snap = await getDoc(doc(col(), id));
  return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
}

/**
 * The village a signed-in account administers, or null.
 *
 * One query against the array the Firestore rules already read, so the app and
 * the rules can never disagree about who this person is. There used to be a
 * dance here — onboarding recorded a phone number, the UID did not exist until
 * first sign-in, and the account attached itself with a rule written for that
 * one purpose. Registering before applying removes the whole problem: the UID
 * exists first, and approval writes it directly.
 */
export async function villageForUser(uid: string): Promise<string | null> {
  if (!uid) return null;
  const snap = await getDocs(query(col(), where('adminUserIds', 'array-contains', uid)));
  return snap.docs[0]?.id ?? null;
}

/* ------------------------- who administers a village ------------------------ */

/**
 * The full record for one administrator, at villages/{id}/admins/{uid}.
 *
 * A subcollection rather than an array on the village, because the village
 * document is world-readable and these carry an email address and a super
 * admin's notes about somebody's identity documents. The village keeps only
 * what the app needs without privilege: the account ids, and the dates their
 * access runs out.
 */
function adminsCol(villageId: string) {
  return collection(col(), villageId, 'admins');
}

/** Three months' warning is enough to arrange a handover. */
const EXPIRING_SOON_MS = 90 * 24 * 60 * 60 * 1000;

export type TermState = 'active' | 'expiring' | 'expired' | 'open-ended';

/**
 * Where a term stands against the clock.
 *
 * Note what this is *not*: enforcement. Firestore rules cannot sweep a
 * collection looking for dates that have passed without a server to run it, so
 * an expired term is a stop — loud in the super admin's list, and a locked door
 * in the admin app — rather than a revocation. Revoking is the enforced action,
 * and this exists so nobody has to remember to reach for it.
 */
export function termState(termEndsAt: number | null, now = Date.now()): TermState {
  if (termEndsAt == null) return 'open-ended';
  if (termEndsAt <= now) return 'expired';
  if (termEndsAt - now <= EXPIRING_SOON_MS) return 'expiring';
  return 'active';
}

export function tenDigits(phone: string): string {
  return (phone || '').replace(/\D/g, '').slice(-10);
}

/** Every recorded administrator of a village. Super admins only. */
export async function listVillageAdmins(villageId: string): Promise<VillageAdmin[]> {
  const snap = await getDocs(adminsCol(villageId));
  return snap.docs.map((d) => toAdmin(d.data())).sort((a, b) => b.verifiedAt - a.verifiedAt);
}

/**
 * Grants an account administrative access, with the evidence attached.
 *
 * Two writes, because the evidence and the access live apart: the record goes
 * in the private subcollection, and the village doc gets the UID plus its expiry
 * date so the rules and the app can see them without a privileged read.
 */
export async function addVillageAdmin(
  villageId: string,
  entry: Omit<VillageAdmin, 'verifiedAt'> & { verifiedAt?: number }
): Promise<void> {
  const uid = entry.uid.trim();
  if (!uid) throw new Error('BAD_UID');

  const ref = doc(col(), villageId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('NO_VILLAGE');

  const record: VillageAdmin = {
    uid,
    email: entry.email.trim().toLowerCase(),
    name: entry.name.trim(),
    role: entry.role.trim(),
    phone: tenDigits(entry.phone),
    verifiedVia: entry.verifiedVia,
    verifiedNote: entry.verifiedNote.trim(),
    verifiedAt: entry.verifiedAt ?? Date.now(),
    verifiedBy: entry.verifiedBy,
    termEndsAt: entry.termEndsAt,
  };

  await setDoc(doc(adminsCol(villageId), uid), record);

  const patch: Record<string, unknown> = {
    adminUserIds: arrayUnion(uid),
    ['adminTermEnds.' + uid]: record.termEndsAt ?? deleteField(),
    adminVerifiedAt: record.verifiedAt,
  };

  // The public card names whoever villagers should approach. An approval is the
  // moment there is someone to name, so fill it in when it is still blank —
  // without overwriting details an existing admin has since maintained.
  const village = fromDoc(snap.id, snap.data());
  if (!village.adminName && record.name) {
    patch.adminName = record.name;
    patch.adminRole = record.role;
    patch.adminPhone = record.phone;
  }

  await updateDoc(ref, patch);
}

/**
 * Takes access away, immediately.
 *
 * One write does it now: the UID leaves `adminUserIds`, and the Firestore rules
 * stop recognising that account on their very next read. There is nothing left
 * to re-attach it — the account cannot add itself back, because no rule lets
 * anyone write that array but a super admin.
 *
 * That is the payoff for making the UID the identity. The old version had to
 * strip a number from three lists and then empty `adminUserIds` wholesale,
 * knocking every other admin offline until their next page load, because a UID
 * could not be traced back to the phone behind it.
 */
export async function revokeVillageAdmin(villageId: string, uid: string): Promise<void> {
  const ref = doc(col(), villageId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('NO_VILLAGE');

  const village = fromDoc(snap.id, snap.data());
  const record = await getDoc(doc(adminsCol(villageId), uid));

  const patch: Record<string, unknown> = {
    adminUserIds: village.adminUserIds.filter((id) => id !== uid),
    ['adminTermEnds.' + uid]: deleteField(),
  };

  // Leaving a revoked person's name up as the village's contact is worse than
  // showing nobody, so clear the card when it was theirs.
  if (record.exists() && record.data().name && record.data().name === village.adminName) {
    Object.assign(patch, {
      adminName: '',
      adminRole: '',
      adminPhone: '',
      adminPhotoUrl: null,
      adminVerifiedAt: null,
    });
  }

  await updateDoc(ref, patch);
  if (record.exists()) await deleteDoc(record.ref);
}

/** Extends a term after the super admin has re-checked the same evidence. */
export async function renewVillageAdmin(
  villageId: string,
  uid: string,
  input: {
    termEndsAt: number | null;
    verifiedVia: VerificationMethod;
    verifiedNote: string;
    verifiedBy: string;
  }
): Promise<void> {
  const now = Date.now();

  await updateDoc(doc(adminsCol(villageId), uid), {
    termEndsAt: input.termEndsAt,
    verifiedVia: input.verifiedVia,
    verifiedNote: input.verifiedNote.trim(),
    verifiedBy: input.verifiedBy,
    verifiedAt: now,
  });

  await updateDoc(doc(col(), villageId), {
    ['adminTermEnds.' + uid]: input.termEndsAt ?? deleteField(),
    adminVerifiedAt: now,
  });
}

/**
 * Records the panchayat's government directory code.
 *
 * Separate from onboarding because most villages were added before there was a
 * field for it, and the code is what makes the cross-check on the review screen
 * point somewhere specific rather than at a generic search.
 */
export async function setVillageLgdCode(villageId: string, lgdCode: string): Promise<void> {
  await updateDoc(doc(col(), villageId), {
    lgdCode: (lgdCode || '').replace(/\D/g, '').slice(0, 10),
  });
}

/**
 * When the account currently signed in loses access, or null when no end date
 * was ever set. Read straight off the public village document, so the admin
 * shell can enforce it without a privileged read.
 */
export function termEndFor(village: Village | null, uid: string): number | null {
  if (!village || !uid) return null;
  const end = village.adminTermEnds[uid];
  return typeof end === 'number' ? end : null;
}

/**
 * Accounts whose access deserves a second look, from the public document alone.
 *
 * Counted for the villages list, which reads many villages at once and cannot
 * open a super-admin-only subcollection for each. An expired date is the
 * obvious case; so is no date at all, which means either a grant made before
 * any of this existed or one deliberately left open-ended — both worth opening.
 */
export function accountsNeedingReview(village: Village, now = Date.now()): string[] {
  return village.adminUserIds.filter((uid) => {
    const end = village.adminTermEnds[uid];
    return typeof end !== 'number' || end <= now;
  });
}

/** Accounts holding access that no admin record accounts for. */
export function unrecordedAccounts(village: Village, admins: VillageAdmin[]): string[] {
  const known = new Set(admins.map((a) => a.uid));
  return village.adminUserIds.filter((uid) => !known.has(uid));
}


/**
 * The admin editing their own details.
 *
 * Deliberately narrow: name, role and portrait only. The rules enforce the same
 * list, so an admin cannot quietly rewrite the village or add themselves
 * elsewhere by going through this path.
 */
export async function updateAdminProfile(
  villageId: string,
  input: { adminName: string; adminRole: string; adminPhotoUrl?: string | null }
): Promise<void> {
  const patch: Record<string, unknown> = {
    adminName: input.adminName.trim(),
    adminRole: input.adminRole.trim(),
  };
  if (input.adminPhotoUrl !== undefined) patch.adminPhotoUrl = input.adminPhotoUrl;

  await updateDoc(doc(col(), villageId), patch);
}
