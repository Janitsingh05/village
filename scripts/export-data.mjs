/**
 * Takes a copy of everything out of Firestore.
 *
 * There is no backup of this project anywhere, and a village's entire complaint
 * history lives in one free-tier database behind one super-admin account. That
 * is a single point of failure holding records people filed expecting them to
 * be kept — a deleted collection, a lost account or a project someone forgets
 * to keep alive takes years of a panchayat's work with it. Of everything still
 * outstanding on this app, having no copy is the one that cannot be fixed after
 * it matters.
 *
 * Photos and recordings are excluded by default. They are base64 inside the
 * documents and dwarf everything else — a backup nobody runs because it takes
 * twenty minutes is not a backup. Pass --media when the point is an archive
 * rather than a safety net.
 *
 * Usage:
 *   node scripts/export-data.mjs --key ./serviceAccount.json
 *   node scripts/export-data.mjs --key ./serviceAccount.json --media --out ./archive
 *
 * The key comes from the Firebase console: Project settings -> Service
 * accounts -> Generate new private key. .gitignore already covers it, and
 * covers ./backups too.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    out[key] = next && !next.startsWith('--') ? (i++, next) : true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const withMedia = args.media === true;
const outRoot = typeof args.out === 'string' ? args.out : './backups';

if (!args.key || !existsSync(args.key)) {
  console.error(
    'Need a service account key:\n' +
      '  node scripts/export-data.mjs --key ./serviceAccount.json\n\n' +
      'Firebase console -> Project settings -> Service accounts -> Generate new private key'
  );
  process.exit(1);
}

const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore, Timestamp } = await import('firebase-admin/firestore');

initializeApp({ credential: cert(JSON.parse(readFileSync(args.key, 'utf8'))) });
const db = getFirestore();

// One folder per run, named by the moment it was taken, so restoring means
// picking a date rather than guessing which file is newer.
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = path.join(outRoot, stamp);
mkdirSync(dir, { recursive: true });

/** Timestamps and refs do not survive JSON.stringify in a readable form. */
function plain(value) {
  if (value instanceof Timestamp) return { __time: value.toDate().toISOString() };
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}

let documents = 0;
let bytes = 0;

/** Walks a collection and everything beneath it into one array. */
async function dump(ref, label) {
  const snap = await ref.get();
  const rows = [];

  for (const doc of snap.docs) {
    const row = { __id: doc.id, ...plain(doc.data()) };

    for (const sub of await doc.ref.listCollections()) {
      // The media subcollection is where the base64 lives.
      if (!withMedia && sub.id === 'media') continue;
      const nested = await dump(sub, label + '/' + doc.id + '/' + sub.id);
      if (nested.length) (row.__sub ||= {})[sub.id] = nested;
    }

    rows.push(row);
    documents++;
  }

  return rows;
}

async function write(name, rows) {
  if (!rows.length) return;
  const json = JSON.stringify(rows, null, 2);
  const file = path.join(dir, name + '.json');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, json);
  bytes += json.length;
  console.log(String(rows.length).padStart(6) + '  ' + name);
}

console.log('exporting to ' + dir + (withMedia ? '' : '  (photos and audio skipped)') + '\n');

const villages = await db.collection('villages').get();
for (const village of villages.docs) {
  const base = 'villages/' + village.id;
  await write(base + '/village', [{ __id: village.id, ...plain(village.data()) }]);
  documents++;

  for (const sub of await village.ref.listCollections()) {
    await write(base + '/' + sub.id, await dump(sub, base + '/' + sub.id));
  }
}

for (const name of ['adminRequests', 'adminReports', 'users']) {
  await write(name, await dump(db.collection(name), name));
}

writeFileSync(
  path.join(dir, 'manifest.json'),
  JSON.stringify(
    { takenAt: new Date().toISOString(), documents, media: withMedia, project: 'firestore' },
    null,
    2
  )
);

console.log(
  `\n${documents} documents, ${Math.round(bytes / 1024)} KB` +
    (withMedia ? '' : '\nPhotos and recordings were not included — pass --media for an archive.')
);
