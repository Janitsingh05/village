import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { compressPhoto } from './imageCompress';
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

export async function listAnnouncements(villageId = activeVillageId()): Promise<Announcement[]> {
  const snap = await getDocs(query(col(villageId), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export function subscribeToAnnouncements(
  onChange: (rows: Announcement[]) => void,
  onError: (e: Error) => void,
  villageId = activeVillageId()
): () => void {
  return onSnapshot(
    query(col(villageId), orderBy('createdAt', 'desc')),
    (snap) => onChange(snap.docs.map((d) => fromDoc(d.id, d.data()))),
    (e) => onError(e)
  );
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
    try {
      const compressed = await compressPhoto(input.photoFile);
      const path =
        'villages/' + villageId + '/announcements/' + docRef.id + '/poster-' + Date.now() + '.jpg';
      const snap = await uploadBytes(storageRef(storage(), path), compressed, {
        contentType: compressed.type || 'image/jpeg',
        cacheControl: 'public,max-age=31536000',
      });
      photoUrl = await getDownloadURL(snap.ref);
    } catch {
      // The notice still goes out without its poster.
    }
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
