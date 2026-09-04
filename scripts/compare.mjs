// Side-by-side comparison reel of two recorded sessions of the same beats.
//
//   node scripts/compare.mjs recordings/<left> recordings/<right> --out recordings/reels/compare.mp4 [--labels "chained,unchained"]
//
// Each side is its clips concatenated in beat order; the two run in
// parallel with a label in the corner. Audio comes from the left side.

import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ffmpeg } from "./ffmpeg.mjs";

const args = process.argv.slice(2);
const dirs = args.filter((a) => !a.startsWith("--") && existsSync(a)).slice(0, 2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
if (dirs.length !== 2) {
  console.error("usage: node scripts/compare.mjs recordings/<left> recordings/<right> --out file.mp4 [--labels a,b]");
  process.exit(1);
}
const out = opt("out", path.join("recordings", "reels", "compare.mp4"));
const [labelL, labelR] = opt("labels", "chain on,chain off").split(",");

const work = path.join(tmpdir(), `tessera-compare-${Date.now()}`);
mkdirSync(work, { recursive: true });
mkdirSync(path.dirname(out), { recursive: true });

const joined = dirs.map((dir, i) => {
  const clips = readdirSync(dir)
    .filter((f) => /^\d+\.mp4$/.test(f))
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map((f) => path.resolve(dir, f));
  const list = path.join(work, `list${i}.txt`);
  writeFileSync(list, clips.map((c) => `file '${c.replace(/'/g, "'\\''")}'`).join("\n"));
  const file = path.join(work, `side${i}.mp4`);
  ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", file]);
  return file;
});

const label = (i, text) =>
  `[${i}:v]scale=640:-2,drawbox=x=0:y=0:w=iw:h=44:color=black@0.6:t=fill,drawtext=text='${text.replace(/'/g, "")}':x=16:y=10:fontsize=26:fontcolor=white[s${i}]`;
ffmpeg([
  "-i", joined[0], "-i", joined[1],
  "-filter_complex", `${label(0, labelL)};${label(1, labelR)};[s0][s1]hstack=inputs=2:shortest=1[v]`,
  "-map", "[v]", "-map", "0:a?",
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "160k",
  out,
]);
rmSync(work, { recursive: true, force: true });
console.log(`${labelL} | ${labelR} → ${out}`);
