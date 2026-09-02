import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { db } from './firebase';
import { ensureAnonymous } from './auth';
import type { AdminReport } from './types';

/**
 * Residents disputing who is shown as their Sarpanch.
 *
 * Every other check in this app happens before access is granted, by one super
 * admin looking at documents. This is the check that keeps happening afterwards,
 * done by the two thousand people who actually know whether the name on the
 * card is their Sarpanch. It is the cheapest verification channel there is and
 * the only one that notices when a genuine admin's term quietly ends.
 *
 * No name or phone is collected. Someone contradicting the person who runs
 * their village should not have to identify themselves to do it, and an
 * anonymous report is still worth reading — it tells the super admin where to
 * look, not what to conclude.
 */
function col() {
  return collection(db(), 'adminReports');
}

const MAX_REASON = 500;

function toMillis(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'number') return v;
  return Date.now();
}

export async function reportAdmin(input: {
  villageId: string;
  villageName: string;
  aboutName: string;
  reason: string;
}): Promise<void> {
  const reason = input.reason.trim().slice(0, MAX_REASON);
  if (!reason) throw new Error('EMPTY');

  // Still anonymous in every way that matters — no name or number is stored,
  // and the account is invisible to the person using it. It exists so a flood
  // can be attributed and stopped.
  await ensureAnonymous();

  await addDoc(col(), {
    villageId: input.villageId,
    villageName: input.villageName.slice(0, 120),
    // Captured rather than looked up later: renaming the admin must not erase
    // what the report was about.
    aboutName: input.aboutName.slice(0, 80),
    reason,
    status: 'open',
    createdAt: serverTimestamp(),
  });
}

export function subscribeToAdminReports(
  onChange: (rows: AdminReport[]) => void,
  onError: (e: Error) => void
): () => void {
  return onSnapshot(
    query(col(), orderBy('createdAt', 'desc')),
    (snap) =>
      onChange(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            villageId: data.villageId ?? '',
            villageName: data.villageName ?? '',
            aboutName: data.aboutName ?? '',
            reason: data.reason ?? '',
            status: data.status === 'reviewed' ? 'reviewed' : 'open',
            createdAt: toMillis(data.createdAt),
          };
        })
      ),
    (e) => onError(e)
  );
}

export async function markReportReviewed(id: string): Promise<void> {
  await updateDoc(doc(col(), id), { status: 'reviewed' });
}
