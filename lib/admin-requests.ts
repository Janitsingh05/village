import {
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { AdminRequest, AdminRequestStatus } from './types';

/**
 * Requests to administer a village.
 *
 * Kept in one top-level collection rather than under each village: a super
 * admin needs to see everything waiting on them in one place, and the rules
 * only ever let the requester write their own row.
 */
function col() {
  return collection(db(), 'adminRequests');
}

function toMillis(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'number') return v;
  return Date.now();
}

function fromDoc(id: string, data: Record<string, any>): AdminRequest {
  return {
    id,
    villageId: data.villageId ?? '',
    villageName: data.villageName ?? '',
    name: data.name ?? '',
    phone: data.phone ?? '',
    role: data.role ?? '',
    status: (data.status as AdminRequestStatus) ?? 'pending',
    createdAt: toMillis(data.createdAt),
    decidedAt: data.decidedAt ? toMillis(data.decidedAt) : null,
  };
}

/**
 * The document id is derived from the village and the phone number.
 *
 * That makes a repeat request a write to an existing document, which the rules
 * refuse — so duplicates are impossible without the client first *reading* the
 * collection, and it must not be able to: these rows carry phone numbers and
 * are readable by the super admin alone.
 */
function requestId(villageId: string, phone: string): string {
  return villageId + '__' + phone;
}

export async function createAdminRequest(input: {
  villageId: string;
  villageName: string;
  name: string;
  phone: string;
  role: string;
}): Promise<string> {
  const phone = input.phone.replace(/\D/g, '').slice(-10);
  if (phone.length !== 10) throw new Error('BAD_PHONE');

  const id = requestId(input.villageId, phone);

  try {
    await setDoc(
      doc(col(), id),
      {
        villageId: input.villageId,
        villageName: input.villageName,
        name: input.name.trim(),
        phone,
        role: input.role.trim(),
        status: 'pending' as AdminRequestStatus,
        createdAt: serverTimestamp(),
        decidedAt: null,
      },
      // Refuse to overwrite: an existing row means a request is already on file.
      { merge: false }
    );
  } catch (e) {
    const code = (e as { code?: string }).code || '';
    if (code === 'permission-denied') throw new Error('ALREADY_REQUESTED');
    throw e;
  }

  return id;
}

export function subscribeToAdminRequests(
  onChange: (rows: AdminRequest[]) => void,
  onError: (e: Error) => void
): () => void {
  return onSnapshot(
    query(col(), orderBy('createdAt', 'desc')),
    (snap) => onChange(snap.docs.map((d) => fromDoc(d.id, d.data()))),
    (e) => onError(e)
  );
}

/**
 * Approving is what actually grants access: the number joins the village's
 * adminPhones, and the app links their UID the first time they sign in.
 */
export async function decideAdminRequest(
  request: AdminRequest,
  decision: 'approved' | 'rejected'
): Promise<void> {
  if (decision === 'approved') {
    await updateDoc(doc(db(), 'villages', request.villageId), {
      adminPhones: arrayUnion(request.phone),
    });
  }
  await updateDoc(doc(col(), request.id), {
    status: decision,
    decidedAt: serverTimestamp(),
  });
}
