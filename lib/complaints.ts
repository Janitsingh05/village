import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  arrayUnion,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { complaintRef } from './config';
import { activeVillageId } from './tenant';
import { preparePhoto } from './imageCompress';
import type { Complaint, ComplaintStatus, NewComplaintInput } from './types';

// Every path here is scoped to villages/{villageId} so the data model is
// already multi-tenant even though Phase 1 pins a single village.

function complaintsCol(villageId = activeVillageId()) {
  return collection(db(), 'villages', villageId, 'complaints');
}

function toMillis(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'number') return v;
  return Date.now();
}

function fromDoc(id: string, data: Record<string, any>): Complaint {
  const createdAt = toMillis(data.createdAt);
  return {
    id,
    ref: complaintRef(id, createdAt),
    villageId: data.villageId ?? activeVillageId(),
    category: data.category,
    description: data.description ?? '',
    photoUrl: data.photoUrl ?? null,
    location: data.location ?? { ward: '' },
    status: (data.status as ComplaintStatus) ?? 'pending',
    reportedBy: data.reportedBy ?? { name: '', phone: '' },
    resolutionPhotoUrl: data.resolutionPhotoUrl ?? null,
    resolutionNote: data.resolutionNote ?? null,
    feedback: data.feedback ?? null,
    timeline: Array.isArray(data.timeline)
      ? data.timeline.map((t: any) => ({ ...t, at: toMillis(t.at) }))
      : [],
    createdAt,
    updatedAt: toMillis(data.updatedAt),
  };
}

/**
 * Photos are split across two documents: the thumbnail rides along on the
 * complaint so the feed renders without extra reads, and the full image lives
 * in its own doc that is only fetched when someone opens the complaint. See
 * lib/imageCompress.ts for why they are not in Cloud Storage.
 */
function mediaDoc(villageId: string, complaintId: string, kind: 'photo' | 'proof') {
  return doc(complaintsCol(villageId), complaintId, 'media', kind);
}

/** Admin proof photo: same split, but an admin may patch the complaint. */
async function storePhoto(
  villageId: string,
  complaintId: string,
  file: File,
  kind: 'photo' | 'proof'
): Promise<string> {
  const prepared = await preparePhoto(file);
  await setDoc(mediaDoc(villageId, complaintId, kind), {
    data: prepared.full,
    bytes: prepared.fullBytes,
    createdAt: serverTimestamp(),
  });
  return prepared.thumb;
}

/** Full-size image for the detail view; null when there is none. */
export async function getFullPhoto(
  complaintId: string,
  kind: 'photo' | 'proof' = 'photo',
  villageId = activeVillageId()
): Promise<string | null> {
  const snap = await getDoc(mediaDoc(villageId, complaintId, kind));
  return snap.exists() ? (snap.data().data as string) : null;
}

/** Newest-first list of complaints for the village. */
export async function listComplaints(villageId = activeVillageId()): Promise<Complaint[]> {
  const snap = await getDocs(query(complaintsCol(villageId), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

/** Live list — used by the public feed and the admin dashboard. */
export function subscribeToComplaints(
  onChange: (rows: Complaint[]) => void,
  onError: (e: Error) => void,
  villageId = activeVillageId()
): () => void {
  return onSnapshot(
    query(complaintsCol(villageId), orderBy('createdAt', 'desc')),
    (snap) => onChange(snap.docs.map((d) => fromDoc(d.id, d.data()))),
    (e) => onError(e)
  );
}

export async function getComplaint(id: string, villageId = activeVillageId()): Promise<Complaint | null> {
  const snap = await getDoc(doc(complaintsCol(villageId), id));
  return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
}

/**
 * Citizen submit.
 *
 * The thumbnail goes in on the first write, not as a follow-up patch: the
 * rules let an anonymous citizen create a complaint but never update one, so
 * a patch would be denied and the photo silently lost. The full image is a
 * separate document — if that write fails the complaint still stands, with
 * its thumbnail intact.
 */
export async function createComplaint(
  input: NewComplaintInput,
  villageId = activeVillageId()
): Promise<string> {
  const docRef = doc(complaintsCol(villageId));
  const now = Date.now();

  let thumb: string | null = null;
  let full: string | null = null;
  if (input.photoFile) {
    try {
      const prepared = await preparePhoto(input.photoFile);
      thumb = prepared.thumb;
      full = prepared.full;
    } catch {
      // An unusable photo must not cost the citizen their complaint.
    }
  }

  await setDoc(docRef, {
    villageId,
    category: input.category,
    description: input.description.trim(),
    photoUrl: thumb,
    location: {
      ward: input.ward,
      ...(input.lat != null ? { lat: input.lat, lng: input.lng } : {}),
    },
    status: 'pending' as ComplaintStatus,
    reportedBy: { name: input.reporterName.trim(), phone: input.reporterPhone.trim() },
    resolutionPhotoUrl: null,
    resolutionNote: null,
    feedback: null,
    timeline: [{ status: 'pending', at: now }],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (full) {
    try {
      await setDoc(mediaDoc(villageId, docRef.id, 'photo'), {
        data: full,
        createdAt: serverTimestamp(),
      });
    } catch {
      // The feed still shows the thumbnail; only the full view is missing.
    }
  }

  return docRef.id;
}

/** Admin: move a complaint along the pipeline, optionally with proof. */
export async function updateComplaintStatus(
  id: string,
  status: ComplaintStatus,
  note: string,
  proofFile: File | null,
  villageId = activeVillageId()
): Promise<void> {
  const docRef = doc(complaintsCol(villageId), id);
  const patch: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
    timeline: arrayUnion({ status, at: Date.now(), ...(note ? { note } : {}) }),
  };
  if (note) patch.resolutionNote = note;
  if (proofFile) patch.resolutionPhotoUrl = await storePhoto(villageId, id, proofFile, 'proof');

  await updateDoc(docRef, patch);
}

export interface ComplaintStats {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  closed: number;
  /** Filed within the current calendar month. */
  newThisMonth: number;
  resolvedThisMonth: number;
  avgResolutionDays: number | null;
  topCategory: string | null;
  /** Distinct phone numbers that have ever filed — "residents taking part". */
  uniqueReporters: number;
}

export function computeStats(rows: Complaint[]): ComplaintStats {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const resolved = rows.filter((c) => c.status === 'resolved');

  const durations = resolved
    .map((c) => {
      const done = [...c.timeline].reverse().find((t) => t.status === 'resolved');
      return done ? done.at - c.createdAt : null;
    })
    .filter((d): d is number => d != null && d >= 0);

  const counts = new Map<string, number>();
  rows.forEach((c) => counts.set(c.category, (counts.get(c.category) || 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  const reporters = new Set(
    rows.map((c) => (c.reportedBy.phone || '').trim()).filter(Boolean)
  );

  return {
    total: rows.length,
    pending: rows.filter((c) => c.status === 'pending').length,
    inProgress: rows.filter((c) => c.status === 'in_progress').length,
    resolved: resolved.length,
    closed: rows.filter((c) => c.status === 'closed').length,
    newThisMonth: rows.filter((c) => c.createdAt >= monthStart.getTime()).length,
    resolvedThisMonth: resolved.filter((c) => c.updatedAt >= monthStart.getTime()).length,
    avgResolutionDays: durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length / 86400000
      : null,
    topCategory: top ? top[0] : null,
    uniqueReporters: reporters.size,
  };
}

/** Citizen confirms the fix, or says the problem is still there. */
export async function submitFeedback(
  id: string,
  verdict: 'still_open' | 'confirmed',
  villageId = activeVillageId()
): Promise<void> {
  await updateDoc(doc(complaintsCol(villageId), id), {
    feedback: { verdict, at: Date.now() },
    updatedAt: serverTimestamp(),
  });
}
