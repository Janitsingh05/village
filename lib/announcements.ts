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
import { db, storage, isFirebaseConfigured } from './firebase';
import { compressPhoto } from './imageCompress';
import { activeVillageId } from './tenant';
import type { Announcement, AnnouncementKind } from './types';

const DEMO_KEY = 'gaonconnect:announcements';

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

/* ----------------------------- demo fallback ----------------------------- */

function demoRead(): Announcement[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw) as Announcement[];
  } catch {
    return [];
  }

  const now = Date.now();
  const seed: Announcement[] = [
    {
      id: 'a-1',
      villageId: activeVillageId(),
      kind: 'urgent',
      photoUrl: null,
      title: 'रविवार को पानी की सप्लाई बंद रहेगी',
      body: 'मरम्मत के काम की वजह से रविवार सुबह 8 बजे से शाम 4 बजे तक पानी की सप्लाई बंद रहेगी। कृपया पहले से पानी भर लें।',
      postedBy: 'सरपंच',
      createdAt: now - 2 * 86400000,
    },
    {
      id: 'a-2',
      villageId: activeVillageId(),
      kind: 'general',
      photoUrl: null,
      title: 'ग्राम सभा की बैठक — 15 तारीख़',
      body: 'पंचायत भवन में सुबह 11 बजे ग्राम सभा की बैठक रखी गई है। सभी ग्रामवासियों से उपस्थित होने का अनुरोध है।',
      postedBy: 'सरपंच',
      createdAt: now - 6 * 86400000,
    },
  ];
  try {
    window.localStorage.setItem(DEMO_KEY, JSON.stringify(seed));
  } catch {
    /* disposable demo data */
  }
  return seed;
}

function demoWrite(rows: Announcement[]) {
  window.localStorage.setItem(DEMO_KEY, JSON.stringify(rows));
}

/* -------------------------------- public -------------------------------- */

export async function listAnnouncements(villageId = activeVillageId()): Promise<Announcement[]> {
  if (!isFirebaseConfigured) return demoRead().sort((a, b) => b.createdAt - a.createdAt);
  const snap = await getDocs(query(col(villageId), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

export function subscribeToAnnouncements(
  onChange: (rows: Announcement[]) => void,
  onError: (e: Error) => void,
  villageId = activeVillageId()
): () => void {
  if (!isFirebaseConfigured) {
    listAnnouncements(villageId).then(onChange).catch((e) => onError(e as Error));
    return () => {};
  }
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

  if (!isFirebaseConfigured) {
    const id = 'a' + Date.now().toString(36);
    demoWrite([
      {
        id,
        villageId,
        kind: input.kind,
        title,
        body,
        photoUrl: input.photoFile ? await fileToDataUrl(input.photoFile) : null,
        postedBy: input.postedBy,
        createdAt: Date.now(),
      },
      ...demoRead(),
    ]);
    return id;
  }

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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
