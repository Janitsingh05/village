import {
  collection,
  deleteDoc,
  getCountFromServer,
  limit as fsLimit,
  where,
  type QueryConstraint,
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
import { MAX_PHOTOS, complaintRef } from './config';
import { activeVillageId } from './tenant';
import { preparePhoto } from './imageCompress';
import { ensureAnonymous, currentUid } from './auth';
import { maskPhone } from './format';
import type { Complaint, ComplaintStatus, NewComplaintInput, StatusEvent } from './types';

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
    // The stored value wins. Recomputing it here was how a receipt could show
    // one reference while the database held another: the stored one is stamped
    // from the client clock at write time, this one from the server timestamp,
    // and the lookup searches the stored field. Older rows have no `ref`, so
    // they still fall back to the computation.
    ref: typeof data.ref === 'string' && data.ref ? data.ref : complaintRef(id, createdAt),
    villageId: data.villageId ?? activeVillageId(),
    category: data.category,
    description: data.description ?? '',
    photoUrl: data.photoUrl ?? null,
    photoCount: typeof data.photoCount === 'number' ? data.photoCount : data.photoUrl ? 1 : 0,
    voiceNote:
      data.voiceNote && typeof data.voiceNote.seconds === 'number'
        ? { seconds: data.voiceNote.seconds, mimeType: data.voiceNote.mimeType ?? 'audio/webm' }
        : null,
    location: data.location ?? { ward: '' },
    status: (data.status as ComplaintStatus) ?? 'pending',
    reporterUid: data.reporterUid ?? '',
    reportedBy: {
      name: data.reportedBy?.name ?? '',
      phoneMasked: data.reportedBy?.phoneMasked ?? '',
    },
    resolutionPhotoUrl: data.resolutionPhotoUrl ?? null,
    resolutionNote: data.resolutionNote ?? null,
    feedback: data.feedback ?? null,
    // Clamped on read. serverTimestamp() is not allowed inside arrayUnion, so
    // these are stamped by the admin's own device — and one phone with the wrong
    // date writes a bogus entry into a public record and skews the village's
    // average resolution time. Anything before the complaint existed or more
    // than a day in the future is a clock, not a fact.
    timeline: Array.isArray(data.timeline)
      ? data.timeline
          .map((t: any) => ({ ...t, at: toMillis(t.at) }))
          .filter((t: StatusEvent) => t.at >= createdAt - 60_000 && t.at <= Date.now() + 86_400_000)
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
/**
 * Where the reporter's real phone number lives.
 *
 * A subcollection, because the complaint itself is world-readable and has to
 * stay that way — the public feed is the point of the app. This document is
 * readable only by the village's own admins, which is the exact set of people
 * who need to ring the person back.
 */
function contactDoc(villageId: string, complaintId: string) {
  return doc(complaintsCol(villageId), complaintId, 'private', 'contact');
}

/** The reporter's number, for an admin who needs to call them. Null otherwise. */
export async function getReporterPhone(
  complaintId: string,
  villageId = activeVillageId()
): Promise<string | null> {
  try {
    const snap = await getDoc(contactDoc(villageId, complaintId));
    return snap.exists() ? (snap.data().phone as string) : null;
  } catch {
    // Not an admin of this village, or offline. Either way the masked number is
    // already on screen; this only ever adds to it.
    return null;
  }
}

/** media keys: 'photo-0' … 'photo-2' and 'voice' from the citizen, 'proof' from the admin. */
function mediaDoc(villageId: string, complaintId: string, kind: string) {
  return doc(complaintsCol(villageId), complaintId, 'media', kind);
}

/** Admin proof photo: same split, but an admin may patch the complaint. */
async function storePhoto(
  villageId: string,
  complaintId: string,
  file: File,
  kind: 'photo' | 'proof'
): Promise<string | null> {
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
  kind = 'photo-0',
  villageId = activeVillageId()
): Promise<string | null> {
  const snap = await getDoc(mediaDoc(villageId, complaintId, kind));
  return snap.exists() ? (snap.data().data as string) : null;
}

/**
 * Every photo on a complaint, in order. Missing entries are dropped rather
 * than failing the lot — one unreadable image should not blank the gallery.
 */
export async function getComplaintPhotos(
  complaintId: string,
  count: number,
  villageId = activeVillageId()
): Promise<string[]> {
  const wanted = Math.min(Math.max(count, 0), MAX_PHOTOS);
  const results = await Promise.all(
    Array.from({ length: wanted }, (_, i) =>
      getFullPhoto(complaintId, 'photo-' + i, villageId).catch(() => null)
    )
  );
  return results.filter((d): d is string => Boolean(d));
}


/** Live list — used by the public feed and the admin dashboard. */
/**
 * How many complaints a feed loads at once.
 *
 * This query had no limit at all, which meant every screen opened a live
 * listener over the entire collection — and every row carries a base64
 * thumbnail. At 500 complaints that is around 18 MB down a 3G connection on
 * each page load, billed as 500 document reads each time. It felt fine only
 * because the pilot had a handful of rows; it would have broken on the day the
 * app started working.
 */
export const FEED_PAGE = 40;

export interface FeedOptions {
  villageId?: string;
  max?: number;
  /** Filter in the query, not after it. See the note below. */
  status?: ComplaintStatus;
  /** Only this reporter's complaints — what "my complaints" needs. */
  reporterUid?: string;
}

/**
 * A page of complaints, newest first.
 *
 * Filters belong in the query. Adding the limit fixed a real cost problem and
 * created a correctness one in the same move: every screen took the 40 newest
 * complaints and then filtered them in JavaScript, so an admin asking for
 * "pending" saw only pending complaints that happened to fall inside the 40
 * newest overall. As a village got busier the old unresolved ones — exactly the
 * ones that need chasing — dropped out of the queue with no error and no way to
 * reach them. "My complaints" had the same shape and was worse: once forty
 * newer complaints existed anywhere in the village, a citizen's own report
 * stopped appearing and the page told them they had never filed anything.
 *
 * Each filtered form needs a composite index; they are in
 * firestore.indexes.json, and Firestore only complains about a missing one at
 * runtime, in production.
 */
export function subscribeToComplaints(
  onChange: (rows: Complaint[]) => void,
  onError: (e: Error) => void,
  options: FeedOptions = {}
): () => void {
  const villageId = options.villageId ?? activeVillageId();
  const parts: QueryConstraint[] = [];

  if (options.status) parts.push(where('status', '==', options.status));
  if (options.reporterUid) parts.push(where('reporterUid', '==', options.reporterUid));
  parts.push(orderBy('createdAt', 'desc'), fsLimit(options.max ?? FEED_PAGE));

  return onSnapshot(
    query(complaintsCol(villageId), ...parts),
    (snap) => onChange(snap.docs.map((d) => fromDoc(d.id, d.data()))),
    (e) => onError(e)
  );
}

/**
 * The three headline numbers, counted on the server.
 *
 * An aggregation query costs one read and returns a number, instead of
 * downloading every complaint to call `.length` on it. That is the only reason
 * the home page can show a true total while the feed below it loads forty rows.
 *
 * The averages beside them still come from the loaded window — a mean needs the
 * documents — so they describe recent complaints, and the labels say so.
 */
export async function countComplaints(
  villageId = activeVillageId()
): Promise<{ total: number; pending: number; resolved: number; inProgress: number }> {
  const col = complaintsCol(villageId);
  const [total, pending, resolved, inProgress] = await Promise.all([
    getCountFromServer(col),
    getCountFromServer(query(col, where('status', '==', 'pending'))),
    getCountFromServer(query(col, where('status', '==', 'resolved'))),
    getCountFromServer(query(col, where('status', '==', 'in_progress'))),
  ]);
  return {
    total: total.data().count,
    pending: pending.data().count,
    resolved: resolved.data().count,
    inProgress: inProgress.data().count,
  };
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

  // An identity before the write, not a login before the report. See
  // ensureAnonymous — this is invisible to the villager.
  // Null when anonymous sign-in is switched off in the Firebase project, or
  // when this is a first-ever visit with no network. Filing goes ahead either
  // way: refusing here would break every complaint in a project that has not
  // enabled the provider yet, and the rules are the thing that decides whether
  // an unattributed write is acceptable — not this function.
  //
  // The cost of a missing UID is narrow and recoverable: the complaint does not
  // appear under "my complaints" on this device, and its owner cannot confirm
  // the fix. The reference on the receipt still finds it.
  const uid = (await ensureAnonymous()) ?? '';

  // Compress everything up front: an unusable photo is caught before the
  // complaint is written, and the thumbnail must be in the first write because
  // the rules let a citizen create a complaint but never update one.
  let thumb: string | null = null;
  const fulls: string[] = [];

  for (const file of input.photoFiles.slice(0, MAX_PHOTOS)) {
    try {
      const prepared = await preparePhoto(file);
      if (thumb === null) thumb = prepared.thumb;
      fulls.push(prepared.full);
    } catch {
      // Skip this one; a bad photo must not cost the citizen their complaint.
    }
  }

  // The complaint document goes first, and everything else hangs off it.
  //
  // The recording used to be written before it, so that a failed audio write
  // meant no complaint at all — for a spoken complaint the audio is the
  // complaint. That ordering cannot survive the rules that now check ownership:
  // a media rule asking "did this caller file the parent complaint?" has
  // nothing to read if the parent does not exist yet.
  //
  // The trade is a narrow one. If the audio write fails after the complaint
  // lands, the reporter sees the error and the player says the recording could
  // not be found, rather than the complaint vanishing. That is the better of
  // the two failures.
  await setDoc(docRef, {
    villageId,
    // Stored, not only derived. The reference is the one thing a villager
    // writes on paper or reads out over a phone, and until now nothing could
    // look it up again — it was a one-way hash computed for display.
    ref: complaintRef(docRef.id, now),
    category: input.category,
    description: input.description.trim(),
    // Only the first thumbnail rides on the complaint — the feed loads these,
    // so putting all of them here would make the list heavy on a 3G connection.
    photoUrl: thumb,
    photoCount: fulls.length,
    // The marker rides on the complaint so a feed row can show a play button
    // without reading the audio; the clip itself is written below.
    voiceNote: input.voice
      ? { seconds: input.voice.seconds, mimeType: input.voice.mimeType }
      : null,
    location: {
      ward: input.ward,
      ...(input.lat != null ? { lat: input.lat, lng: input.lng } : {}),
      ...(input.address ? { address: input.address } : {}),
    },
    status: 'pending' as ComplaintStatus,
    reporterUid: uid,
    reportedBy: {
      name: input.reporterName.trim(),
      phoneMasked: maskPhone(input.reporterPhone.trim()),
    },
    resolutionPhotoUrl: null,
    resolutionNote: null,
    feedback: null,
    timeline: [{ status: 'pending', at: now }],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (input.voice) {
    await setDoc(mediaDoc(villageId, docRef.id, 'voice'), {
      data: input.voice.dataUrl,
      mimeType: input.voice.mimeType,
      seconds: input.voice.seconds,
      createdAt: serverTimestamp(),
    });
  }

  // The number the Panchayat will actually ring, out of public reach. A failure
  // here costs a callback, not the report.
  const phone = input.reporterPhone.replace(/\D/g, '').slice(-10);
  if (phone) {
    await setDoc(contactDoc(villageId, docRef.id), {
      phone,
      createdAt: serverTimestamp(),
    }).catch(() => {
      // The masked number is on the complaint and the reporter can be reached
      // through the app; losing this is a degraded complaint, not a lost one.
    });
  }

  await Promise.all(
    fulls.map((data, i) =>
      setDoc(mediaDoc(villageId, docRef.id, 'photo-' + i), {
        data,
        createdAt: serverTimestamp(),
      }).catch(() => {
        // Best-effort, unlike the recording: the feed still shows the
        // thumbnail, so only the full view loses one image.
      })
    )
  );

  return docRef.id;
}

/**
 * The recorded complaint, fetched only when someone presses play.
 *
 * Returns null when the clip never made it — the marker on the complaint is
 * written first and the audio second, so a dropped connection between the two
 * leaves a play button with nothing behind it.
 */
export async function getVoiceNote(
  complaintId: string,
  villageId = activeVillageId()
): Promise<{ dataUrl: string; mimeType: string } | null> {
  const snap = await getDoc(mediaDoc(villageId, complaintId, 'voice'));
  if (!snap.exists()) return null;
  const data = snap.data();
  return typeof data.data === 'string'
    ? { dataUrl: data.data, mimeType: data.mimeType ?? 'audio/webm' }
    : null;
}

/* -------------------------------- deleting -------------------------------- */

/** Every media key a complaint can carry, for a delete that leaves nothing. */
const MEDIA_KINDS = ['photo-0', 'photo-1', 'photo-2', 'voice', 'proof'];

/**
 * Removes a complaint and everything underneath it.
 *
 * Firestore does not delete a subcollection with its parent, so the photos and
 * the recording have to go first — otherwise they outlive the complaint,
 * invisible in the console and still counted against the free tier. The keys
 * are a fixed list rather than a query because a client cannot list a
 * subcollection, and every one a complaint can have is known here anyway.
 *
 * Deleting is the super admin's alone. A village admin moves a complaint
 * through its statuses and adds proof, and that is the whole of their power
 * over it: a public feed the office being complained about can quietly edit is
 * not a public feed. The rules enforce the same split.
 */
export async function deleteComplaint(
  complaintId: string,
  villageId = activeVillageId()
): Promise<void> {
  await deleteDoc(contactDoc(villageId, complaintId)).catch(() => undefined);
  await Promise.all(
    MEDIA_KINDS.map((kind) =>
      deleteDoc(mediaDoc(villageId, complaintId, kind)).catch(() => {
        // Most complaints have none of these; a missing document is the normal
        // case, not a failure.
      })
    )
  );
  await deleteDoc(doc(complaintsCol(villageId), complaintId));
}

/**
 * Empties a village's feed. For clearing a pilot, not for everyday use.
 *
 * Sequential on purpose: this is dozens of deletes on a rural connection, and
 * firing them all at once is how a phone ends up with half of them done and no
 * way to tell which half. `onProgress` lets the screen count up so nobody
 * decides it has hung and closes the tab midway.
 */
export async function deleteAllComplaints(
  villageId = activeVillageId(),
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  // Paged, because the only thing wanted here is the ids and the web SDK has
  // no select() — reading the collection in one go would pull every base64
  // thumbnail down first, which for 500 complaints is the 18 MB this file
  // spends the rest of its length avoiding.
  let done = 0;
  for (;;) {
    const snap = await getDocs(query(complaintsCol(villageId), fsLimit(50)));
    if (snap.empty) break;
    for (const row of snap.docs) {
      await deleteComplaint(row.id, villageId);
      onProgress?.(++done, done + snap.size - 1);
    }
  }

  return done;
}

/**
 * Finds a complaint from the reference printed on its receipt.
 *
 * The only recovery path a citizen has. "My complaints" is matched to this
 * device, so a cleared browser or a new phone loses the list — and the person
 * most likely to lose it is the one least able to file again from memory.
 */
export async function findComplaintByRef(
  ref: string,
  villageId = activeVillageId()
): Promise<Complaint | null> {
  const code = ref.trim().toUpperCase();
  if (!code) return null;

  const snap = await getDocs(
    query(complaintsCol(villageId), where('ref', '==', code), fsLimit(1))
  );
  const hit = snap.docs[0];
  return hit ? fromDoc(hit.id, hit.data()) : null;
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
  /** Averaged over every resolved complaint, not just this month. */
  avgResolutionDays: number | null;
  topCategory: string | null;
  /** Distinct phone numbers that have ever filed — "residents taking part". */
  uniqueReporters: number;
}

/**
 * When a complaint was actually marked resolved.
 *
 * Deliberately not updatedAt: that moves on any write, including a citizen
 * tapping "the problem is fixed" months later, which would drag an old
 * complaint into this month's resolved count.
 */
function resolvedAt(c: Complaint): number | null {
  const event = [...c.timeline].reverse().find((t) => t.status === 'resolved');
  return event ? event.at : null;
}

export function computeStats(rows: Complaint[]): ComplaintStats {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const resolved = rows.filter((c) => c.status === 'resolved');

  const durations = resolved
    .map((c) => {
      const done = resolvedAt(c);
      return done == null ? null : done - c.createdAt;
    })
    .filter((d): d is number => d != null && d >= 0);

  const counts = new Map<string, number>();
  rows.forEach((c) => counts.set(c.category, (counts.get(c.category) || 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  // Counted by device rather than by phone number, now that the number is not
  // on the document. Slightly different meaning — one person on two phones
  // counts twice — and no worse than the masked number would have been.
  const reporters = new Set(rows.map((c) => c.reporterUid).filter(Boolean));

  return {
    total: rows.length,
    pending: rows.filter((c) => c.status === 'pending').length,
    inProgress: rows.filter((c) => c.status === 'in_progress').length,
    resolved: resolved.length,
    closed: rows.filter((c) => c.status === 'closed').length,
    newThisMonth: rows.filter((c) => c.createdAt >= monthStart.getTime()).length,
    resolvedThisMonth: resolved.filter((c) => {
      const done = resolvedAt(c);
      return done != null && done >= monthStart.getTime();
    }).length,
    avgResolutionDays: durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length / 86400000
      : null,
    topCategory: top ? top[0] : null,
    uniqueReporters: reporters.size,
  };
}

/** Citizen confirms the fix, or says the problem is still there. */
/**
 * The citizen's verdict on whether the fix was real.
 *
 * Restricted to the device that filed the complaint. It used to be open to any
 * anonymous caller on any complaint, which meant the one signal a villager has
 * that a repair actually happened could be set from a browser console by the
 * office being complained about.
 */
export async function submitFeedback(
  id: string,
  verdict: 'still_open' | 'confirmed',
  villageId = activeVillageId()
): Promise<void> {
  await ensureAnonymous();
  await updateDoc(doc(complaintsCol(villageId), id), {
    feedback: { verdict, at: Date.now() },
    updatedAt: serverTimestamp(),
  });
}

/** Whether this device is the one that filed a complaint. */
export function isOwnComplaint(complaint: Complaint): boolean {
  const uid = currentUid();
  return Boolean(uid && complaint.reporterUid === uid);
}
