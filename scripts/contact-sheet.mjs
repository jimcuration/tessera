// Contact sheet of one frame per clip in a recorded session.
//
//   node scripts/contact-sheet.mjs recordings/<session> [--at first|mid|last] [--out file.jpg] [--cols 3]
//
// Default: first frames, written to recordings/<session>/contact-<at>.jpg.

import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { durationOf, ffmpeg } from "./ffmpeg.mjs";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
if (!dir || !existsSync(dir)) {
  console.error("usage: node scripts/contact-sheet.mjs recordings/<session> [--at first|mid|last] [--out file] [--cols n]");
  process.exit(1);
}
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const at = opt("at", "first");
const cols = Number(opt("cols", "3"));
const out = opt("out", path.join(dir, `contact-${at}.jpg`));

const clips = readdirSync(dir)
  .filter((f) => /^\d+\.mp4$/.test(f))
  .sort((a, b) => parseInt(a) - parseInt(b));
if (clips.length === 0) {
  console.error("no clips in", dir);
  process.exit(1);
}

const work = path.join(tmpdir(), `tessera-contact-${Date.now()}`);
mkdirSync(work, { recursive: true });
const frames = [];
for (const clip of clips) {
  const file = path.join(dir, clip);
  const n = parseInt(clip);
  const duration = durationOf(file) ?? 5;
  const seek = at === "first" ? 0 : at === "last" ? Math.max(0, duration - 0.1) : duration / 2;
  const frame = path.join(work, `${String(n).padStart(2, "0")}.png`);
  // Label each tile with its beat number so the sheet reads left to right.
  ffmpeg([
    "-ss", String(seek), "-i", file, "-frames:v", "1",
    "-vf", `scale=640:-2,drawbox=x=0:y=0:w=64:h=40:color=black@0.7:t=fill,drawtext=text='${n}':x=22:y=8:fontsize=28:fontcolor=white`,
    frame,
  ]);
  frames.push(frame);
}

const rows = Math.ceil(frames.length / cols);
const inputs = frames.flatMap((f) => ["-i", f]);
mkdirSync(path.dirname(out), { recursive: true });
ffmpeg([
  ...inputs,
  "-filter_complex",
  `${frames.map((_, i) => `[${i}:v]`).join("")}xstack=inputs=${frames.length}:layout=${layout(frames.length, cols)}:fill=black[v]`,
  "-map", "[v]", "-frames:v", "1", "-q:v", "3", out,
]);
rmSync(work, { recursive: true, force: true });
console.log(`${frames.length} frame(s) (${at}) → ${out} (${cols}×${rows})`);

function layout(count, columns) {
  const w = 640;
  const h = 360;
  const cells = [];
  for (let i = 0; i < count; i += 1) {
    const x = (i % columns) * w;
    const y = Math.floor(i / columns) * h;
    cells.push(`${x}_${y}`);
  }
  return cells.join("|");
}
