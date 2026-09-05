// Cuts a transparent hole for the screen out of public/console.png, so the
// video renders behind the console image instead of on top of it as an
// overlay. Re-run whenever the render changes.
//
//   npx tsx scripts/console-cutout.mts [--inset 7]
//
// The cutout uses the same SCREEN_BOUNDS fractions as components/console.tsx
// (keep the two in sync if the render or the measured bounds change), inset
// by a few pixels at the source resolution so the black gasket stays on the
// PNG and its inner shadow falls over the video's edge (CLAUDE.md brief
// WP4.1 §1).

import sharp from "sharp";

const SRC = "public/console.png";
const OUT = "public/console-cutout.png";

/** Must match SCREEN_BOUNDS in components/console.tsx. */
const SCREEN_BOUNDS = { left: 0.1317, right: 0.6294, top: 0.2155, bottom: 0.7415 };

function argValue(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  if (i === -1 || !process.argv[i + 1]) return fallback;
  const value = Number(process.argv[i + 1]);
  return Number.isFinite(value) ? value : fallback;
}

async function main() {
  const inset = argValue("--inset", 7);

  const image = sharp(SRC);
  const { width, height } = await image.metadata();
  if (!width || !height) throw new Error(`could not read dimensions of ${SRC}`);

  const left = Math.round(SCREEN_BOUNDS.left * width) + inset;
  const top = Math.round(SCREEN_BOUNDS.top * height) + inset;
  const right = Math.round(SCREEN_BOUNDS.right * width) - inset;
  const bottom = Math.round(SCREEN_BOUNDS.bottom * height) - inset;
  const cutoutWidth = right - left;
  const cutoutHeight = bottom - top;
  if (cutoutWidth <= 0 || cutoutHeight <= 0) {
    throw new Error(`inset of ${inset}px leaves no cutout (${cutoutWidth}x${cutoutHeight})`);
  }

  // A solid rect composited with blend "dest-out" punches a hole in the
  // source's alpha channel wherever the rect is opaque; its own colour is
  // irrelevant.
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}"><rect x="${left}" y="${top}" width="${cutoutWidth}" height="${cutoutHeight}" fill="#fff"/></svg>`
  );

  await sharp(SRC)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-out" }])
    .png()
    .toFile(OUT);

  console.log(
    `${OUT}: ${width}x${height}, cutout ${cutoutWidth}x${cutoutHeight} at (${left},${top}), inset ${inset}px`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
