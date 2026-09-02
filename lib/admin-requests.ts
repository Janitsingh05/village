import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { preparePhoto } from './imageCompress';
import { addVillageAdmin } from './villages';
import type { AdminRequest, AdminRequestStatus, VerificationMethod } from './types';

/**
 * Requests to administer a village.
 *
 * Kept in one top-level collection rather than under each village: a super
 * admin needs to see everything waiting on them in one place, and the rules
 * only ever let the requester write their own row.
 *
 * Filing one grants nothing. It is an application, and it has to carry evidence
 * — a photo ID and something showing the applicant holds the post — because the
 * alternative is a super admin approving a name they have no way to check.
 *
 * The account exists before the application does. Registering creates it, so an
 * application carries the exact UID approval will grant, and there is never a
 * grant sitting around waiting for the right person to turn up and claim it.
 */
function col() {
  return collection(db(), 'adminRequests');
}

/** The two documents every request must carry. */
export type ProofKind = 'id-proof' | 'post-proof';

function mediaDoc(requestId: string, kind: ProofKind) {
  return doc(col(), requestId, 'media', kind);
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
    uid: data.uid ?? '',
    email: data.email ?? '',
    name: data.name ?? '',
    phone: data.phone ?? '',
    role: data.role ?? '',
    idProofUrl: data.idProofUrl ?? null,
    postProofUrl: data.postProofUrl ?? null,
    status: (data.status as AdminRequestStatus) ?? 'pending',
    createdAt: toMillis(data.createdAt),
    decidedAt: data.decidedAt ? toMillis(data.decidedAt) : null,
    decidedBy: data.decidedBy ?? '',
    verifiedVia: (data.verifiedVia as VerificationMethod) ?? null,
    verifiedNote: data.verifiedNote ?? '',
    termEndsAt: typeof data.termEndsAt === 'number' ? data.termEndsAt : null,
  };
}

/**
 * The document id is the village and the applicant's account.
 *
 * That makes a repeat application a write to an existing document, which the
 * rules refuse — so duplicates are impossible without the client first *reading*
 * the collection, and it must not be able to: these rows carry email addresses
 * and photographed ID documents, and are readable by the super admin alone.
 */
function requestId(villageId: string, uid: string): string {
  return villageId + '__' + uid;
}

export async function createAdminRequest(input: {
  villageId: string;
  villageName: string;
  /** The account that just registered, from `register()`. */
  uid: string;
  email: string;
  name: string;
  /** Contact number for the public card. Optional; never an identity. */
  phone: string;
  role: string;
  /** Government photo ID — Aadhaar, voter card, driving licence. */
  idProofFile: File;
  /** Evidence of the post: election certificate, or a letter on letterhead. */
  postProofFile: File;
}): Promise<string> {
  if (!input.uid) throw new Error('NOT_SIGNED_IN');
  const phone = input.phone.replace(/\D/g, '').slice(-10);

  const id = requestId(input.villageId, input.uid);

  // Compress before the write so a request is never created without the proof
  // that justifies it — an unreadable photo should fail here, not leave a row
  // the super admin cannot act on.
  const [idProof, postProof] = await Promise.all([
    preparePhoto(input.idProofFile),
    preparePhoto(input.postProofFile),
  ]);

  try {
    await setDoc(
      doc(col(), id),
      {
        villageId: input.villageId,
        villageName: input.villageName,
        uid: input.uid,
        email: input.email.trim().toLowerCase(),
        name: input.name.trim(),
        phone,
        role: input.role.trim(),
        idProofUrl: idProof.thumb,
        postProofUrl: postProof.thumb,
        status: 'pending' as AdminRequestStatus,
        createdAt: serverTimestamp(),
        decidedAt: null,
        decidedBy: '',
        verifiedVia: null,
        verifiedNote: '',
        termEndsAt: null,
      },
      // Refuse to overwrite: an existing row means a request is already on file.
      { merge: false }
    );
  } catch (e) {
    const code = (e as { code?: string }).code || '';
    if (code === 'permission-denied') throw new Error('ALREADY_REQUESTED');
    throw e;
  }

  // Full-size images in their own documents, same split as complaint photos:
  // the thumbnails ride on the request so the review list renders in one read,
  // and these are fetched only when the super admin opens one.
  await Promise.all([
    setDoc(mediaDoc(id, 'id-proof'), {
      data: idProof.full,
      bytes: idProof.fullBytes,
      createdAt: serverTimestamp(),
    }),
    setDoc(mediaDoc(id, 'post-proof'), {
      data: postProof.full,
      bytes: postProof.fullBytes,
      createdAt: serverTimestamp(),
    }),
  ]);

  return id;
}

/** Full-size proof for the review screen; null when it was never stored. */
export async function getRequestProof(
  requestId: string,
  kind: ProofKind
): Promise<string | null> {
  const snap = await getDoc(mediaDoc(requestId, kind));
  return snap.exists() ? (snap.data().data as string) : null;
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

/** What the super admin has to record before an approval goes through. */
export interface Decision {
  /** The deciding super admin's UID — half of the audit trail. */
  by: string;
  verifiedVia: VerificationMethod;
  /** What they actually checked, in their own words. */
  verifiedNote: string;
  /** When this approval lapses. A Sarpanch's term is five years. */
  termEndsAt: number | null;
}

/**
 * Approving is what actually grants access: the applicant's account joins the
 * village's admin list along with the evidence behind it, and takes effect on
 * their next read — there is nothing left for them to claim.
 *
 * The village is written first. If that succeeds and stamping the request fails,
 * the worst case is an approved admin whose request still reads "pending" —
 * visible and fixable. The other order could show an approval that granted
 * nothing, which nobody would think to check.
 */
export async function decideAdminRequest(
  request: AdminRequest,
  decision: 'approved' | 'rejected',
  input: Decision
): Promise<void> {
  if (decision === 'approved') {
    await addVillageAdmin(request.villageId, {
      uid: request.uid,
      email: request.email,
      name: request.name,
      role: request.role,
      phone: request.phone,
      verifiedVia: input.verifiedVia,
      verifiedNote: input.verifiedNote,
      verifiedBy: input.by,
      termEndsAt: input.termEndsAt,
    });
  }

  await updateDoc(doc(col(), request.id), {
    status: decision,
    decidedAt: serverTimestamp(),
    decidedBy: input.by,
    verifiedVia: input.verifiedVia,
    verifiedNote: input.verifiedNote.trim(),
    termEndsAt: input.termEndsAt,
  });
}
