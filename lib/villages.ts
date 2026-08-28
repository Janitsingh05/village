import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import type { Village } from './types';

const DEMO_KEY = 'gaonconnect:villages';

function col() {
  return collection(db(), 'villages');
}

function toMillis(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'number') return v;
  return Date.now();
}

function demoRead(): Village[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    return raw ? (JSON.parse(raw) as Village[]) : [];
  } catch {
    return [];
  }
}

function demoWrite(rows: Village[]) {
  try {
    window.localStorage.setItem(DEMO_KEY, JSON.stringify(rows));
  } catch {
    /* disposable demo data */
  }
}

export async function listVillages(): Promise<Village[]> {
  if (!isFirebaseConfigured) return demoRead().sort((a, b) => b.createdAt - a.createdAt);
  const snap = await getDocs(query(col(), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name ?? '',
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

  if (!isFirebaseConfigured) {
    demoWrite([record, ...demoRead().filter((v) => v.id !== id)]);
    return id;
  }

  await setDoc(doc(col(), id), { ...record, createdAt: serverTimestamp() });
  return id;
}
