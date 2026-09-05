// Numbers for briefs/WP0-report.md, from the recordings.
//
//   node scripts/report.mjs recordings/<session> [recordings/<session> ...]
//
// Per session: render time per clip (p50, max), cost per clip and per 60s
// at post-promo rates, Whisper word-match (when whisper.json exists), and
// which style-sheet lines survived in fal's expanded_prompt. Prints
// markdown; the subjective columns are filled in by hand.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** Post-promo H3 Max Turbo price at 480P (brief: $0.025 per second). */
const USD_PER_SECOND = 0.025;
const CLIP_SECONDS = 5;

/** Mirrors STYLE_SHEET_SIGNALS in lib/prompt.ts (style sheet v0.3, 11 lines). v0.2's line 6 (flat matte / no glow) is folded into line 3; a new line 8 (scale) replaces its slot. */
const SIGNALS = [
  ["paper collage", "collage", "magazine"],
  ["block-colour", "block color", "block-color", "flat ground", "solid ground", "flat background", "solid background", "lime green", "pale cyan", "soft violet", "deep magenta"],
  ["halftone", "torn-paper", "torn paper", "cutout", "blank face", "unmarked", "reflecting only the room light", "no glow", "no neon", "no halo", "flat matte"],
  ["paper shapes", "ribbons", "tape", "print dots", "paper texture", "rubber stamp", "stencilled arrow", "bar chart", "stacked sheets", "grid paper", "torn strip", "hole-punched", "paper clip"],
  ["upper-left", "upper left", "paper-layer shadow", "paper shadow", "layer shadow"],
  ["headline chip", "upper third", "lower two-thirds", "clear ground"],
  ["extra-bold", "sans-serif", "paper chip", "headline", "third of the frame", "hero"],
  ["oversized", "small-scale", "open ground", "diagram", "vary in scale"],
  ["overshoot", "stable landing", "reading window", "no camera shake", "camera is locked", "first frame", "static shot"],
  ["16:9", "5 seconds", "five seconds", "one composition", "crisp cut", "single continuous"],
  ["torn-paper edges", "torn paper edges", "torn edges", "identity anchor", "rough white"],
];
const LINE_NAMES = [
  "1 collage", "2 ground", "3 halftone/unmarked/matte", "4 paper diagram", "5 upper-left light",
  "6 layout law", "7 headline type", "8 scale variety", "9 motion", "10 16:9, 5s, one comp", "11 identity anchor",
];

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return sorted[idx];
}

function survival(expanded) {
  const text = (expanded ?? "").toLowerCase();
  return SIGNALS.map((phrases) => phrases.some((p) => text.includes(p.toLowerCase())));
}

const sessions = process.argv.slice(2).filter((a) => existsSync(a));
if (sessions.length === 0) {
  console.error("usage: node scripts/report.mjs recordings/<session> [...]");
  process.exit(1);
}

for (const dir of sessions) {
  const manifest = readJson(path.join(dir, "session.json")) ?? {};
  const whisper = readJson(path.join(dir, "whisper.json"));
  const clips = readdirSync(dir)
    .filter((f) => /^\d+\.json$/.test(f))
    .map((f) => readJson(path.join(dir, f)))
    .filter(Boolean)
    .sort((a, b) => a.n - b.n);
  const renders = clips.map((c) => c.renderMs).filter((v) => typeof v === "number");
  const p50 = percentile(renders, 0.5);
  const max = renders.length ? Math.max(...renders) : null;
  const heard = new Map((whisper?.clips ?? []).map((c) => [c.n, c]));

  console.log(`\n## ${path.basename(dir)}\n`);
  console.log(`- question: ${manifest.matchedQuestion ?? manifest.question ?? "?"}`);
  console.log(`- switches: VOICE=${manifest.switches?.voice ?? "?"} CHAIN=${manifest.switches?.chain ?? "?"} RENDER=${manifest.switches?.render ?? "?"}`);
  console.log(`- translation: ${manifest.translateSource ?? "?"}${manifest.translateMs ? ` in ${manifest.translateMs} ms` : ""}, first beat at ${manifest.firstBeatMs ?? "?"} ms, ${clips.length} clip(s) rendered, ${(manifest.dropped ?? []).length} dropped`);
  console.log(`- render time: p50 ${p50 ?? "?"} ms, max ${max ?? "?"} ms (n=${renders.length})`);
  console.log(`- cost per clip at post-promo $${USD_PER_SECOND}/s × ${CLIP_SECONDS}s = $${(USD_PER_SECOND * CLIP_SECONDS).toFixed(3)}; per 60 s of programme = $${(USD_PER_SECOND * 60).toFixed(2)}`);
  if (whisper) console.log(`- whisper (${whisper.model}) mean word recall: ${(whisper.meanWordRecall * 100).toFixed(1)}%`);

  console.log(`\n| # | chained | render ms | headline | hero | scale | tags | whisper recall | heard |\n|---|---|---|---|---|---|---|---|---|`);
  for (const c of clips) {
    const w = heard.get(c.n);
    const tags = [...String(c.beat?.delivery ?? "").matchAll(/\[([^\]]*)\]/g)].map((m) => m[1]);
    console.log(
      `| ${c.n} | ${c.chained ? "i2v" : "t2v"} | ${c.renderMs} | ${c.beat?.headline ?? "—"} | ${c.beat?.hero ? "hero" : "·"} | ${c.beat?.scale ?? "—"} | ${tags.length ? tags.join(", ") : "—"} | ${w ? `${(w.wordRecall * 100).toFixed(0)}% (${w.matched}/${w.words})` : "—"} | ${w ? (w.heard || "(silent)").replace(/\|/g, "/") : "—"} |`
    );
  }

  console.log(`\nStyle-sheet lines surviving in expanded_prompt (✓ = a phrase from the line, or its paraphrase, is present):\n`);
  console.log(`| # | ${LINE_NAMES.map((n) => n.split(" ")[0]).join(" | ")} | kept |\n|---|${LINE_NAMES.map(() => "---").join("|")}|---|`);
  const totals = new Array(SIGNALS.length).fill(0);
  for (const c of clips) {
    const s = survival(c.expandedPrompt);
    s.forEach((v, i) => {
      if (v) totals[i] += 1;
    });
    console.log(`| ${c.n} | ${s.map((v) => (v ? "✓" : "·")).join(" | ")} | ${s.filter(Boolean).length}/${SIGNALS.length} |`);
  }
  console.log(`| all | ${totals.map((t) => `${t}/${clips.length}`).join(" | ")} | |`);
  console.log(`\nLines: ${LINE_NAMES.join("; ")}.`);
}
