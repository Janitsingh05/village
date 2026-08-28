import imageCompression from 'browser-image-compression';

/**
 * Photos live in Firestore, not Cloud Storage — Storage now requires a billing
 * account, and a village pilot should not need one. That puts two hard limits
 * on us:
 *
 *   - a Firestore document caps at 1 MiB, and base64 inflates bytes by ~33%,
 *     so the full image must stay well under that
 *   - the public feed must not drag full images down a 3G connection, so it
 *     renders a separate small thumbnail stored inline on the complaint
 *
 * Hence two outputs per photo: a thumbnail that ships with the list, and a
 * full version fetched only when someone opens the complaint.
 */
const FULL_MAX_BYTES = 300 * 1024;
const THUMB_MAX_BYTES = 28 * 1024;

/** Base64 is ~4/3 the size of the bytes; keep a wide margin under 1 MiB. */
export const MAX_STORED_CHARS = 900_000;

async function shrink(file: File, maxSizeMB: number, maxWidthOrHeight: number, quality: number) {
  return imageCompression(file, {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker: true,
    initialQuality: quality,
    fileType: 'image/jpeg',
  });
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export interface PreparedPhoto {
  /** Small enough to sit on the complaint document and load with the feed. */
  thumb: string;
  /** Full-size, stored in its own document and fetched on demand. */
  full: string;
  originalBytes: number;
  fullBytes: number;
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith('image/')) {
    throw new Error('NOT_AN_IMAGE');
  }

  const [fullBlob, thumbBlob] = await Promise.all([
    shrink(file, FULL_MAX_BYTES / (1024 * 1024), 1280, 0.7),
    shrink(file, THUMB_MAX_BYTES / (1024 * 1024), 360, 0.6),
  ]);

  const [full, thumb] = await Promise.all([toDataUrl(fullBlob), toDataUrl(thumbBlob)]);

  if (full.length > MAX_STORED_CHARS) {
    // Only reachable with a pathological image; better than a write that
    // fails against the document limit after the user has waited.
    throw new Error('PHOTO_TOO_LARGE');
  }

  return { thumb, full, originalBytes: file.size, fullBytes: fullBlob.size };
}

export function readableSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
