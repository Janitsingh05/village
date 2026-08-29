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

export interface Village {
  id: string;
  name: string;
  /** Optional English name; without it the primary name shows in both languages. */
  nameEn: string;
  state: string;
  district: string;
  address: string;
  adminName: string;
  /** What the villagers should call them, e.g. सरपंच / सचिव. */
  adminRole: string;
  /** Small inline portrait, shown to residents so they know who to approach. */
  adminPhotoUrl: string | null;
  adminPhone: string;
  /** Extra admins approved after onboarding, by phone number. */
  adminPhones: string[];
  adminUserIds: string[];
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
  status: AdminRequestStatus;
  createdAt: number;
  decidedAt: number | null;
}
