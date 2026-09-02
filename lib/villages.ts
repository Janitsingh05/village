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
  adminName: string;
  adminPhone: string;
  /** What the first admin should be called, e.g. सरपंच. */
  adminRole?: string;
  /** The audit trail for that first admin: who vouched, on what basis, until when. */
  verifiedBy?: string;
  verifiedNote?: string;
  termEndsAt?: number | null;
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
    adminName: input.adminName.trim(),
    adminRole: '',
    adminPhotoUrl: null,
    adminPhone: input.adminPhone.replace(/\D/g, '').slice(-10),
    adminPhones: [],
    // The admin's Auth UID is attached the first time they sign in; the
    // Firestore rules read this array to decide who may update complaints.
    adminUserIds: [],
    adminTermEnds: input.termEndsAt
      ? { [input.adminPhone.replace(/\D/g, '').slice(-10)]: input.termEndsAt }
      : {},
    adminVerifiedAt: Date.now(),
    location: input.location ?? null,
    mapPlace: (input.mapPlace || '').trim(),
    createdAt: Date.now(),
  };

  await setDoc(doc(col(), id), { ...record, createdAt: serverTimestamp() });

  // Onboarding is the invite path: a super admin typed this number in after
  // working out offline who they were handing the village to. That is a grant
  // of access like any other, so it gets the same record behind it — without
  // this the village would flag its own primary admin as unaccounted for.
  await setDoc(doc(collection(col(), id, 'admins'), record.adminPhone), {
    phone: record.adminPhone,
    name: record.adminName,
    role: record.adminRole,
    verifiedVia: 'offline',
    verifiedNote: (input.verifiedNote || '').trim(),
    verifiedAt: Date.now(),
    verifiedBy: input.verifiedBy || '',
    termEndsAt: input.termEndsAt ?? null,
  });

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
    adminPhones: data.adminPhones ?? [],
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
 * Links a freshly onboarded admin to their village on first sign-in.
 *
 * Onboarding only knows the admin's phone number — their Firebase Auth UID does
 * not exist until they actually sign in. So the first time they do, we find the
 * village that named their number and append their UID to adminUserIds, which
 * is what the Firestore rules check before allowing any complaint update.
 *
 * The matching rule is enforced server-side too: a user may only ever append
 * their own UID, and only to a village whose adminPhone equals their verified
 * number.
 *
 * Returns the village id they now administer, or null if no village claims them.
 */
export async function claimVillageForAdmin(uid: string, phone: string): Promise<string | null> {
  const digits = (phone || '').replace(/\D/g, '').slice(-10);
  if (!digits) return null;

  // Onboarding sets adminPhone; an approved request adds to adminPhones. Check
  // both, or an approved admin would sign in and find themselves unlinked.
  const [primary, extra] = await Promise.all([
    getDocs(query(col(), where('adminPhone', '==', digits))),
    getDocs(query(col(), where('adminPhones', 'array-contains', digits))),
  ]);

  const match = primary.docs[0] || extra.docs[0];
  if (!match) return null;
  const existing: string[] = match.data().adminUserIds ?? [];

  if (!existing.includes(uid)) {
    try {
      // arrayUnion keeps this safe if two devices sign in at the same moment.
      await updateDoc(match.ref, { adminUserIds: arrayUnion(uid) });
    } catch {
      // Another device won the race, or the write was refused. The village is
      // still the one that names this number, so hand it back either way — a
      // genuine permission problem will surface on the next real update rather
      // than locking the admin out of their own dashboard here.
    }
  }

  return match.id;
}

/* ------------------------- who administers a village ------------------------ */

/**
 * The full record for one administrator, at villages/{id}/admins/{phone}.
 *
 * A subcollection rather than an array on the village, because the village
 * document is world-readable and these carry a super admin's notes about
 * somebody's identity documents. The village keeps only what the app needs
 * without privilege: the phone numbers, which were already public, and the
 * dates their access runs out.
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
 * Grants a phone number administrative access, with the evidence attached.
 *
 * Two writes, because the evidence and the access live apart: the record goes
 * in the private subcollection, and the village doc gets the number plus its
 * expiry date so the rules and the app can see them without a privileged read.
 */
export async function addVillageAdmin(
  villageId: string,
  entry: Omit<VillageAdmin, 'verifiedAt'> & { verifiedAt?: number }
): Promise<void> {
  const phone = tenDigits(entry.phone);
  if (phone.length !== 10) throw new Error('BAD_PHONE');

  const ref = doc(col(), villageId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('NO_VILLAGE');
  const village = fromDoc(snap.id, snap.data());

  const record: VillageAdmin = {
    phone,
    name: entry.name.trim(),
    role: entry.role.trim(),
    verifiedVia: entry.verifiedVia,
    verifiedNote: entry.verifiedNote.trim(),
    verifiedAt: entry.verifiedAt ?? Date.now(),
    verifiedBy: entry.verifiedBy,
    termEndsAt: entry.termEndsAt,
  };

  await setDoc(doc(adminsCol(villageId), phone), record);

  const patch: Record<string, unknown> = {
    adminPhones: arrayUnion(phone),
    ['adminTermEnds.' + phone]: record.termEndsAt ?? deleteField(),
  };
  // The public card shows when the person villagers are told to approach was
  // last checked, so re-verifying the primary admin has to refresh that date.
  if (tenDigits(village.adminPhone) === phone) patch.adminVerifiedAt = record.verifiedAt;

  await updateDoc(ref, patch);
}

/**
 * Takes access away, immediately.
 *
 * The number comes off every list that could grant it back — including
 * `adminPhone`, which has its own self-linking rule and would otherwise let a
 * revoked primary admin walk straight back in. Then `adminUserIds` is emptied
 * outright: there is no map from a UID to the phone behind it, so instead of
 * guessing which one to drop, every device is made to prove itself again from
 * a number still on the list. The admin shell re-links on its next load, so
 * everyone still approved is back within a page view and the revoked one is not.
 */
export async function revokeVillageAdmin(villageId: string, phone: string): Promise<void> {
  const digits = tenDigits(phone);
  const ref = doc(col(), villageId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('NO_VILLAGE');
  const village = fromDoc(snap.id, snap.data());

  const patch: Record<string, unknown> = {
    adminPhones: village.adminPhones.filter((p) => tenDigits(p) !== digits),
    adminUserIds: [],
    ['adminTermEnds.' + digits]: deleteField(),
  };

  if (tenDigits(village.adminPhone) === digits) {
    patch.adminPhone = '';
    // The public card names whoever the villagers should approach. Leaving a
    // revoked name up there is worse than showing nobody.
    patch.adminName = '';
    patch.adminRole = '';
    patch.adminPhotoUrl = null;
    patch.adminVerifiedAt = null;
  }

  await updateDoc(ref, patch);
  await deleteDoc(doc(adminsCol(villageId), digits));
}

/** Extends a term after the super admin has re-checked the same evidence. */
export async function renewVillageAdmin(
  villageId: string,
  phone: string,
  input: {
    termEndsAt: number | null;
    verifiedVia: VerificationMethod;
    verifiedNote: string;
    verifiedBy: string;
  }
): Promise<void> {
  const digits = tenDigits(phone);
  const ref = doc(col(), villageId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('NO_VILLAGE');
  const village = fromDoc(snap.id, snap.data());
  const now = Date.now();

  await updateDoc(doc(adminsCol(villageId), digits), {
    termEndsAt: input.termEndsAt,
    verifiedVia: input.verifiedVia,
    verifiedNote: input.verifiedNote.trim(),
    verifiedBy: input.verifiedBy,
    verifiedAt: now,
  });

  const patch: Record<string, unknown> = {
    ['adminTermEnds.' + digits]: input.termEndsAt ?? deleteField(),
  };
  if (tenDigits(village.adminPhone) === digits) patch.adminVerifiedAt = now;

  await updateDoc(ref, patch);
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
 * When the number currently signed in loses access, or null when no end date
 * was ever set. Read straight off the public village document, so the admin
 * shell can enforce it without a privileged read.
 */
export function termEndFor(village: Village | null, phone: string): number | null {
  if (!village) return null;
  const end = village.adminTermEnds[tenDigits(phone)];
  return typeof end === 'number' ? end : null;
}

/**
 * Numbers whose access deserves a second look, from the public document alone.
 *
 * Counted for the villages list, which reads many villages at once and cannot
 * open a super-admin-only subcollection for each. An expired date is the
 * obvious case; so is no date at all, which means either a grant made before
 * any of this existed or one deliberately left open-ended — both worth opening.
 */
export function phonesNeedingReview(village: Village, now = Date.now()): string[] {
  const all = [village.adminPhone, ...village.adminPhones].map(tenDigits).filter(Boolean);
  return Array.from(new Set(all)).filter((p) => {
    const end = village.adminTermEnds[p];
    return typeof end !== 'number' || end <= now;
  });
}

/** Numbers holding access that no admin record accounts for. */
export function unrecordedPhones(village: Village, admins: VillageAdmin[]): string[] {
  const known = new Set(admins.map((a) => a.phone));
  const all = [village.adminPhone, ...village.adminPhones].map(tenDigits).filter(Boolean);
  return Array.from(new Set(all.filter((p) => !known.has(p))));
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
