import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  limit as fsLimit,
  startAfter,
  type QueryDocumentSnapshot,
  type DocumentData,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { preparePhoto } from './imageCompress';
import { activeVillageId } from './tenant';
import type { Announcement, AnnouncementKind } from './types';


function col(villageId = activeVillageId()) {
  return collection(db(), 'villages', villageId, 'announcements');
}

function toMillis(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'number') return v;
  return Date.now();
}

function fromDoc(id: string, data: Record<string, any>): Announcement {
  return {
    id,
    villageId: data.villageId ?? activeVillageId(),
    kind: (data.kind as AnnouncementKind) ?? 'general',
    title: data.title ?? '',
    body: data.body ?? '',
    photoUrl: data.photoUrl ?? null,
    postedBy: data.postedBy ?? '',
    createdAt: toMillis(data.createdAt),
  };
}

/* -------------------------------- public -------------------------------- */

/**
 * How many notices a screen loads at once.
 *
 * This collection had no limit and a live listener over all of it, with a
 * base64 poster inline on every document — the same shape the complaints feed
 * was fixed for and this one was never revisited. Fifty notices is a few
 * megabytes and fifty document reads on every open, on a 3G phone.
 */
export const ANNOUNCE_PAGE = 20;

export function subscribeToAnnouncements(
  onChange: (
    rows: Announcement[],
    cursor: QueryDocumentSnapshot<DocumentData> | null
  ) => void,
  onError: (e: Error) => void,
  villageId = activeVillageId(),
  max = ANNOUNCE_PAGE
): () => void {
  return onSnapshot(
    query(col(villageId), orderBy('createdAt', 'desc'), fsLimit(max)),
    (snap) =>
      onChange(
        snap.docs.map((d) => fromDoc(d.id, d.data())),
        snap.docs.length === max ? snap.docs[snap.docs.length - 1] : null
      ),
    (e) => onError(e)
  );
}

export async function loadMoreAnnouncements(
  after: QueryDocumentSnapshot<DocumentData>,
  villageId = activeVillageId(),
  max = ANNOUNCE_PAGE
): Promise<{ rows: Announcement[]; cursor: QueryDocumentSnapshot<DocumentData> | null }> {
  const snap = await getDocs(
    query(col(villageId), orderBy('createdAt', 'desc'), startAfter(after), fsLimit(max))
  );
  return {
    rows: snap.docs.map((d) => fromDoc(d.id, d.data())),
    cursor: snap.docs.length === max ? snap.docs[snap.docs.length - 1] : null,
  };
}

export async function createAnnouncement(
  input: { title: string; body: string; postedBy: string; kind: AnnouncementKind; photoFile?: File | null },
  villageId = activeVillageId()
): Promise<string> {
  const title = input.title.trim();
  const body = input.body.trim();

  const docRef = doc(col(villageId));
  let photoUrl: string | null = null;

  if (input.photoFile) {
    // A notice board poster only ever needs to be legible in the feed, so the
    // thumbnail is the whole story here — no second document. If it will not
    // fit, that is worth saying: this used to be swallowed, and an admin who
    // attached a poster would find their notice posted without one.
    photoUrl = (await preparePhoto(input.photoFile)).thumb;
    if (!photoUrl) throw new Error('PHOTO_TOO_LARGE');
  }

  await setDoc(docRef, {
    villageId,
    kind: input.kind,
    title,
    body,
    photoUrl,
    postedBy: input.postedBy,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}
