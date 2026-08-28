import imageCompression from 'browser-image-compression';

const TARGET_BYTES = 350 * 1024;

/**
 * Squeeze a phone camera photo (often 3-8 MB) down to something that will
 * actually upload over a patchy 3G connection. Keeps EXIF orientation.
 */
export async function compressPhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  // PhotoUpload compresses the moment a photo is picked, and the upload path
  // calls this again. Skipping already-small JPEGs avoids a second lossy
  // re-encode (and a second slow pass on a low-end phone).
  if (file.type === 'image/jpeg' && file.size <= TARGET_BYTES) return file;

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: TARGET_BYTES / (1024 * 1024),
      maxWidthOrHeight: 1280,
      useWebWorker: true,
      initialQuality: 0.7,
      fileType: 'image/jpeg',
    });

    // Never hand back something larger than what we were given.
    return compressed.size < file.size
      ? new File([compressed], renameToJpg(file.name), { type: 'image/jpeg' })
      : file;
  } catch {
    // Compression is a nice-to-have; a failure must not block the report.
    return file;
  }
}

function renameToJpg(name: string): string {
  return name.replace(/\.[^.]+$/, '') + '.jpg';
}

export function readableSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
