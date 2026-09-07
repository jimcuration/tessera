// Shared ffmpeg/ffprobe helpers for the recording scripts. The binary comes
// from the ffmpeg-static dev dependency; nothing needs to be on PATH.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

export const FFMPEG = require("ffmpeg-static");
if (!FFMPEG) throw new Error("ffmpeg-static did not provide a binary for this platform");
export const FFMPEG_DIR = path.dirname(FFMPEG);

export function ffmpeg(args, opts = {}) {
  const result = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed (${result.status}): ${result.stderr || result.stdout}`);
  }
  return result;
}

/** Duration in seconds, read from ffmpeg's own stderr (no ffprobe in ffmpeg-static). */
export function durationOf(file) {
  const result = spawnSync(FFMPEG, ["-hide_banner", "-i", file], { encoding: "utf8" });
  const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(result.stderr || "");
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

/** Whether the file has an audio stream. */
export function hasAudio(file) {
  const result = spawnSync(FFMPEG, ["-hide_banner", "-i", file], { encoding: "utf8" });
  return /Stream #\d+:\d+.*Audio/.test(result.stderr || "");
}

/**
 * Pixel width/height of the video stream, read from ffmpeg's own stderr
 * banner (no ffprobe in ffmpeg-static). WP8.2: fal's response carries no
 * field for the actual rendered dimensions or aspect ratio (confirmed
 * against the published API schema and scripts/probe-duration.mts), so the
 * only way to know what was actually returned is to measure the downloaded
 * file directly.
 */
export function dimensionsOf(file) {
  const result = spawnSync(FFMPEG, ["-hide_banner", "-i", file], { encoding: "utf8" });
  const match = /Video:.*?(\d{2,5})x(\d{2,5})/.exec(result.stderr || "");
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

/**
 * WP8.2: seconds (within the file) at which the cropped upper-third region
 * — where the style sheet's headline chip lives (v0.3 line 6) — changes
 * substantially, via ffmpeg's own scene-change detector run against just
 * that crop. This is a visual-change signal, not OCR: it marks when new
 * pixels start landing in the chip's region, not what the chip says or
 * whether it is fully legible. Used as "the frame at which the beat's
 * headline first appears" (WP8.2 brief, Render and compare).
 */
export function headlineChangeTimes(file, { threshold = 0.03 } = {}) {
  const filter = `crop=iw:ih/3:0:0,select='gt(scene\\,${threshold})',showinfo`;
  const result = spawnSync(FFMPEG, ["-hide_banner", "-i", file, "-vf", filter, "-f", "null", "-"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const text = result.stderr || "";
  return [...text.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
}

/**
 * Midpoints (seconds) of silent gaps in an audio file, via ffmpeg's
 * silencedetect filter (WP8: the fallback beat-split when ElevenLabs
 * timestamps are unavailable). Must not go through the `ffmpeg()` wrapper
 * above: silencedetect logs at "info" verbosity and that wrapper sets
 * `-loglevel error`, which would swallow the very lines this reads.
 */
export function silenceGapMidpoints(file, { noiseDb = -30, minSeconds = 0.15 } = {}) {
  const result = spawnSync(
    FFMPEG,
    ["-hide_banner", "-i", file, "-af", `silencedetect=noise=${noiseDb}dB:d=${minSeconds}`, "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  const text = result.stderr || "";
  const starts = [...text.matchAll(/silence_start:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...text.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  const mids = [];
  for (let i = 0; i < Math.min(starts.length, ends.length); i += 1) {
    mids.push((starts[i] + ends[i]) / 2);
  }
  return mids;
}
