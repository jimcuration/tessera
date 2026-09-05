// Numbers for briefs/WP0-report.md and briefs/WP8-report.md, from the
// recordings.
//
//   node scripts/report.mjs recordings/<session> [recordings/<session> ...]
//
// Per session: render time per clip (p50, max), cost per clip and per 60s
// at post-promo rates, Whisper word-match (when whisper.json exists), and
// which style-sheet lines survived in fal's expanded_prompt. Prints
// markdown; the subjective columns are filled in by hand.
//
// WP8 adds, per session: clip length (from switches.clipSeconds, default
// 5), render/playback ratio per clip, words per line, an approximate time
// to first frame (firstBeatMs + the first clip's own renderMs — a
// recorded-fields estimate, not a browser-measured paint time), a nominal
// seam count per minute (external cuts = clip count - 1, plus one internal
// cut per clip when clipSeconds is 10 and the beat's action asked for
// one — nominal because whether that internal cut actually renders is a
// visual call, left to Robin per brief), and the Saskia scene-audio split
// method per scene (voice-scene-<n>.json, when present). A final section
// groups every session passed on the command line by clip length so p50
// and the ratio compare directly across 5s and 10s runs.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** Post-promo H3 Max Turbo price at 480P (brief: $0.025 per second). */
const USD_PER_SECOND = 0.025;

/** Mirrors STYLE_SHEET_SIGNALS in lib/prompt.ts (style sheet v0.3, 11 lines). v0.2's line 6 (flat matte / no glow) is folded into line 3; a new line 8 (scale) replaces its slot. */
const SIGNALS = [
  ["paper collage", "collage", "magazine"],
  ["block-colour", "block color", "block-color", "flat ground", "solid ground", "flat background", "solid background", "lime green", "pale cyan", "soft violet", "deep magenta"],
  ["halftone", "torn-paper", "torn paper", "cutout", "blank face", "unmarked", "reflecting only the room light", "no glow", "no neon", "no halo", "flat matte", "never a person's face", "never a face", "blank paper texture"],
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

function words(text) {
  return String(text ?? "").trim().split(/\s+/).filter(Boolean).length;
}

const sessions = process.argv.slice(2).filter((a) => existsSync(a));
if (sessions.length === 0) {
  console.error("usage: node scripts/report.mjs recordings/<session> [...]");
  process.exit(1);
}

/** clipSeconds -> { p50s: [], maxes: [], ratios: [] }, across every session passed. */
const byClipLength = new Map();

for (const dir of sessions) {
  const manifest = readJson(path.join(dir, "session.json")) ?? {};
  const whisper = readJson(path.join(dir, "whisper.json"));
  const splitCheck = readJson(path.join(dir, "saskia-split-check.json"));
  const clipSeconds = manifest.switches?.clipSeconds ?? 5;
  const clips = readdirSync(dir)
    .filter((f) => /^\d+\.json$/.test(f))
    .map((f) => readJson(path.join(dir, f)))
    .filter(Boolean)
    .sort((a, b) => a.n - b.n);
  const renders = clips.map((c) => c.renderMs).filter((v) => typeof v === "number");
  const ratios = renders.map((ms) => ms / (clipSeconds * 1000));
  const p50 = percentile(renders, 0.5);
  const max = renders.length ? Math.max(...renders) : null;
  const p50Ratio = percentile(ratios, 0.5);
  const maxRatio = ratios.length ? Math.max(...ratios) : null;
  const heard = new Map((whisper?.clips ?? []).map((c) => [c.n, c]));
  const wordsPerLine = clips.map((c) => words(c.beat?.line)).filter((n) => n > 0);
  const meanWords = wordsPerLine.length ? wordsPerLine.reduce((a, b) => a + b, 0) / wordsPerLine.length : null;
  // Approximate: recorded fields, not a browser-measured paint time (WP0's
  // own time-to-first-frame numbers were measured by hand in the browser).
  const timeToFirstFrame =
    typeof manifest.firstBeatMs === "number" && typeof clips[0]?.renderMs === "number"
      ? manifest.firstBeatMs + clips[0].renderMs
      : null;
  // Nominal: external cuts (clip boundaries) plus one internal cut per clip
  // when the beat's action was told it may carry one (clipSeconds 10).
  // Whether that internal cut actually reads as a cut in the footage is a
  // visual call — left to Robin's subjective notes, not asserted here.
  const externalCuts = Math.max(0, clips.length - 1);
  const internalCuts = clipSeconds === 10 ? clips.length : 0;
  const programmeMinutes = (clips.length * clipSeconds) / 60;
  const seamsPerMinute = programmeMinutes > 0 ? (externalCuts + internalCuts) / programmeMinutes : null;

  if (!byClipLength.has(clipSeconds)) byClipLength.set(clipSeconds, { p50s: [], maxes: [], ratios: [] });
  const agg = byClipLength.get(clipSeconds);
  if (p50 !== null) agg.p50s.push(p50);
  if (max !== null) agg.maxes.push(max);
  agg.ratios.push(...ratios);

  console.log(`\n## ${path.basename(dir)}\n`);
  console.log(`- question: ${manifest.matchedQuestion ?? manifest.question ?? "?"}`);
  console.log(`- switches: VOICE=${manifest.switches?.voice ?? "?"} CHAIN=${manifest.switches?.chain ?? "?"} RENDER=${manifest.switches?.render ?? "?"} CLIP_SECONDS=${clipSeconds}`);
  console.log(`- translation: ${manifest.translateSource ?? "?"}${manifest.translateMs ? ` in ${manifest.translateMs} ms` : ""}, first beat at ${manifest.firstBeatMs ?? "?"} ms, ${clips.length} clip(s) rendered, ${(manifest.dropped ?? []).length} dropped`);
  console.log(`- render time: p50 ${p50 ?? "?"} ms, max ${max ?? "?"} ms (n=${renders.length}); render/playback ratio: p50 ${p50Ratio !== null ? p50Ratio.toFixed(2) : "?"}, max ${maxRatio !== null ? maxRatio.toFixed(2) : "?"}`);
  console.log(`- time to first frame (approx, firstBeatMs + first clip's renderMs): ${timeToFirstFrame ?? "?"} ms`);
  console.log(`- words per line: mean ${meanWords !== null ? meanWords.toFixed(1) : "?"} (n=${wordsPerLine.length}, limit ${clipSeconds === 10 ? 22 : 12})`);
  console.log(`- seam count per minute (nominal: ${externalCuts} external + ${internalCuts} internal over ${programmeMinutes.toFixed(2)} min): ${seamsPerMinute !== null ? seamsPerMinute.toFixed(1) : "?"}`);
  console.log(`- cost per clip at post-promo $${USD_PER_SECOND}/s × ${clipSeconds}s = $${(USD_PER_SECOND * clipSeconds).toFixed(3)}; per 60 s of programme = $${(USD_PER_SECOND * 60).toFixed(2)}`);
  if (whisper) console.log(`- whisper (${whisper.model}) mean word recall: ${(whisper.meanWordRecall * 100).toFixed(1)}%`);
  if (splitCheck) {
    console.log(
      `- Saskia split-check (Whisper on each beat's split narration): mean own-line recall ${(splitCheck.meanOwnRecall * 100).toFixed(1)}%, ${splitCheck.bleeds} beat(s) with a neighbour's words detected`
    );
  }
  const scenesLogged = readdirSync(dir).filter((f) => /^voice-scene-.+\.json$/.test(f));
  if (scenesLogged.length) {
    const methods = scenesLogged.map((f) => readJson(path.join(dir, f))?.splitMethod ?? "?");
    const counts = methods.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map());
    console.log(`- Saskia scenes: ${scenesLogged.length} request(s); split method ${[...counts].map(([k, v]) => `${k}=${v}`).join(", ")}`);
  }

  console.log(`\n| # | chained | render ms | ratio | headline | hero | scale | tags | whisper recall | heard |\n|---|---|---|---|---|---|---|---|---|---|`);
  for (const c of clips) {
    const w = heard.get(c.n);
    const tags = [...String(c.beat?.delivery ?? "").matchAll(/\[([^\]]*)\]/g)].map((m) => m[1]);
    const ratio = typeof c.renderMs === "number" ? (c.renderMs / (clipSeconds * 1000)).toFixed(2) : "—";
    console.log(
      `| ${c.n} | ${c.chained ? "i2v" : "t2v"} | ${c.renderMs} | ${ratio} | ${c.beat?.headline ?? "—"} | ${c.beat?.hero ? "hero" : "·"} | ${c.beat?.scale ?? "—"} | ${tags.length ? tags.join(", ") : "—"} | ${w ? `${(w.wordRecall * 100).toFixed(0)}% (${w.matched}/${w.words})` : "—"} | ${w ? (w.heard || "(silent)").replace(/\|/g, "/") : "—"} |`
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

if (byClipLength.size > 1) {
  console.log(`\n## Render time by clip length (WP8 §1)\n`);
  console.log(`| CLIP_SECONDS | sessions | render ms p50 (of sessions' p50s) | render ms max | ratio p50 | ratio max |\n|---|---|---|---|---|---|`);
  for (const [clipSeconds, agg] of [...byClipLength].sort((a, b) => a[0] - b[0])) {
    const p50 = percentile(agg.p50s, 0.5);
    const max = agg.maxes.length ? Math.max(...agg.maxes) : null;
    const ratioP50 = percentile(agg.ratios, 0.5);
    const ratioMax = agg.ratios.length ? Math.max(...agg.ratios) : null;
    console.log(
      `| ${clipSeconds}s | ${agg.p50s.length} | ${p50 ?? "?"} | ${max ?? "?"} | ${ratioP50 !== null ? ratioP50.toFixed(2) : "?"} | ${ratioMax !== null ? ratioMax.toFixed(2) : "?"} |`
    );
  }
  console.log(`\nAcceptance criterion 2 (10s p50 render/playback ratio ≤ 0.6): ${(() => {
    const agg10 = byClipLength.get(10);
    if (!agg10 || agg10.ratios.length === 0) return "no 10s data";
    const r = percentile(agg10.ratios, 0.5);
    return `p50 ratio ${r.toFixed(2)} — ${r <= 0.6 ? "met" : "not met"} (measured, not asserted as passed — brief: do not mark criteria as passed)`;
  })()}`);
}
