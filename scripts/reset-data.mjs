/**
 * Clears test data out of a live project.
 *
 * Everything filed during testing — complaints, their photos and recordings,
 * announcements, admin applications, resident objections — plus the Sarpanch
 * name, role and photo shown on the public card. Access is left alone unless
 * --revoke-phone names a number, because clearing test content and locking
 * someone out are different decisions and only one of them is reversible by
 * simply filing another complaint.
 *
 * This deletes real documents and cannot be undone, so nothing happens without
 * both a service account key and --yes. Run it once with neither and it prints
 * exactly what it would remove.
 *
 * Usage:
 *   node scripts/reset-data.mjs --key ./serviceAccount.json            # dry run
 *   node scripts/reset-data.mjs --key ./serviceAccount.json --yes      # do it
 *
 * Options:
 *   --village <id>          just this village (default: every village)
 *   --keep-profile          leave the Sarpanch name and photo alone
 *   --all-tenants           also clear adminRequests and adminReports, which
 *                           are not scoped to a village
 *   --revoke-phone <10 dig> take administrative access away from this number
 *
 * The key comes from the Firebase console: Project settings -> Service
 * accounts -> Generate new private key. .gitignore already covers it.
 */
import { readFileSync, existsSync } from 'node:fs';

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
const apply = args.yes === true;

if (!args.key || !existsSync(args.key)) {
  console.error(
    'Need a service account key:\n' +
      '  node scripts/reset-data.mjs --key ./serviceAccount.json\n\n' +
      'Firebase console -> Project settings -> Service accounts -> Generate new private key'
  );
  process.exit(1);
}

const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

initializeApp({ credential: cert(JSON.parse(readFileSync(args.key, 'utf8'))) });
const db = getFirestore();

const revoke = args['revoke-phone']
  ? String(args['revoke-phone']).replace(/\D/g, '').slice(-10)
  : null;

if (args['revoke-phone'] && revoke.length !== 10) {
  console.error('--revoke-phone needs ten digits, got: ' + args['revoke-phone']);
  process.exit(1);
}

let removed = 0;

const tenDigits = (v) => String(v || '').replace(/\D/g, '').slice(-10);

/**
 * Takes administrative access away from one number, everywhere it could come
 * back from.
 *
 * The same three moves the super admin screen makes, for the same reasons: the
 * number leaves adminPhone and adminPhones so it can never re-attach itself,
 * its record and term date go, and adminUserIds is emptied outright — there is
 * no map from a signed-in UID back to the phone behind it, so instead of
 * guessing which one to drop, every device is made to prove itself again from
 * a number still on the list. Anyone still approved re-links on their next page
 * load; this one cannot.
 */
async function revokePhone(village, phone) {
  const data = village.data();
  const onPrimary = tenDigits(data.adminPhone) === phone;
  const inList = (data.adminPhones || []).some((p) => tenDigits(p) === phone);
  const record = await village.ref.collection('admins').doc(phone).get();

  if (!onPrimary && !inList && !record.exists) return false;

  console.log(
    (apply ? 'revoked ' : 'would revoke ') +
      '\t' +
      phone +
      (onPrimary ? ' (primary admin)' : '') +
      (record.exists ? ' · ' + (record.data().name || 'unnamed') : '')
  );

  if (!apply) return onPrimary;

  const patch = {
    adminPhones: (data.adminPhones || []).filter((p) => tenDigits(p) !== phone),
    adminUserIds: [],
    ['adminTermEnds.' + phone]: FieldValue.delete(),
  };

  if (onPrimary) {
    // The public card names whoever villagers should approach. Leaving a
    // revoked name up there is worse than showing nobody.
    Object.assign(patch, {
      adminPhone: '',
      adminName: '',
      adminRole: '',
      adminPhotoUrl: null,
      adminVerifiedAt: null,
    });
  }

  await village.ref.update(patch);
  if (record.exists) await record.ref.delete();

  // Tells the caller the public card is already blank, so it does not announce
  // clearing a name that has just been cleared.
  return onPrimary;
}

/**
 * Deletes a collection and everything under it.
 *
 * Firestore does not delete subcollections with their parent — a complaint's
 * photos and recording would outlive the complaint and sit in the project
 * forever, invisible and still billable.
 */
async function purge(ref, label) {
  const snap = await ref.get();
  if (snap.empty) return;

  for (const doc of snap.docs) {
    for (const sub of await doc.ref.listCollections()) {
      await purge(sub, label + '/' + doc.id + '/' + sub.id);
    }
    if (apply) await doc.ref.delete();
    removed++;
  }
  console.log((apply ? 'deleted ' : 'would delete ') + snap.size + '\t' + label);
}

const villages = args.village
  ? [await db.collection('villages').doc(args.village).get()]
  : (await db.collection('villages').get()).docs;

for (const village of villages) {
  if (!village.exists) {
    console.error('No such village: ' + args.village);
    process.exit(1);
  }
  console.log('\n— ' + (village.data().name || village.id) + ' (' + village.id + ')');

  await purge(village.ref.collection('complaints'), 'complaints');
  await purge(village.ref.collection('announcements'), 'announcements');

  const cardCleared = revoke ? await revokePhone(village, revoke) : false;

  if (!args['keep-profile'] && !cardCleared) {
    const { adminName, adminRole, adminPhotoUrl } = village.data();
    if (adminName || adminRole || adminPhotoUrl) {
      console.log(
        (apply ? 'cleared ' : 'would clear ') + '\tSarpanch card: ' + (adminName || '—')
      );
      // The number and its admin record stay: this clears what the village
      // sees, not who is allowed to sign in.
      if (apply) {
        await village.ref.update({ adminName: '', adminRole: '', adminPhotoUrl: null });
      }
    }
  }
}

if (args['all-tenants']) {
  console.log('');
  await purge(db.collection('adminRequests'), 'adminRequests');
  await purge(db.collection('adminReports'), 'adminReports');
}

console.log(
  '\n' +
    (apply
      ? 'Done. ' + removed + ' documents deleted.'
      : 'Dry run — nothing was touched. ' +
        removed +
        ' documents would go. Add --yes to actually delete them.')
);
