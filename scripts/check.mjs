// npm run check — the translator rule, enforced after the fact.
//
// Scans every recorded beat (<RECORDINGS_DIR>/<session>/<n>.json — see
// lib/config.ts#recordingsDir, default ../tessera-recordings, shared by
// every checkout and worktree) and every translation
// (data/translations/*.json) and fails any beat with no
// source, a source index outside its answer's sentences, a line over 12
// words, a subject that names a person, or a `delivery` whose stripped
// text differs from `line` or that uses a tag outside the whitelist
// (translator v0.3.1; mirrors validateBeat in lib/translator.ts). Also
// fails a programme (one session or one cached translation) with more
// than one `hero` beat, the same `scale` held for three beats running, a
// `scene` that is not a run of 2-3 consecutive beats, or (multi-beat
// programmes only) a final beat whose `ground` does not match scene 1's
// (mirrors validateProgramme). Exits non-zero if any is found. Soft
// warnings (headline length, a headline number not stated as a figure in
// the cited sentences — fine if it's a count of items those sentences
// enumerate) are listed but do not fail the check.
//
//   node scripts/check.mjs                 everything
//   node scripts/check.mjs recordings/<session>
//   node scripts/check.mjs data/translations/<hash>.json

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Mirrors loadEnvLocal in scripts/render.mts: only sets what isn't already set. */
function loadEnvLocal() {
  let text;
  try {
    text = readFileSync(path.join(ROOT, ".env.local"), "utf8");
  } catch {
    return;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

/** Mirrors recordingsDir in lib/config.ts: shared across checkouts and worktrees by default. */
const RECORDINGS = path.resolve(ROOT, (process.env.RECORDINGS_DIR ?? "").trim() || "../tessera-recordings");
const TRANSLATIONS = path.join(ROOT, "data", "translations");

/**
 * Mirrors TRANSLATOR_VERSION in lib/translator.ts. A session or a cached
 * translation recorded under an earlier translator version predates this
 * version's rules by construction (e.g. every pre-v0.3.1 beat has no
 * `scene`, because the field didn't exist yet) — exactly the same
 * staleness app/api/translate/route.ts already checks before ever serving
 * a cached translation. Checking it here too means a translator version
 * bump doesn't turn every past recording permanently red; rule 7 keeps
 * them on disk as a historical record regardless.
 */
const CURRENT_TRANSLATOR_VERSION = "translator-v0.3.1";

const MAX_LINE_WORDS = 12;
const MAX_HEADLINE_WORDS = 4;

/** Mirrors PEOPLE_LEXICON in lib/translator.ts. */
const PEOPLE_LEXICON = [
  "person", "people", "man", "men", "woman", "women", "face", "faces", "figure", "figures",
  "executive", "executives", "ceo", "cfo", "coo", "cto", "worker", "workers", "customer", "customers",
  "crowd", "character", "characters", "employee", "employees", "founder", "founders", "staff",
  "spokesperson", "presenter", "narrator", "analyst", "analysts", "investor", "investors",
  "chairman", "chairwoman", "boy", "girl",
];

const words = (t) => String(t ?? "").trim().split(/\s+/).filter(Boolean).length;
const numbersIn = (t) => (String(t ?? "").match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""));

/** Mirrors DELIVERY_TAGS in lib/translator.ts. */
const DELIVERY_TAGS = ["presenting to camera", "excited", "fast-paced"];

/** Mirrors deliveryTags in lib/translator.ts. */
function deliveryTags(delivery) {
  return [...String(delivery ?? "").matchAll(/\[([^\]]*)\]/g)].map((m) => m[1]);
}

/** Mirrors stripDelivery in lib/translator.ts. */
function stripDelivery(delivery) {
  return String(delivery ?? "").replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
}

/** Mirrors subjectNamesPerson in lib/translator.ts. */
function subjectNamesPerson(subject) {
  const lower = subject.toLowerCase();
  for (const term of PEOPLE_LEXICON) {
    if (new RegExp(`\\b${term}\\b`).test(lower)) return `matches "${term}"`;
  }
  const parts = subject.trim().split(/\s+/);
  const capWords = parts.filter((w) => /^[A-Z][a-z]+$/.test(w));
  if (capWords.length >= 2) return "looks like a proper name";
  if (capWords.length === 1 && parts.indexOf(capWords[0]) > 0) return "looks like a proper name";
  return null;
}

/** Mirrors validateBeat in lib/translator.ts: hard = source/length/people, soft = the rest. */
function checkBeat(beat, sentences) {
  const hard = [];
  const soft = [];
  const source = Array.isArray(beat?.source) ? beat.source : [];
  const valid = source.filter((i) => Number.isInteger(i) && i >= 0 && (sentences === null || i < sentences.length));
  if (valid.length === 0) hard.push("no source");
  if (!(Number.isInteger(beat?.scene) && beat.scene > 0)) hard.push("no scene (positive integer)");
  if (!beat?.line) hard.push("no line");
  if (words(beat?.line) > MAX_LINE_WORDS) hard.push(`line is ${words(beat.line)} words (limit ${MAX_LINE_WORDS})`);
  for (const subject of Array.isArray(beat?.subjects) ? beat.subjects : []) {
    const person = subjectNamesPerson(String(subject));
    if (person) hard.push(`subject "${subject}" names a person (${person})`);
  }
  if (!beat?.action) hard.push("no action");
  if (beat?.headline && words(beat.headline) > MAX_HEADLINE_WORDS) soft.push(`headline is ${words(beat.headline)} words`);
  if (beat?.headline && sentences && valid.length) {
    const cited = valid.map((i) => sentences[i]).join(" ").replace(/,/g, "");
    for (const n of numbersIn(beat.headline)) {
      if (!cited.includes(n)) soft.push(`headline number "${n}" not stated as a figure in cited sentences (ok if a derived count)`);
    }
  }

  // delivery: missing falls back to line (nothing to check); present, it
  // may carry at most one whitelisted tag and must strip back to line exactly.
  const line = String(beat?.line ?? "").trim();
  const delivery = typeof beat?.delivery === "string" && beat.delivery.trim() ? beat.delivery : line;
  const tags = deliveryTags(delivery);
  for (const tag of tags) {
    if (!DELIVERY_TAGS.includes(tag)) hard.push(`delivery tag "[${tag}]" not in the whitelist`);
  }
  if (tags.length > 1) hard.push(`delivery carries ${tags.length} tags (limit 1)`);
  if (stripDelivery(delivery) !== line) hard.push(`delivery, stripped of tags, does not match line`);

  return { hard, soft };
}

/** Runs of consecutive beats sharing a `scene` number. Mirrors sceneRuns in lib/translator.ts. */
function sceneRuns(beats) {
  const runs = [];
  for (const beat of beats) {
    const last = runs[runs.length - 1];
    if (last && last[0]?.scene === beat?.scene) last.push(beat);
    else runs.push([beat]);
  }
  return runs;
}

/**
 * Mirrors validateProgramme in lib/translator.ts: at most one hero, no
 * 3-in-a-row scale, every scene a run of 2-3 beats, and (multi-beat
 * programmes only — a one-beat deflection is exempt by construction) the
 * final beat's ground bookending scene 1's.
 */
function checkProgramme(label, beats) {
  const progFailures = [];
  const heroes = beats.filter((b) => b?.hero === true).length;
  if (heroes > 1) progFailures.push(`${heroes} hero beats (limit 1)`);
  for (let i = 0; i + 2 < beats.length; i += 1) {
    const [a, b, c] = [beats[i], beats[i + 1], beats[i + 2]];
    if (a?.scale && a.scale === b?.scale && b.scale === c?.scale) {
      progFailures.push(`scale "${a.scale}" repeats for beats ${i + 1}-${i + 3}`);
    }
  }
  if (beats.length > 1) {
    for (const run of sceneRuns(beats)) {
      if (run.length < 2 || run.length > 3) {
        progFailures.push(`scene ${run[0]?.scene} has ${run.length} beat(s) (expected 2-3)`);
      }
    }
    if (beats[0]?.ground !== beats[beats.length - 1]?.ground) {
      progFailures.push(
        `final beat's ground "${beats[beats.length - 1]?.ground}" does not bookend scene 1's ground "${beats[0]?.ground}"`
      );
    }
  }
  for (const f of progFailures) {
    failures += 1;
    console.log(`FAIL  ${label}: ${f}`);
  }
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
  if (manifest?.translatorVersion && manifest.translatorVersion !== CURRENT_TRANSLATOR_VERSION) {
    console.log(`info  ${path.relative(ROOT, dir)}: recorded under ${manifest.translatorVersion}, not ${CURRENT_TRANSLATOR_VERSION}; skipped`);
    return;
  }
  const sentences = manifest && Array.isArray(manifest.sentences) ? manifest.sentences : null;
  const files = readdirSync(dir).filter((f) => /^\d+\.json$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b));
  const beats = [];
  for (const file of files) {
    const rec = readJson(path.join(dir, file));
    if (!rec) continue;
    report(`${path.relative(ROOT, dir)}/${file}`, rec.beat, sentences);
    beats.push(rec.beat);
  }
  checkProgramme(path.relative(ROOT, dir), beats);
  if (manifest && Array.isArray(manifest.dropped) && manifest.dropped.length) {
    console.log(`info  ${path.relative(ROOT, dir)}: ${manifest.dropped.length} beat(s) dropped by the translator rule at run time`);
  }
}

function checkTranslation(file) {
  const t = readJson(file);
  if (!t || !Array.isArray(t.beats)) return;
  if (t.translator && t.translator !== CURRENT_TRANSLATOR_VERSION) {
    console.log(`info  ${path.relative(ROOT, file)}: cached under ${t.translator}, not ${CURRENT_TRANSLATOR_VERSION}; skipped (served live, not from cache)`);
    return;
  }
  // Translations do not carry the sentences; index bounds are checked at run time.
  t.beats.forEach((beat, i) => report(`${path.relative(ROOT, file)}#${i + 1}`, beat, null));
  checkProgramme(path.relative(ROOT, file), t.beats);
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
