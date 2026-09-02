# GaonConnect — गाँव / सोसाइटी शिकायत ऐप

Mobile-first PWA where a villager reports a civic problem with a photo, and the
Sarpanch / society secretary resolves it from a dashboard. Every complaint is
public, so residents can see progress instead of chasing anyone.

All three phases are built: citizen reporting, the admin dashboard, announcements,
a Hindi/English toggle, and super-admin village onboarding.

## Run it

```bash
npm install
cp .env.local.example .env.local   # already done for you
npm run dev                        # http://localhost:3000
```

### Firebase setup

There is no offline/demo mode: Firebase is the only backend, and without keys
the app shows a setup screen rather than pretending to work. A villager filing
a complaint the Panchayat can never see is worse than an honest error.

1. Create a project at console.firebase.google.com. Enable **Firestore** and
   **Authentication → Phone**. Cloud Storage is *not* needed — see below.
2. Project settings → Your apps → Web app → copy the config into `.env.local`.
3. Create the village and super-admin documents, which cannot be made from
   inside the app because each one grants the permission needed to create it:

   ```bash
   # Project settings -> Service accounts -> Generate new private key
   npm run bootstrap -- --key ./serviceAccount.json      --admin-phone 98XXXXXXXX --admin-name "सरपंच जी"      --state Rajasthan --district Sikar
   ```

4. `firebase deploy --only firestore:rules`
5. Sign in at `/admin/login` with that number — the village links itself, because
   the admin's Auth UID does not exist until this moment.
6. Open `/admin/setup` and confirm every check is green.

While testing, add the number under Authentication → Sign-in method → Phone →
**Phone numbers for testing** with a fixed code. Firebase then skips both
reCAPTCHA and the SMS.

### Why photos are not in Cloud Storage

Storage now requires a billing account on new projects, which a village pilot
should not need. Photos live in Firestore instead, split in two so neither the
free tier nor a 3G connection suffers: a ~25 KB thumbnail inline on the
complaint, which is all the feed loads, and the full image in its own
`media/{kind}` document fetched only when someone opens the complaint. At
roughly 30 KB per feed row against 1 GiB free, that is a few thousand
complaints before anything costs money.

### Deploying

**The app runs on Vercel.** https://village-psi-eight.vercel.app

It is a static export (`output: 'export'`), because every page fetches its own
data from Firestore in the browser — there is nothing for a server to do.
Pushing to `main` is the whole deploy: Vercel builds and releases on its own.

Firebase is still the backend (Firestore + Auth), but **not** the host.
`gaoconnect-3965b.web.app` now 302s to Vercel so older links keep working;
`hosting-redirect/` holds only that redirect page.

Two things Vercel needs, both one-time:

1. **The `NEXT_PUBLIC_FIREBASE_*` variables**, under Settings → Environment
   Variables. `.env.local` is gitignored, so the build has no other source. They
   are read at **build** time — after changing them you must **redeploy**, not
   just restart. Without them the build ships the "Firebase is not configured"
   screen.
2. **The deploy domain in Firebase Auth → Settings → Authorized domains**, or
   phone OTP is refused there.

Anything that must differ per village belongs in the village record, not in
environment variables — a host configured before a variable existed silently
serves stale behaviour, which is how the English ward labels went missing on
Vercel while working locally.

```bash
npm run build          # sanity-check the export locally
git push               # this is the deploy

npx firebase deploy --only firestore:rules   # database rules, when they change
```

## Routes

**Citizen**

| Route | What |
| --- | --- |
| `/` | Hero, "report a problem" CTA, four stat tiles, recent complaints, bottom nav |
| `/report` | 5-step form: category tiles, description (0/200), photo, GPS-or-ward, contact |
| `/complaint/[id]` | Public ref, photo, meta, status timeline, proof, "fixed / still broken" feedback |
| `/complaints` | Full public feed with status filters |
| `/announcements` | Notices, tabbed All / Urgent |
| `/my` | Complaints filed from this phone (no login — matched on the stored number) |
| `/more` | Grouped menu: services, Panchayat login, language, install, share |

**Admin (Sarpanch / Secretary)**

| Route | What |
| --- | --- |
| `/admin/login` | Phone + OTP, with email/password as fallback |
| `/admin/verify` | OTP entry with resend timer |
| `/admin/dashboard` | Period filter, four stats, status donut, most-reported categories |
| `/admin/complaints` | Filterable table (category / status / date) |
| `/admin/complaint/[id]` | Status change, note (0/200), proof photo |
| `/admin/announcements` + `/new` | Notice list and composer (general / urgent, poster) |
| `/admin/profile` | Session, language, sign out |
| `/admin/register` | Apply to administer a village — photo ID and proof of post required |

**Super admin**

| Route | What |
| --- | --- |
| `/super-admin/login` | Mobile/OTP or email tabs |
| `/super-admin/villages` | Every onboarded village, flagged when an admin needs re-checking |
| `/super-admin/villages/new` | Onboard a village + its first admin |
| `/super-admin/village?id=` | One village: LGD code, its admins, re-check, revoke, add directly |
| `/super-admin/requests` | Admin applications with their proof, checklist and decision record |
| `/super-admin/reports` | Residents saying the wrong person is shown as Sarpanch |

## Design decisions worth knowing

- **Hindi is the default, with a live HI/EN toggle** in every header. All copy
  lives in `public/locales/{hi,en}.json` (257 keys, kept in exact parity) and is
  bundled rather than fetched, so switching costs no round trip. The preference
  is remembered per device.
- **No citizen login.** A name and mobile number on the form is the whole
  identity — asking a villager to create an account is the fastest way to lose
  them. `/my` finds their reports from the number kept on the device. Admins do
  sign in, by phone + OTP.
- **Photos are compressed on the phone** (`browser-image-compression`, max
  ~350 KB / 1280 px) *before* upload, so a 6 MB camera shot doesn't stall on 3G.
- **The complaint document is written before the photo uploads.** If the upload
  fails on a bad connection the complaint still exists — the photo is simply
  missing, rather than the whole report being lost.
- **Multi-tenant from day one.** Every read and write goes through
  `villages/{villageId}/…`; Phase 1 just pins `villageId` to one value in
  `lib/config.ts`. Adding village #2 means resolving that value from the URL or
  the signed-in user — no data migration.
- **Public phone numbers are masked** (`98xxxxxx10`) on the citizen-facing
  detail page; admins see the full number as a `tel:` link.

## How an admin is verified

The hard question this app has to answer is not "can this person log in" but
"is this person really the Sarpanch of that village". OTP settles the first one
and says nothing about the second, so everything below exists to narrow the gap.

**Nobody can grant themselves access.** Registering files an application; only a
super admin's approval puts a number on a village. That was true before, but the
super admin used to see four fields the applicant had typed and an Approve
button, which is not a check — it is a formality with a button.

Four layers now sit behind an approval:

1. **Evidence, required.** `/admin/register` will not submit without a photo ID
   and proof of the post — an election certificate, or a letter on panchayat
   letterhead. The rules enforce it too, so a hand-rolled write cannot skip it.
   Thumbnails ride on the request; full images sit in its `media` subcollection,
   readable by a super admin and nobody else.
2. **The government's own record.** A village carries its LGD code, and the
   review screen links straight into a search of the Local Government Directory
   and the state panchayat portals, which publish elected representatives. There
   is no usable public API — the check is a human reading a page — so the app
   makes it one tap instead of ten minutes of hunting.
3. **A written reason, required.** No decision goes through without the reviewer
   recording how they checked (documents / directory / phone call / known
   personally) and what they actually saw. It is stored on both the request and
   the admin record, so "who approved this, and on what basis" always has an
   answer.
4. **The village itself.** The public Sarpanch card shows the date the name was
   last verified and carries a "this is wrong" link. Reports are anonymous and
   land in `/super-admin/reports`. Two thousand people who know each other will
   spot a wrong name faster than any document check; they just need somewhere to
   say so.

**Access is reversible and dated.** Approvals carry a term — five years by
default, because that is a Sarpanch's — and `/super-admin/village?id=…` lists
every administrator with the evidence behind them, a Re-check button and a
Revoke button. Revoking takes the number off `adminPhone`, `adminPhones` and
`adminTermEnds`, then empties `adminUserIds` so every device has to re-prove
itself from a number still on the list; everyone still approved re-links on
their next page load, the revoked one cannot.

**The straightest path skips registration entirely.** A super admin who already
knows who should run a village can add them directly from the village screen.
Nothing is self-declared, so there is nothing to spoof.

### What this does not do

Term expiry is **not** enforced by the Firestore rules. Comparing a clock
against a per-person date needs a server to sweep for it, and this app has none
by design. What happens instead: the admin app refuses to open on an expired
term, and the super admin's list flags it — so the real case, an ex-Sarpanch
with the app still on their phone, is turned away, while a determined attacker
with the raw API is not. Revoking is the enforced action; expiry is the prompt
to reach for it.

Verification notes are also why admin records live at
`villages/{id}/admins/{phone}` rather than on the village document. That
document is world-readable — the transparency is the point — and a reviewer's
notes about somebody's identity papers have no business being public. Only the
phone numbers (already public) and the term dates stay on the village itself.

## Security model

`firestore.rules` is the real enforcement — the admin layout's redirect is only
a UI convenience:

- anyone can **read** complaints (that transparency is the point)
- anyone can **create** one, but only as `status: "pending"`, scoped to the
  village, with a length-capped description
- only UIDs listed in that village's `adminUserIds[]` can **update** status, and
  they cannot rewrite the citizen's category, description, or contact details

## Project layout

```
app/            routes (App Router, all client components)
app/super-admin village onboarding, admin requests, resident objections
components/     ComplaintCard, StatusBadge, CategoryPicker, PhotoUpload, Navbar
lib/            firebase, complaints (data layer), auth, config, imageCompress
lib/tenant      resolves which village this session is looking at
public/         PWA manifest + generated icons and logos
assets/brand    the source logo, never served (see Branding)
scripts/        one-off tooling (bootstrap, logo assets)
```

## Branding

`assets/brand/logo.png` is the single source of truth, and it deliberately sits
outside `public/` — at 1.3 MB it must never be served to a phone. Everything
derived from it — the header mark, the launch badge, the favicon and the PWA icons —
is regenerated by:

```bash
npm run logo
```

That script writes two shapes. The full badge (artwork plus the
"GaonConnect / ग्राम पंचायत" wordmark) goes on launch and login screens and on
the home-screen icon; a square crop of the artwork alone goes anywhere the logo
is small, because at 32-44px the wordmark inside the badge is an unreadable
smudge. Drop a new file in as `assets/brand/logo.png`, rerun the script, and
commit what it produced.

## Multi-village

Every read and write goes through `villages/{villageId}/…`, resolved by
`lib/tenant.ts` in this order:

1. `?v=<id>` in the URL — hand a village a plain link or a QR code for the
   notice board, no login needed
2. the village stored on the device — set for an admin by whichever village
   claims their phone number
3. `NEXT_PUBLIC_VILLAGE_ID`, the pilot default

A village onboarded through the super-admin screen therefore starts empty,
with no access to any other village's complaints.

## Offline behaviour

`public/sw.js` registers in production only. Build assets are cached
cache-first, pages network-first with a cache fallback, and Firebase traffic is
never intercepted — Firestore has its own offline layer, and caching auth or
query responses here would be actively wrong. A dropped connection shows the
last good page rather than the browser's error screen.

## Known gaps

- Firestore rules are not covered by automated tests. The emulator needs Java,
  which is not installed here, so the rules have been reasoned through but not
  executed. Worth running `firebase emulators:exec` once on a machine with a
  JDK before the pilot.
- Announcement posters upload but there is no way to remove one after posting.
- First Load JS is ~267 kB, almost all Firebase SDK. Dynamic-importing it in
  `lib/firebase.ts` is the next win if 3G load time becomes a problem.
