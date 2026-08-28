/**
 * One-time Firestore bootstrap.
 *
 * Creates the two documents that cannot be created from inside the app,
 * because each one is what grants the permission needed to create it:
 *   - users/{uid} with role "superadmin"
 *   - the first village, with its admin's phone number
 *
 * Usage:
 *   node scripts/bootstrap.mjs --key ./serviceAccount.json
 *
 * Get serviceAccount.json from the Firebase console:
 *   Project settings -> Service accounts -> Generate new private key
 * Keep it out of git (.gitignore already covers *serviceAccount*.json).
 *
 * Values come from .env.local unless overridden by flags:
 *   --village-id --village-name --state --district
 *   --admin-phone --admin-name --superadmin-uid
 */
import { readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    out[key] = next && !next.startsWith('--') ? (i++, next) : 'true';
  }
  return out;
}

function readEnvLocal() {
  const env = {};
  if (!existsSync('.env.local')) return env;
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

const args = parseArgs(process.argv.slice(2));
const env = readEnvLocal();

const keyPath = args.key || './serviceAccount.json';
if (!existsSync(keyPath)) {
  console.error('Service account key not found at ' + keyPath);
  console.error('Firebase console -> Project settings -> Service accounts -> Generate new private key');
  process.exit(1);
}

let admin;
try {
  admin = await import('firebase-admin');
} catch {
  console.error('firebase-admin is not installed. Run:  npm install');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
const app = admin.default.initializeApp({
  credential: admin.default.credential.cert(serviceAccount),
});
const db = app.firestore();

const villageId = args['village-id'] || env.NEXT_PUBLIC_VILLAGE_ID || 'pilot-village';
const villageName = args['village-name'] || env.NEXT_PUBLIC_VILLAGE_NAME_HI || 'ग्राम पंचायत';
const state = args.state || '';
const district = args.district || env.NEXT_PUBLIC_VILLAGE_DISTRICT_HI || '';
const adminPhone = (args['admin-phone'] || '').replace(/\D/g, '').slice(-10);
const adminName = args['admin-name'] || '';
const superAdminUid = args['superadmin-uid'] || '';

if (!adminPhone || adminPhone.length !== 10) {
  console.error('Pass the village admin\'s 10-digit mobile number:  --admin-phone 98XXXXXXXX');
  console.error('This is how the Sarpanch is linked to the village on first sign-in.');
  process.exit(1);
}

console.log('\nAbout to write to project: ' + serviceAccount.project_id);
console.log('  villages/' + villageId);
console.log('    name         ' + villageName);
console.log('    district     ' + [district, state].filter(Boolean).join(', '));
console.log('    adminPhone   ' + adminPhone + (adminName ? '  (' + adminName + ')' : ''));
if (superAdminUid) console.log('  users/' + superAdminUid + '  role=superadmin');
else console.log('  (no --superadmin-uid given, skipping the super-admin user)');

const rl = createInterface({ input: stdin, output: stdout });
const answer = (await rl.question('\nProceed? [y/N] ')).trim().toLowerCase();
rl.close();
if (answer !== 'y' && answer !== 'yes') {
  console.log('Nothing written.');
  process.exit(0);
}

const villageRef = db.collection('villages').doc(villageId);
const existing = await villageRef.get();

await villageRef.set(
  {
    name: villageName,
    state,
    district,
    address: '',
    adminName,
    adminPhone,
    // Left empty on purpose: the admin's Auth UID does not exist yet and is
    // appended by the app the first time they sign in with this number.
    adminUserIds: existing.exists ? existing.data().adminUserIds || [] : [],
    createdAt: existing.exists
      ? existing.data().createdAt || admin.default.firestore.FieldValue.serverTimestamp()
      : admin.default.firestore.FieldValue.serverTimestamp(),
  },
  { merge: true }
);
console.log('villages/' + villageId + (existing.exists ? ' updated' : ' created'));

if (superAdminUid) {
  await db.collection('users').doc(superAdminUid).set(
    { role: 'superadmin', villageId, name: 'Super Admin' },
    { merge: true }
  );
  console.log('users/' + superAdminUid + ' set to role=superadmin');
}

console.log('\nDone. Next:');
console.log('  1. firebase deploy --only firestore:rules,storage');
console.log('  2. Sign in at /admin/login with ' + adminPhone + ' — the village links itself.');
console.log('  3. Open /admin/setup to confirm every check is green.');
process.exit(0);
