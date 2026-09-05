// npm run check — the translator rule, enforced after the fact.
//
// Scans every recorded beat (recordings/<session>/<n>.json) and every
// translation (data/translations/*.json) and fails any beat with no
// source, a source index outside its answer's sentences, a line over 12
// words, a subject that names a person, or a `delivery` whose stripped
// text differs from `line` or that uses a tag outside the whitelist
// (translator v0.3; mirrors validateBeat in lib/translator.ts). Also fails
// a programme (one session or one cached translation) with more than one
// `hero` beat, or the same `scale` held for three beats running (mirrors
// validateProgramme). Exits non-zero if any is found. Soft warnings
// (headline length, a headline number not stated as a figure in the cited
// sentences — fine if it's a count of items those sentences enumerate) are
// listed but do not fail the check.
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
  if (!beat?.line) hard.push("no line");
  if (words(beat?.line) > MAX_LINE_WORDS) hard.push(`line is ${words(beat.line)} words (limit ${MAX_LINE_WORDS})`);
  for (const subject of Array.isArray(beat?.subjects) ? beat.subjects : []) {
    const person = subjectNamesPerson(String(subject));
    if (person) hard.push(`subject "${subject}" names a person (${person})`);
  }
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

/** Mirrors validateProgramme in lib/translator.ts: at most one hero, no 3-in-a-row scale. */
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
