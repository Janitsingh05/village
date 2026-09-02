/**
 * Regenerates every derived logo asset from `assets/brand/logo.png`, the one
 * file a designer ever hands over. Run `npm run logo` after replacing it.
 *
 * The source lives outside `public/` on purpose: it is 1.3 MB and must never be
 * served to a phone. Only what this script writes is.
 *
 * Two shapes come out of it:
 *   - the full badge (artwork + "GaonConnect / ग्राम पंचायत" wordmark), which is
 *     what belongs on a launch or login screen and on the home-screen icon;
 *   - a square crop of just the scene, because at header size (36–44px) the
 *     wordmark inside the badge is an unreadable smudge and the house, pin and
 *     wifi arcs are not.
 *
 * Everything is written small on purpose: this app is used on rural 3G, and a
 * 1.3 MB PNG in the header would cost more than the page around it.
 *
 * sharp is not a declared dependency: it ships with Next. If a future Next drops
 * it, `npm i -D sharp` and this keeps working.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(root, 'assets', 'brand', 'logo.png');

/** The scene above the wordmark, measured once against the 1254px source. */
const SCENE = { left: 272, top: 95, width: 706, height: 706 };

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

const png = (p) => p.png({ compressionLevel: 9, palette: true, quality: 90 });

/** The badge with its transparent margin removed, so sizes are predictable. */
async function badge() {
  return sharp(SOURCE).trim({ threshold: 1 }).toBuffer();
}

async function square(input, size, background) {
  return png(
    sharp(input).resize(size, size, { fit: 'contain', background })
  ).toBuffer();
}

/** A maskable icon must survive a circular crop, so the art sits at 78%. */
async function maskable(input, size) {
  const inner = Math.round(size * 0.78);
  const art = await sharp(input).resize(inner, inner, { fit: 'contain', background: CLEAR }).toBuffer();
  return png(
    sharp({
      create: { width: size, height: size, channels: 4, background: WHITE },
    }).composite([{ input: art, gravity: 'center' }])
  ).toBuffer();
}

async function write(rel, buf) {
  const out = path.join(root, rel);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, buf);
  console.log(rel.padEnd(34), (buf.length / 1024).toFixed(1).padStart(7) + ' KB');
}

const full = await badge();
const scene = await sharp(SOURCE).extract(SCENE).toBuffer();

await write('public/logo.png', await square(full, 384, CLEAR));
await write('public/logo-mark.png', await square(scene, 192, CLEAR));
await write('public/icons/icon-192.png', await square(full, 192, CLEAR));
await write('public/icons/icon-512.png', await square(full, 512, CLEAR));
await write('public/icons/icon-maskable-512.png', await maskable(full, 512));
await write('public/icons/apple-touch-icon.png', await square(full, 180, WHITE));
await write('public/icons/favicon-32.png', await square(scene, 32, CLEAR));
