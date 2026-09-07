// WP8.2: per-beat lag between when a line's own narration actually starts
// sounding and when its own headline first appears on screen, for the
// Render-and-compare section of briefs/WP8.2-report.md.
//
//   node scripts/lag-report.mjs recordings/<session>
//
// Two things have to be reconstructed across the WHOLE session's timeline
// (not per-shot), because the player's own narrator queues lines strictly
// in order (lib/voice.ts#Narrator.play — a line does not start until the
// previous one has finished, even once its own clip is on screen):
//
//   - audio start: exactly scripts/reel.mjs's own placement logic
//     (`Math.max(clipStart + offsetSeconds, narrationEnd)`) — the later of
//     "the video has reached this beat's own section" or "the previous
//     beat's narration has actually finished playing". This is the real,
//     audible start of the line, which can run later than the beat's own
//     offsetSeconds whenever the previous line overran its section (WP8.1's
//     fixed-boundary problem this whole WP exists to fix).
//   - headline first-appearance: a visual-change signal, not OCR. For each
//     shot's mp4, ffmpeg's own scene-change detector runs against just the
//     cropped upper third of the frame (where the style sheet's headline
//     chip lives, v0.3 line 6) via scripts/ffmpeg.mjs#headlineChangeTimes.
//     The first change inside a beat's own on-screen section (with a small
//     tolerance before its start, since the model's own "enters fast" can
//     begin a touch early) is taken as that beat's headline's
//     first-appearance time, converted to the same session-wide timeline.
//
// lag = headline first-appearance − audio start. Positive: the picture
// changes after the voice already started (a small lead is expected and
// wanted — the brief's whole point). Negative: the picture changed before
// the voice for that line began, i.e. the front-loading problem.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { durationOf, headlineChangeTimes } from "./ffmpeg.mjs";

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** Mirrors scripts/report.mjs's own shotBeats: `beats` (plural, WP8.1+) with a fallback for a pre-WP8.1 singular `beat`. */
function shotBeats(clip) {
  if (Array.isArray(clip.beats)) return clip.beats;
  if (clip.beat) return [{ n: clip.n, beat: clip.beat, offsetSeconds: 0, sectionEndSeconds: null }];
  return [];
}

const dir = process.argv[2];
if (!dir || !existsSync(dir)) {
  console.error("usage: node scripts/lag-report.mjs recordings/<session>");
  process.exit(1);
}

const clips = readdirSync(dir)
  .filter((f) => /^\d+\.json$/.test(f))
  .map((f) => readJson(path.join(dir, f)))
  .filter(Boolean)
  .sort((a, b) => a.n - b.n);

/** The model's own motion has a moment of overshoot before landing (style sheet line 9); allow a change to count slightly before the exact narration boundary. */
const TOLERANCE_BEFORE = 0.3;

let clipStart = 0;
let narrationEnd = 0;
const rows = [];
for (const clip of clips) {
  const mp4 = path.join(dir, `${clip.n}.mp4`);
  if (!existsSync(mp4)) {
    console.warn(`[lag-report] no ${clip.n}.mp4, skipping shot ${clip.n}`);
    continue;
  }
  const clipLength = durationOf(mp4) ?? 5;
  const changes = headlineChangeTimes(mp4);
  const beats = shotBeats(clip);
  for (let i = 0; i < beats.length; i += 1) {
    const { n, beat, offsetSeconds } = beats[i];
    const windowEnd = typeof beats[i].sectionEndSeconds === "number" ? beats[i].sectionEndSeconds : (beats[i + 1]?.offsetSeconds ?? Infinity);
    const localAppearance = changes.find((t) => t >= offsetSeconds - TOLERANCE_BEFORE && t < windowEnd);
    const globalAppearance = localAppearance !== undefined ? clipStart + localAppearance : null;

    // Exactly scripts/reel.mjs's own placement: the line does not start
    // sounding until the video has reached its own section AND the
    // previous line has finished.
    const mp3 = path.join(dir, `${n}.mp3`);
    const audioLength = existsSync(mp3) ? durationOf(mp3) ?? 0 : null;
    const audioStart = audioLength !== null ? Math.max(clipStart + offsetSeconds, narrationEnd) : null;
    if (audioLength !== null) narrationEnd = audioStart + audioLength;

    const lag = globalAppearance !== null && audioStart !== null ? Number((globalAppearance - audioStart).toFixed(2)) : null;
    rows.push({ shot: clip.n, n, headline: beat?.headline ?? null, audioStart, globalAppearance, lag });
  }
  clipStart += clipLength;
}

console.log(`\n## ${path.basename(dir)}\n`);
console.log(`| beat | headline | audio start (s) | headline first-appearance (s) | lag (s) |`);
console.log(`|---|---|---|---|---|`);
for (const r of rows) {
  console.log(
    `| ${r.n} | ${r.headline ?? "—"} | ${r.audioStart !== null ? r.audioStart.toFixed(2) : "—"} | ${r.globalAppearance !== null ? r.globalAppearance.toFixed(2) : "not detected"} | ${r.lag !== null ? r.lag.toFixed(2) : "—"} |`
  );
}

const measured = rows.filter((r) => r.lag !== null);
const lags = measured.map((r) => r.lag);
const mean = lags.length ? lags.reduce((a, b) => a + b, 0) / lags.length : null;
const maxAbs = lags.length ? Math.max(...lags.map((l) => Math.abs(l))) : null;
console.log(
  `\nmean lag: ${mean !== null ? mean.toFixed(2) : "—"}s (n=${measured.length}/${rows.length} beats; ${rows.length - measured.length} not detected); max |lag|: ${maxAbs !== null ? maxAbs.toFixed(2) : "—"}s`
);
