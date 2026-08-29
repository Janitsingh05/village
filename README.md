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

The app is a **static export** (`output: 'export'`), because every page fetches
its own data from Firestore in the browser. It runs on any static host.

Two things every host needs:

1. **The `NEXT_PUBLIC_FIREBASE_*` variables.** `.env.local` is gitignored, so a
   host building from the repo has no idea what they are, and the build bakes
   in the "Firebase is not configured" screen. They are read at **build** time —
   after adding them you must **redeploy**, not just restart.
2. **A rewrite for the complaint pages.** `/complaint/<id>` has no file of its
   own; it is one exported page that reads the id from the URL. `firebase.json`
   covers Firebase Hosting and `vercel.json` covers Vercel. Without it, a shared
   complaint link 404s.

And one Firebase setting: Authentication → Settings → **Authorized domains**
must list the deploy domain (e.g. `your-app.vercel.app`), or phone OTP fails
there. `*.web.app` and `*.firebaseapp.com` are allowed by default, which is why
Firebase Hosting needs no such step.

```bash
# Firebase Hosting — free, no billing account, same project as the database
npm run build && npx firebase deploy --only hosting

# Vercel — import the repo at vercel.com/new, then add the env vars and redeploy
```

`NEXT_PUBLIC_*` values are visible in the browser bundle. That is expected for
Firebase web config; the real protection is `firestore.rules`.

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
| `/more` | Language, links, install hint |

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

**Super admin**

| Route | What |
| --- | --- |
| `/super-admin/login` | Mobile/OTP or email tabs |
| `/super-admin/villages` | Every onboarded village |
| `/super-admin/villages/new` | Onboard a village + its first admin |

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
components/     ComplaintCard, StatusBadge, CategoryPicker, PhotoUpload, Navbar
lib/            firebase, complaints (data layer), auth, config, imageCompress
lib/tenant      resolves which village this session is looking at
public/         PWA manifest + icons
```

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
