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

### Demo mode (no backend needed)

With the Firebase keys in `.env.local` left blank, the app stores complaints in
the browser's **localStorage** and seeds three sample complaints. The full
citizen → admin loop works offline — good for showing a Sarpanch on a laptop.

Admin sign-in in demo mode: `admin@gaon.local` / `gaon1234`

> Demo data lives in one browser only. Nothing syncs between devices until
> Firebase is wired up.

### Going live with Firebase

1. Create a Firebase project → add a **Web app** → copy the config into `.env.local`.
2. Enable **Firestore**, **Storage**, and **Authentication → Email/Password**.
3. Create the Sarpanch's admin user under Authentication → Users.
4. Create the village document in Firestore:

   ```
   villages/pilot-village
     name: "ग्राम पंचायत रामपुर"
     state, district: "..."
     adminUserIds: ["<the admin's Auth UID>"]
     createdAt: <timestamp>
   ```

   `pilot-village` must match `NEXT_PUBLIC_VILLAGE_ID`.
5. Deploy the rules:

   ```bash
   firebase deploy --only firestore:rules,storage
   ```

Restart `npm run dev` — the app switches off demo mode automatically the moment
real keys are present.

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
lib/demoStore   localStorage stand-in used when Firebase keys are absent
public/         PWA manifest + icons
```

## Known gaps

- `VILLAGE_ID` is still a constant in `lib/config.ts`. Every read and write is
  already scoped to `villages/{villageId}`, so going multi-village means
  resolving that value from the URL or the signed-in admin — no data migration.
- Onboarding a village writes the record with an empty `adminUserIds[]`. That
  admin's Auth UID has to be attached on first sign-in before Firestore rules
  will let them update complaints.
- First Load JS is ~265 kB, almost all Firebase SDK. Dynamic-importing it in
  `lib/firebase.ts` is the next win if 3G load time becomes a problem.
