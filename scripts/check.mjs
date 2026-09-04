// npm run check — the translator rule, enforced after the fact.
//
// Scans every recorded beat (recordings/<session>/<n>.json) and every
// translation (data/translations/*.json) and flags any beat with no source
// or a source index outside its answer's sentences. Exits non-zero if any
// is found. Soft warnings (line length, headline numbers not in the cited
// sentences) are listed but do not fail the check.
//
//   node scripts/check.mjs                 everything
//   node scripts/check.mjs recordings/<session>
//   node scripts/check.mjs data/translations/<hash>.json

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RECORDINGS = path.join(ROOT, "recordings");
const TRANSLATIONS = path.join(ROOT, "data", "translations");

const MAX_LINE_WORDS = 18;
const MAX_HEADLINE_WORDS = 4;

const words = (t) => String(t ?? "").trim().split(/\s+/).filter(Boolean).length;
const numbersIn = (t) => (String(t ?? "").match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""));

/** Mirrors validateBeat in lib/translator.ts: hard = source, soft = the rest. */
function checkBeat(beat, sentences) {
  const hard = [];
  const soft = [];
  const source = Array.isArray(beat?.source) ? beat.source : [];
  const valid = source.filter((i) => Number.isInteger(i) && i >= 0 && (sentences === null || i < sentences.length));
  if (valid.length === 0) hard.push("no source");
  if (!beat?.line) hard.push("no line");
  if (words(beat?.line) > MAX_LINE_WORDS) soft.push(`line is ${words(beat.line)} words`);
  if (beat?.headline && words(beat.headline) > MAX_HEADLINE_WORDS) soft.push(`headline is ${words(beat.headline)} words`);
  if (beat?.headline && sentences && valid.length) {
    const cited = valid.map((i) => sentences[i]).join(" ").replace(/,/g, "");
    for (const n of numbersIn(beat.headline)) {
      if (!cited.includes(n)) soft.push(`headline number "${n}" not in cited sentences`);
    }
  }
  return { hard, soft };
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

let beats = 0;
let failures = 0;
let warnings = 0;

function report(label, beat, sentences) {
  beats += 1;
  const { hard, soft } = checkBeat(beat, sentences);
  if (hard.length) {
    failures += 1;
    console.log(`FAIL  ${label}: ${hard.join(", ")}`);
  }
  for (const w of soft) {
    warnings += 1;
    console.log(`warn  ${label}: ${w}`);
  }
}

function checkSession(dir) {
  const manifest = readJson(path.join(dir, "session.json"));
  const sentences = manifest && Array.isArray(manifest.sentences) ? manifest.sentences : null;
  const files = readdirSync(dir).filter((f) => /^\d+\.json$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b));
  for (const file of files) {
    const rec = readJson(path.join(dir, file));
    if (!rec) continue;
    report(`${path.relative(ROOT, dir)}/${file}`, rec.beat, sentences);
  }
  if (manifest && Array.isArray(manifest.dropped) && manifest.dropped.length) {
    console.log(`info  ${path.relative(ROOT, dir)}: ${manifest.dropped.length} beat(s) dropped by the translator rule at run time`);
  }
}

function checkTranslation(file) {
  const t = readJson(file);
  if (!t || !Array.isArray(t.beats)) return;
  // Translations do not carry the sentences; index bounds are checked at run time.
  t.beats.forEach((beat, i) => report(`${path.relative(ROOT, file)}#${i + 1}`, beat, null));
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
  if (existsSync(RECORDINGS)) {
    for (const name of readdirSync(RECORDINGS)) {
      const dir = path.join(RECORDINGS, name);
      if (statSync(dir).isDirectory() && name !== "reels") checkSession(dir);
    }
  }
  if (existsSync(TRANSLATIONS)) {
    for (const name of readdirSync(TRANSLATIONS)) {
      if (name.endsWith(".json")) checkTranslation(path.join(TRANSLATIONS, name));
    }
  }
} else {
  for (const target of targets) {
    const full = path.resolve(ROOT, target);
    if (!existsSync(full)) {
      console.log(`FAIL  ${target}: not found`);
      failures += 1;
    } else if (statSync(full).isDirectory()) {
      checkSession(full);
    } else {
      checkTranslation(full);
    }
  }
}

console.log(`\n${beats} beat(s) checked, ${failures} without a valid source, ${warnings} warning(s).`);
process.exit(failures > 0 ? 1 : 0);
