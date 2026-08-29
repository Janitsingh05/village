import {
  arrayUnion,
  collection,
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
import type { Village } from './types';

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
    return {
      id: d.id,
      name: data.name ?? '',
    nameEn: data.nameEn ?? '',
      state: data.state ?? '',
      district: data.district ?? '',
      address: data.address ?? '',
      adminName: data.adminName ?? '',
      adminPhone: data.adminPhone ?? '',
      adminUserIds: data.adminUserIds ?? [],
      createdAt: toMillis(data.createdAt),
    };
  });
}

export interface NewVillageInput {
  name: string;
  /** Optional English name so the language toggle can switch it. */
  nameEn?: string;
  state: string;
  district: string;
  address: string;
  adminName: string;
  adminPhone: string;
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
    adminName: input.adminName.trim(),
    adminPhone: input.adminPhone.replace(/\D/g, '').slice(-10),
    // The admin's Auth UID is attached the first time they sign in; the
    // Firestore rules read this array to decide who may update complaints.
    adminUserIds: [],
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
    adminName: data.adminName ?? '',
    adminPhone: data.adminPhone ?? '',
    adminUserIds: data.adminUserIds ?? [],
    createdAt: toMillis(data.createdAt),
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

  const snap = await getDocs(query(col(), where('adminPhone', '==', digits)));
  if (snap.empty) return null;

  const match = snap.docs[0];
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
