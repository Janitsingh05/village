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
/**
 * Small, because this one rides on the complaint document and the feed loads
 * forty of them at once. At 28 KB that was a megabyte of thumbnails per screen
 * on a 3G phone; at 9 KB it is a third of that, and a 160px tile is all the
 * feed ever draws.
 */
const THUMB_MAX_BYTES = 9 * 1024;

/** Base64 is ~4/3 the size of the bytes; keep a wide margin under 1 MiB. */
export const MAX_STORED_CHARS = 900_000;

/**
 * The cap the Firestore rules put on the inline thumbnail.
 *
 * maxSizeMB is a target the compressor aims at, not a guarantee, so a
 * pathological image can come back over it. The thumbnail rides on the
 * complaint's first write — a citizen can create but never update — so an
 * oversized one is not a missing picture, it is a denied write and a lost
 * complaint. Checked here so the caller can drop the thumbnail instead.
 */
export const MAX_THUMB_CHARS = 60_000;

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
  /** Small enough to sit on the complaint document, or null when it was not. */
  thumb: string | null;
  /** Full-size, stored in its own document and fetched on demand. */
  full: string;
  originalBytes: number;
  fullBytes: number;
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith('image/')) {
    throw new Error('NOT_AN_IMAGE');
  }

  // HEIC is what an iPhone hands over, and Chrome on Android cannot decode it.
  // Caught by name rather than by letting the compressor fail, so the message
  // can say which photo to pick instead of "something went wrong".
  if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
    throw new Error('UNSUPPORTED_FORMAT');
  }

  const [fullBlob, thumbBlob] = await Promise.all([
    shrink(file, FULL_MAX_BYTES / (1024 * 1024), 1280, 0.7),
    shrink(file, THUMB_MAX_BYTES / (1024 * 1024), 200, 0.55),
  ]);

  const [full, firstThumb] = await Promise.all([toDataUrl(fullBlob), toDataUrl(thumbBlob)]);

  // Try harder before giving up. maxSizeMB is a target the compressor aims at,
  // not a promise, and it misses most often on exactly the images that matter
  // here — a photographed Aadhaar card or a letterhead, dense with small text,
  // which JPEG cannot compress the way it compresses a photo of a drain.
  let thumb = firstThumb;
  if (thumb.length >= MAX_THUMB_CHARS) {
    try {
      thumb = await toDataUrl(await shrink(file, THUMB_MAX_BYTES / (1024 * 1024), 140, 0.4));
    } catch {
      /* keep the first attempt and let the caller decide */
    }
  }

  if (full.length > MAX_STORED_CHARS) {
    // Only reachable with a pathological image; better than a write that
    // fails against the document limit after the user has waited.
    throw new Error('PHOTO_TOO_LARGE');
  }

  return {
    // Dropped rather than shipped oversized. The feed loses one tile; the full
    // image still lands in its own document and the detail view is unaffected.
    thumb: thumb.length < MAX_THUMB_CHARS ? thumb : null,
    full,
    originalBytes: file.size,
    fullBytes: fullBlob.size,
  };
}

export function readableSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
