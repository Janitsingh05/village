import type { Complaint, ComplaintStatus, NewComplaintInput } from './types';
import { VILLAGE_ID, complaintRef } from './config';

/**
 * Browser-local stand-in for Firestore + Storage, used when .env.local has no
 * Firebase keys. Lets you run and demo the full citizen -> admin loop offline.
 * Data lives in localStorage and never leaves the device.
 */
const KEY = 'gaonconnect:complaints';
const SEEDED = 'gaonconnect:seeded';

function read(): Complaint[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Complaint[]) : [];
  } catch {
    return [];
  }
}

function write(rows: Complaint[]) {
  window.localStorage.setItem(KEY, JSON.stringify(rows));
}

/**
 * localStorage caps out around 5 MB and photos are stored as data URLs, so a
 * write can fail once a few complaints carry images. Rather than silently
 * dropping the complaint, we retry without its photo and only then give up.
 */
function writeOrDropPhotos(rows: Complaint[]) {
  try {
    write(rows);
    return;
  } catch {
    /* fall through to the stripped retry */
  }
  try {
    write(rows.map((r, i) => (i === 0 ? r : { ...r, photoUrl: null, resolutionPhotoUrl: null })));
  } catch {
    throw new Error('इस ब्राउज़र की मेमोरी भर गई है — डेमो डेटा साफ़ करें।');
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function seedIfEmpty() {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(SEEDED)) return;
  window.localStorage.setItem(SEEDED, '1');
  if (read().length) return;

  const now = Date.now();
  const day = 86_400_000;
  const seed: Complaint[] = [
    {
      id: 'demo-1',
      ref: complaintRef('demo-1', now - 3 * day),
      villageId: VILLAGE_ID,
      category: 'drain',
      description: 'मंदिर के पास वाला नाला पूरी तरह जाम है, गंदा पानी सड़क पर बह रहा है।',
      photoUrl: null,
      location: { ward: 'मंदिर के पास' },
      status: 'in_progress',
      reportedBy: { name: 'रमेश यादव', phone: '9876543210' },
      resolutionPhotoUrl: null,
      resolutionNote: null,
      feedback: null,
      timeline: [
        { status: 'pending', at: now - 3 * day },
        { status: 'in_progress', at: now - day, note: 'सफ़ाई कर्मचारी भेजे गए हैं।' },
      ],
      createdAt: now - 3 * day,
      updatedAt: now - day,
    },
    {
      id: 'demo-2',
      ref: complaintRef('demo-2', now - 6 * 3600_000),
      villageId: VILLAGE_ID,
      category: 'streetlight',
      description: 'वार्ड 2 की गली में तीन स्ट्रीट लाइट एक हफ़्ते से बंद हैं।',
      photoUrl: null,
      location: { ward: 'वार्ड 2' },
      status: 'pending',
      reportedBy: { name: 'सुनीता देवी', phone: '9812345670' },
      resolutionPhotoUrl: null,
      resolutionNote: null,
      feedback: null,
      timeline: [{ status: 'pending', at: now - 6 * 3600_000 }],
      createdAt: now - 6 * 3600_000,
      updatedAt: now - 6 * 3600_000,
    },
    {
      id: 'demo-3',
      ref: complaintRef('demo-3', now - 9 * day),
      villageId: VILLAGE_ID,
      category: 'water',
      description: 'हैंडपंप का पानी गंदा आ रहा है, पीने लायक नहीं है।',
      photoUrl: null,
      location: { ward: 'वार्ड 4' },
      status: 'resolved',
      reportedBy: { name: 'मोहन लाल', phone: '9900112233' },
      resolutionPhotoUrl: null,
      resolutionNote: 'हैंडपंप की सफ़ाई और मरम्मत करा दी गई है।',
      feedback: null,
      timeline: [
        { status: 'pending', at: now - 9 * day },
        { status: 'in_progress', at: now - 7 * day },
        { status: 'resolved', at: now - 5 * day, note: 'हैंडपंप की सफ़ाई और मरम्मत करा दी गई है।' },
      ],
      createdAt: now - 9 * day,
      updatedAt: now - 5 * day,
    },
  ];
  write(seed);
}

export const demoStore = {
  async list(): Promise<Complaint[]> {
    seedIfEmpty();
    return read().sort((a, b) => b.createdAt - a.createdAt);
  },

  async get(id: string): Promise<Complaint | null> {
    seedIfEmpty();
    return read().find((c) => c.id === id) || null;
  },

  async create(input: NewComplaintInput): Promise<string> {
    seedIfEmpty();
    const now = Date.now();
    const id = 'c' + now.toString(36) + Math.random().toString(36).slice(2, 6);
    const complaint: Complaint = {
      id,
      ref: complaintRef(id, now),
      villageId: VILLAGE_ID,
      category: input.category,
      description: input.description,
      photoUrl: input.photoFile ? await fileToDataUrl(input.photoFile) : null,
      location: { ward: input.ward, lat: input.lat, lng: input.lng },
      status: 'pending',
      reportedBy: { name: input.reporterName, phone: input.reporterPhone },
      resolutionPhotoUrl: null,
      resolutionNote: null,
      feedback: null,
      timeline: [{ status: 'pending', at: now }],
      createdAt: now,
      updatedAt: now,
    };
    writeOrDropPhotos([complaint, ...read()]);
    return id;
  },

  async updateStatus(
    id: string,
    status: ComplaintStatus,
    note: string,
    proofFile: File | null
  ): Promise<void> {
    const rows = read();
    const i = rows.findIndex((c) => c.id === id);
    if (i === -1) return;
    const now = Date.now();
    const proofUrl = proofFile ? await fileToDataUrl(proofFile) : rows[i].resolutionPhotoUrl;
    rows[i] = {
      ...rows[i],
      status,
      resolutionNote: note || rows[i].resolutionNote,
      resolutionPhotoUrl: proofUrl,
      timeline: [...rows[i].timeline, { status, at: now, note: note || undefined }],
      updatedAt: now,
    };
    writeOrDropPhotos(rows);
  },

  async setFeedback(id: string, verdict: 'still_open' | 'confirmed'): Promise<void> {
    const rows = read();
    const i = rows.findIndex((c) => c.id === id);
    if (i === -1) return;
    rows[i] = { ...rows[i], feedback: { verdict, at: Date.now() }, updatedAt: Date.now() };
    writeOrDropPhotos(rows);
  },
};
