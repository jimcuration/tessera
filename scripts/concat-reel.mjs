// One-off: concatenate two already-built reels back-to-back for
// briefs/WP8.2-report.md's fixed-vs-voice-led comparison deliverable.
//   node scripts/concat-reel.mjs a.mp4 b.mp4 out.mp4
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ffmpeg } from "./ffmpeg.mjs";

const [a, b, out] = process.argv.slice(2);
if (!a || !b || !out) {
  console.error("usage: node scripts/concat-reel.mjs a.mp4 b.mp4 out.mp4");
  process.exit(1);
}
mkdirSync(path.dirname(out), { recursive: true });
const list = path.join(path.dirname(out), "._concat-list.txt");
writeFileSync(
  list,
  [a, b].map((f) => `file '${path.resolve(f).replace(/'/g, "'\\''")}'`).join("\n")
);
ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", out]);
console.log(`wrote ${out}`);
