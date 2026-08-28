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
  photoUrl: string | null;
  location: {
    ward: string;
    lat?: number;
    lng?: number;
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
  photoFile: File | null;
  ward: string;
  lat?: number;
  lng?: number;
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
  state: string;
  district: string;
  address: string;
  adminName: string;
  adminPhone: string;
  adminUserIds: string[];
  createdAt: number;
}
