// Cut a recorded session into one demo reel.
//
//   node scripts/reel.mjs recordings/<session> --out recordings/reels/<name>.mp4 [--narration] [--only 1,2,3] [--music file.mp3]
//
// Clips are concatenated without re-encoding the video. With --narration
// (Saskia sessions) the per-beat ElevenLabs tracks (n.mp3) are laid over
// the clips' own paper-slap audio the way the player does: line N starts
// when clip N starts, or when line N-1 finishes if that runs late.
// --music (requires --narration) loops the given track under the mix at
// the same low level components/player.tsx uses for MUSIC=on (WP5 §3).

import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { durationOf, ffmpeg, hasAudio } from "./ffmpeg.mjs";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
if (!dir || !existsSync(dir)) {
  console.error("usage: node scripts/reel.mjs recordings/<session> --out file.mp4 [--narration] [--only 1,2,3]");
  process.exit(1);
}
const out = opt("out", path.join("recordings", "reels", `${path.basename(dir)}.mp4`));
const narration = args.includes("--narration");
const only = opt("only", null)?.split(",").map((s) => parseInt(s.trim())) ?? null;
const musicFile = opt("music", null);
/** Matches components/player.tsx's MUSIC_VOLUME (WP5 §3: roughly -12dB under Saskia's 0.5). */
const MUSIC_VOLUME = 0.13;
if (musicFile && !narration) {
  console.error("--music requires --narration");
  process.exit(1);
}
if (musicFile && !existsSync(musicFile)) {
  console.error("music file not found:", musicFile);
  process.exit(1);
}

let clips = readdirSync(dir)
  .filter((f) => /^\d+\.mp4$/.test(f))
  .map((f) => ({ n: parseInt(f), file: path.join(dir, f) }))
  .sort((a, b) => a.n - b.n);
if (only) clips = clips.filter((c) => only.includes(c.n));
if (clips.length === 0) {
  console.error("no clips to cut");
  process.exit(1);
}

const work = path.join(tmpdir(), `tessera-reel-${Date.now()}`);
mkdirSync(work, { recursive: true });
mkdirSync(path.dirname(out), { recursive: true });

// 1. Concatenate the clips (stream copy: identical codec params from the model).
const list = path.join(work, "list.txt");
writeFileSync(list, clips.map((c) => `file '${path.resolve(c.file).replace(/'/g, "'\\''")}'`).join("\n"));
const joined = path.join(work, "joined.mp4");
ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);

if (!narration) {
  ffmpeg(["-i", joined, "-c", "copy", out]);
  rmSync(work, { recursive: true, force: true });
  console.log(`${clips.length} clip(s) → ${out}`);
  process.exit(0);
}

// 2. Lay the narration over it. Compute each line's start the way the
//    player does: clip start, or the previous line's end if later.
let clipStart = 0;
let narrationEnd = 0;
const tracks = [];
for (const clip of clips) {
  const mp3 = path.join(dir, `${clip.n}.mp3`);
  const clipLength = durationOf(clip.file) ?? 5;
  if (existsSync(mp3)) {
    const start = Math.max(clipStart, narrationEnd);
    const length = durationOf(mp3) ?? 0;
    tracks.push({ file: mp3, startMs: Math.round(start * 1000) });
    narrationEnd = start + length;
  }
  clipStart += clipLength;
}
if (tracks.length === 0) {
  console.error("no narration tracks (n.mp3) in", dir);
  process.exit(1);
}
const total = Math.max(clipStart, narrationEnd);

const inputs = ["-i", joined, ...tracks.flatMap((t) => ["-i", t.file])];
if (musicFile) inputs.push("-stream_loop", "-1", "-i", musicFile);
const musicIdx = 1 + tracks.length; // only valid when musicFile is set
const bed = hasAudio(joined) ? "[0:a]volume=0.5[bed];" : `anullsrc=r=44100:cl=stereo,atrim=0:${total}[bed];`;
const delayed = tracks.map((t, i) => `[${i + 1}:a]adelay=${t.startMs}|${t.startMs}[n${i}]`).join(";");
const music = musicFile ? `[${musicIdx}:a]atrim=0:${total},volume=${MUSIC_VOLUME}[music];` : "";
const mixInputs = `[bed]${tracks.map((_, i) => `[n${i}]`).join("")}${musicFile ? "[music]" : ""}`;
const mixCount = tracks.length + 1 + (musicFile ? 1 : 0);
const filter = `${bed}${delayed};${music}${mixInputs}amix=inputs=${mixCount}:duration=longest:normalize=0[a]`;
// The video freezes on its last frame if the final line outruns the last clip.
ffmpeg([
  ...inputs,
  "-filter_complex", filter,
  "-map", "0:v", "-map", "[a]",
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "160k",
  "-vf", `tpad=stop_mode=clone:stop_duration=${Math.max(0, total - clipStart).toFixed(2)}`,
  "-t", String(total.toFixed(2)),
  out,
]);
rmSync(work, { recursive: true, force: true });
console.log(`${clips.length} clip(s) + ${tracks.length} narration track(s) → ${out} (${total.toFixed(1)}s)`);
