/**
 * Checks that the deployed Firestore rules still refuse what they must.
 *
 * The emulator needs Java, which is not installed here, so `firebase
 * emulators:exec` is not an option — and rules that have been rewritten six
 * times without a single test are exactly the thing that quietly stops
 * refusing. This probes the live project over the REST API instead, using the
 * same public config any visitor's browser has.
 *
 * It only asserts refusals. Every check here is something an attacker would
 * try, so a pass writes nothing and there is nothing to clean up afterwards —
 * which is what makes it safe to run against production whenever the rules
 * change. The permissions that must *work* are proved by the app working.
 *
 * Usage:
 *   node scripts/probe-rules.mjs                 # reads keys from .env.local
 *   node scripts/probe-rules.mjs --village <id>
 */
import fs from 'node:fs';

function envValue(key) {
  if (process.env[key]) return process.env[key];
  try {
    const line = fs
      .readFileSync('.env.local', 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith(key + '='));
    return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '') : '';
  } catch {
    return '';
  }
}

const API_KEY = envValue('NEXT_PUBLIC_FIREBASE_API_KEY');
const PROJECT = envValue('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
const args = process.argv.slice(2);
const VILLAGE =
  args[args.indexOf('--village') + 1] && args.includes('--village')
    ? args[args.indexOf('--village') + 1]
    : envValue('NEXT_PUBLIC_VILLAGE_ID') || 'pilot-village';

if (!API_KEY || !PROJECT) {
  console.error('Missing NEXT_PUBLIC_FIREBASE_API_KEY / _PROJECT_ID (checked env and .env.local).');
  process.exit(1);
}

const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

/** An anonymous account, which is what every citizen of this app has. */
async function anonToken() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}' }
  );
  const body = await res.json();
  if (body.error) {
    console.error(
      'Could not create an anonymous account: ' +
        body.error.message +
        '\nAnonymous sign-in must be enabled, or every complaint in the village is refused.'
    );
    process.exit(1);
  }
  return { uid: body.localId, token: body.idToken };
}

async function call(method, path, { token, body } = {}) {
  const url = DOCS + path + (token ? '' : (path.includes('?') ? '&' : '?') + 'key=' + API_KEY);
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const complaintDoc = (uid) => ({
  fields: {
    villageId: { stringValue: VILLAGE },
    ref: { stringValue: 'GC-000000-000000' },
    category: { stringValue: 'other' },
    description: { stringValue: 'rules probe' },
    photoUrl: { nullValue: null },
    photoCount: { integerValue: '0' },
    voiceNote: { nullValue: null },
    location: { mapValue: { fields: { ward: { stringValue: 'probe' } } } },
    status: { stringValue: 'pending' },
    reporterUid: { stringValue: uid },
    reportedBy: {
      mapValue: {
        fields: { name: { stringValue: 'probe' }, phoneMasked: { stringValue: '98xxxxxx10' } },
      },
    },
    resolutionPhotoUrl: { nullValue: null },
    resolutionNote: { nullValue: null },
    feedback: { nullValue: null },
    timeline: { arrayValue: { values: [] } },
    createdAt: { timestampValue: '2026-01-01T00:00:00Z' },
    updatedAt: { timestampValue: '2026-01-01T00:00:00Z' },
  },
});

const results = [];
function record(name, refused, detail) {
  results.push({ name, refused, detail });
  console.log(`${refused ? ' PASS ' : ' FAIL '} ${name}${detail ? '  — ' + detail : ''}`);
}

/** A check passes when the write or read was refused. */
async function mustRefuse(name, run) {
  const { status, json } = await run();
  const refused = status === 403 || json?.error?.status === 'PERMISSION_DENIED';
  record(name, refused, refused ? '' : 'got ' + status);
}

console.log(`probing ${PROJECT} / ${VILLAGE}\n`);
const me = await anonToken();
const other = await anonToken();

await mustRefuse('complaint create, not signed in', () =>
  call('POST', `/villages/${VILLAGE}/complaints`, { body: complaintDoc('nobody') })
);

await mustRefuse('complaint create, claiming another uid', () =>
  call('POST', `/villages/${VILLAGE}/complaints`, {
    token: me.token,
    body: complaintDoc(other.uid),
  })
);

await mustRefuse("private contact read, not the village's admin", () =>
  call('GET', `/villages/${VILLAGE}/complaints/anything/private/contact`)
);

await mustRefuse('media write to an arbitrary complaint', () =>
  call('PATCH', `/villages/${VILLAGE}/complaints/anything/media/photo-0`, {
    token: me.token,
    body: { fields: { data: { stringValue: 'data:image/png;base64,AAAA' } } },
  })
);

await mustRefuse('adminRequests media write, not signed in', () =>
  call('PATCH', '/adminRequests/anything/media/id-proof', {
    body: { fields: { data: { stringValue: 'junk' } } },
  })
);

await mustRefuse('adminRequests read (they carry ID documents)', () =>
  call('GET', '/adminRequests')
);

await mustRefuse('adminReports read (they are meant to be private)', () =>
  call('GET', '/adminReports')
);

await mustRefuse('village write by a signed-in citizen', () =>
  call('PATCH', `/villages/${VILLAGE}?updateMask.fieldPaths=adminName`, {
    token: me.token,
    body: { fields: { adminName: { stringValue: 'probe' } } },
  })
);

await mustRefuse('granting yourself admin on a village', () =>
  call('PATCH', `/villages/${VILLAGE}?updateMask.fieldPaths=adminUserIds`, {
    token: me.token,
    body: { fields: { adminUserIds: { arrayValue: { values: [{ stringValue: me.uid }] } } } },
  })
);

await mustRefuse('writing yourself a superadmin role', () =>
  call('PATCH', `/users/${me.uid}?updateMask.fieldPaths=role`, {
    token: me.token,
    body: { fields: { role: { stringValue: 'superadmin' } } },
  })
);

/* --- the public feed is public on purpose; what matters is what is in it --- */

const feed = await call('GET', `/villages/${VILLAGE}/complaints?pageSize=5`);
const leaked = (feed.json.documents || []).filter(
  (d) => d.fields?.reportedBy?.mapValue?.fields?.phone
);
record(
  'no raw phone number on a public complaint',
  leaked.length === 0,
  leaked.length ? leaked.length + ' complaint(s) still carry reportedBy.phone' : ''
);

const failed = results.filter((r) => !r.refused);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed` +
    (failed.length ? ' — ' + failed.map((f) => f.name).join('; ') : '')
);
process.exit(failed.length ? 1 : 0);
