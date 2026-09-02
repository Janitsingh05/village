export type ComplaintStatus = 'pending' | 'in_progress' | 'resolved' | 'closed';

export type CategoryId =
  | 'drain'
  | 'road'
  | 'streetlight'
  | 'water'
  | 'electricity'
  | 'garbage'
  | 'public_property'
  | 'other';

export interface Category {
  id: CategoryId;
  emoji: string;
}

export interface StatusEvent {
  status: ComplaintStatus;
  at: number; // epoch ms
  note?: string;
}

export interface Complaint {
  id: string;
  /** Human-readable reference shown to citizens, e.g. GC-260828-0012. */
  ref: string;
  villageId: string;
  category: CategoryId;
  description: string;
  /** Thumbnail of the first photo — the only image the feed loads. */
  photoUrl: string | null;
  /** How many full images exist at media/photo-0 … media/photo-(n-1). */
  photoCount: number;
  /**
   * A spoken complaint, stored at media/voice.
   *
   * Only the length and the container live on the complaint, so a feed row
   * knows there is something to play without dragging the audio down with it.
   * The recording is the record here — the description beside it may be a
   * machine transcript nobody could proofread, so the Sarpanch listens.
   */
  voiceNote: { seconds: number; mimeType: string } | null;
  location: {
    ward: string;
    lat?: number;
    lng?: number;
    /** Readable place resolved from the coordinates, e.g. "रामपुरा, सीकर". */
    address?: string;
  };
  status: ComplaintStatus;
  reportedBy: {
    name: string;
    phone: string;
  };
  resolutionPhotoUrl: string | null;
  resolutionNote: string | null;
  /** Citizen's verdict once the Panchayat marks it resolved. */
  feedback: { verdict: 'still_open' | 'confirmed'; at: number } | null;
  timeline: StatusEvent[];
  createdAt: number;
  updatedAt: number;
}

/** Shape accepted by createComplaint — server fills the rest. */
export interface NewComplaintInput {
  category: CategoryId;
  description: string;
  photoFiles: File[];
  /** A recorded complaint, from the spoken flow. */
  voice?: { dataUrl: string; mimeType: string; seconds: number } | null;
  ward: string;
  lat?: number;
  lng?: number;
  address?: string;
  reporterName: string;
  reporterPhone: string;
}

export type AnnouncementKind = 'general' | 'urgent';

export interface Announcement {
  id: string;
  villageId: string;
  kind: AnnouncementKind;
  title: string;
  body: string;
  photoUrl: string | null;
  postedBy: string;
  createdAt: number;
}

/**
 * How a super admin satisfied themselves that someone really holds the post
 * they claim. Recorded because "who approved this, and on what basis" is the
 * only question worth asking after the fact.
 */
export type VerificationMethod = 'document' | 'directory' | 'phone' | 'offline';

/**
 * One approved administrator of a village, and the evidence behind them.
 *
 * `adminPhones` and `adminUserIds` stay the arrays the Firestore rules read —
 * this runs alongside them and carries everything the rules do not care about
 * but a human reviewing an account later very much does.
 *
 * There is deliberately no Auth UID here. A signed-in admin may only ever
 * append their own UID to `adminUserIds` and touch nothing else, so the client
 * could not fill one in; revoking works by emptying that array instead and
 * making every device re-prove itself from a phone number still on the list.
 *
 * These live at `villages/{id}/admins/{phone}`, readable by a super admin only.
 * The village document itself is world-readable — that transparency is the
 * point of the app — and a reviewer's note about someone's identity documents
 * has no business being public. What the village doc carries instead is
 * `adminTermEnds`: dates keyed by a phone number that was already public, which
 * is enough for the app to enforce an expiry without publishing anything.
 */
export interface VillageAdmin {
  /** Ten digits. The identity, since it is what the OTP proves. */
  phone: string;
  name: string;
  /** सरपंच / सचिव / वार्ड सदस्य … */
  role: string;
  verifiedVia: VerificationMethod;
  /** What the super admin actually checked, in their own words. */
  verifiedNote: string;
  verifiedAt: number;
  /** The super admin's UID — the audit trail's other half. */
  verifiedBy: string;
  /**
   * A Sarpanch serves a fixed term, so access should not outlive it. Null means
   * no end date was set, which the review screen treats as needing one.
   */
  termEndsAt: number | null;
}

export interface Village {
  id: string;
  name: string;
  /** Optional English name; without it the primary name shows in both languages. */
  nameEn: string;
  state: string;
  district: string;
  address: string;
  /**
   * The panchayat's code in the government's Local Government Directory. Not
   * used for anything automatic — it is what a super admin follows to check a
   * claimed Sarpanch against the state's own record before approving them.
   */
  lgdCode: string;
  adminName: string;
  /** What the villagers should call them, e.g. सरपंच / सचिव. */
  adminRole: string;
  /** Small inline portrait, shown to residents so they know who to approach. */
  adminPhotoUrl: string | null;
  adminPhone: string;
  /** Extra admins approved after onboarding, by phone number. */
  adminPhones: string[];
  adminUserIds: string[];
  /**
   * When each admin's term runs out, keyed by their ten-digit number. Public,
   * because a date against an already-public number reveals nothing, and both
   * the admin app and the review list need it without a privileged read.
   */
  adminTermEnds: Record<string, number>;
  /** When the primary admin was last checked — the date on the public card. */
  adminVerifiedAt: number | null;
  /** Coordinates confirmed against a map when the village was onboarded. */
  location: { lat: number; lng: number } | null;
  /** What the map service called this place — evidence of what was matched. */
  mapPlace: string;
  createdAt: number;
}

export type AdminRequestStatus = 'pending' | 'approved' | 'rejected';

/**
 * Someone asking to administer a village.
 *
 * Registration cannot grant admin rights directly — anyone could then sign up
 * and start closing complaints. It records a request that a super admin has to
 * approve, and only that approval puts the number on the village.
 */
export interface AdminRequest {
  id: string;
  villageId: string;
  villageName: string;
  name: string;
  phone: string;
  role: string;
  /**
   * Thumbnails of the two documents the requester uploaded: a government photo
   * ID, and something showing they hold the post (an election certificate, or a
   * letter on panchayat letterhead). Full images live in the request's own
   * media subcollection, and neither is readable by anyone but a super admin.
   */
  idProofUrl: string | null;
  postProofUrl: string | null;
  status: AdminRequestStatus;
  createdAt: number;
  decidedAt: number | null;
  /** Who decided, how they checked, and what they wrote down. */
  decidedBy: string;
  verifiedVia: VerificationMethod | null;
  verifiedNote: string;
  termEndsAt: number | null;
}

/**
 * A resident saying the person shown as their Sarpanch is not their Sarpanch.
 *
 * The cheapest verification channel this app has: a village of two thousand
 * people who all know each other will spot a wrong name faster than any
 * document check, provided there is somewhere to say so.
 */
export interface AdminReport {
  id: string;
  villageId: string;
  villageName: string;
  /** The name being disputed, captured so a later rename cannot hide it. */
  aboutName: string;
  reason: string;
  status: 'open' | 'reviewed';
  createdAt: number;
}
