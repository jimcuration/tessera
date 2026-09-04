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
