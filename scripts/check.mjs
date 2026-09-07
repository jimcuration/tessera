// npm run check — the translator rule, enforced after the fact.
//
// Scans every recorded beat (<RECORDINGS_DIR>/<session>/<n>.json — see
// lib/config.ts#recordingsDir, default ../tessera-recordings, shared by
// every checkout and worktree) and every translation
// (data/translations/*.json) and fails any beat with no
// source, a source index outside its answer's sentences, a line over its
// clip length's word budget, a subject that names a person, a `delivery`
// whose stripped text differs from `line` or that uses a tag outside the
// whitelist, no `narration`, a banned voice-brief phrase in `line`, or a
// first-person opinion marker whose cited sentence doesn't hedge
// (translator v0.4.0; mirrors validateBeat in lib/translator.ts). Also
// fails a programme (one session or one cached translation) with more
// than one `hero` beat, the same `scale` held for three beats running, a
// `scene` that is not a run of 2-3 consecutive beats, a scene whose beats
// disagree on `narration` or whose `narration` doesn't equal those beats'
// `line`s concatenated, a scene `narration` over budget, or (multi-beat
// programmes only) a final beat whose `ground` does not match scene 1's
// (mirrors validateProgramme). Exits non-zero if any is found. Soft
// warnings (headline length, a headline number not stated as a figure in
// the cited sentences, a spelled-out narration figure not found among its
// scene's cited sentences — WP10's heuristic proxy for "every sentence
// maps to a cited sentence", approximate by design, see lib/translator.ts's
// spelledNumbersIn doc comment) are listed but do not fail the check.
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
const CURRENT_TRANSLATOR_VERSION = "translator-v0.4.0";

const MAX_HEADLINE_WORDS = 4;
/** Mirrors MAX_TAG_WORDS in lib/translator.ts (WP8.1 §3). */
const MAX_TAG_WORDS = 2;

/** Mirrors maxLineWords in lib/translator.ts (WP8/WP8.1: the line budget scales with CLIP_SECONDS). */
function maxLineWords(clipSeconds) {
  return clipSeconds === 5 ? 12 : 22;
}

/** Mirrors maxSceneWords in lib/translator.ts (WP10 §1: a scene's narration is three beats' worth). */
function maxSceneWords(clipSeconds) {
  return maxLineWords(clipSeconds) * 3;
}

/** Mirrors BANNED_PHRASES in lib/translator.ts (WP10 §2/§5: the voice brief's own avoid-list). */
const BANNED_PHRASES = [
  "one might consider", "it is important to note", "in order to", "due to the fact that",
  "leverage", "leveraging", "unlock", "unlocking", "landscape", "robust", "ecosystem", "journey",
  "navigate", "navigating",
];

/** Mirrors OPINION_MARKERS in lib/translator.ts. */
const OPINION_MARKERS = ["i think", "i'd", "i would", "honestly i", "i'm not sure", "maybe it's just me"];

/** Mirrors HEDGE_LEXICON in lib/translator.ts. */
const HEDGE_LEXICON = [
  "may", "might", "could", "likely", "unlikely", "roughly", "approximately", "possibly", "perhaps",
  "appears", "seems", "suggest", "suggests", "expect", "expects", "expected", "believe", "believes",
  "uncertain", "risk", "risks", "plausible", "unclear", "assum", "if ",
];

const NUM_ONES = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const NUM_TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const NUM_MAGNITUDE = { thousand: 1000, million: 1000000, billion: 1000000000 };

/** Mirrors spelledNumbersIn in lib/translator.ts (WP10 §5 heuristic — see that file's doc comment for its limits). */
function spelledNumbersIn(text) {
  const words = text.toLowerCase().replace(/[.,;:!?()"'‘’“”…]/g, " ").split(/[\s-]+/).filter(Boolean);
  const out = [];
  let i = 0;
  while (i < words.length) {
    if (!(words[i] in NUM_ONES) && !(words[i] in NUM_TENS)) { i += 1; continue; }
    let value = 0, matchedAny = false, hadMagnitude = false, usedTens = false, usedOnes = false;
    while (i < words.length) {
      const w = words[i];
      if (w === "and" && matchedAny) { i += 1; continue; }
      // A year spoken in two chunks ("twenty twenty-six") is two tens/ones
      // groups back to back, not one number to sum.
      if (w in NUM_TENS && usedTens) break;
      if (w in NUM_ONES && usedOnes && NUM_ONES[w] < 10) break;
      if (w in NUM_ONES) { value += NUM_ONES[w]; matchedAny = true; usedOnes = true; i += 1; }
      else if (w in NUM_TENS) { value += NUM_TENS[w]; matchedAny = true; usedTens = true; i += 1; }
      else if (w === "hundred" && matchedAny) { value *= 100; hadMagnitude = true; usedOnes = false; usedTens = false; i += 1; }
      else if (w in NUM_MAGNITUDE && matchedAny) { value *= NUM_MAGNITUDE[w]; hadMagnitude = true; i += 1; break; }
      else break;
    }
    if (!matchedAny) { i += 1; continue; }
    let decimalStr = "";
    if (words[i] === "point") {
      let j = i + 1;
      const digits = [];
      while (j < words.length && words[j] in NUM_ONES && NUM_ONES[words[j]] <= 9) { digits.push(String(NUM_ONES[words[j]])); j += 1; }
      if (digits.length) { decimalStr = `.${digits.join("")}`; i = j; }
    }
    if (value >= 10 || decimalStr || hadMagnitude) out.push(`${value}${decimalStr}`);
  }
  return out;
}

/** Mirrors numbersClose in lib/translator.ts. */
function numbersClose(a, b) {
  const fa = Number.parseFloat(a), fb = Number.parseFloat(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) return a === b;
  if (fa === fb) return true;
  return Math.abs(fa - fb) <= Math.max(0.01, Math.abs(fb) * 0.01);
}

/** Mirrors normaliseWs in lib/translator.ts. */
function normaliseWs(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

/** Mirrors appearsVerbatim in lib/translator.ts. */
function appearsVerbatim(needle, haystack) {
  const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  return norm(haystack).includes(norm(needle));
}

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
function checkBeat(beat, sentences, clipSeconds) {
  const hard = [];
  const soft = [];
  const maxWords = maxLineWords(clipSeconds);
  const source = Array.isArray(beat?.source) ? beat.source : [];
  const valid = source.filter((i) => Number.isInteger(i) && i >= 0 && (sentences === null || i < sentences.length));
  if (valid.length === 0) hard.push("no source");
  if (!(Number.isInteger(beat?.scene) && beat.scene > 0)) hard.push("no scene (positive integer)");
  if (!beat?.line) hard.push("no line");
  if (words(beat?.line) > maxWords) hard.push(`line is ${words(beat.line)} words (limit ${maxWords})`);

  // WP10 §5: the voice brief's avoid-list fails the beat; a first-person
  // opinion marker is fine only when the beat's own cited sentences hedge.
  const lineLower = String(beat?.line ?? "").toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lineLower)) {
      hard.push(`line uses a banned phrase "${phrase}"`);
    }
  }
  if (sentences) {
    const citedForBeat = valid.map((i) => sentences[i] ?? "").join(" ").toLowerCase();
    const hasHedge = HEDGE_LEXICON.some((h) => citedForBeat.includes(h));
    const opinionHit = OPINION_MARKERS.find((m) => lineLower.includes(m));
    if (opinionHit) {
      if (!hasHedge) hard.push(`line uses a first-person opinion marker "${opinionHit}" but its cited sentence(s) do not hedge`);
      else soft.push(`line uses a first-person opinion marker "${opinionHit}" (cited sentence hedges, so kept)`);
    }
  }
  if (!beat?.narration || !String(beat.narration).trim()) hard.push("no narration");

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

  // WP8.1 §2/§3: mirrors the connector/tag structural checks in validateBeat.
  // Cross-beat checks (from/to in the scene's subjects, one beat per scene
  // agreeing, at most one tag per scene) are in checkProgramme below.
  const connector = beat?.connector;
  if (!connector || typeof connector !== "object") {
    hard.push("no connector");
  } else {
    const kind = typeof connector.kind === "string" ? connector.kind.trim() : "";
    const from = typeof connector.from === "string" ? connector.from.trim() : "";
    const to = typeof connector.to === "string" ? connector.to.trim() : "";
    const colour = typeof connector.colour === "string" ? connector.colour.trim() : "";
    if (!kind || !from || !to || !colour) hard.push("connector missing kind/from/to/colour");
    else if (from.toLowerCase() === to.toLowerCase()) hard.push("connector's from and to are the same element");
  }
  if (beat?.tag !== null && beat?.tag !== undefined) {
    if (typeof beat.tag !== "object") {
      hard.push("tag is not an object or null");
    } else {
      const tagText = typeof beat.tag.text === "string" ? beat.tag.text.trim() : "";
      if (!tagText) hard.push("tag has no text");
      else if (words(tagText) > MAX_TAG_WORDS) hard.push(`tag text "${tagText}" is ${words(tagText)} words (limit ${MAX_TAG_WORDS})`);
      const tagSourceRaw = Array.isArray(beat.tag.source) ? beat.tag.source : [];
      const tagSource = tagSourceRaw.filter((i) => Number.isInteger(i) && i >= 0 && (sentences === null || i < sentences.length));
      if (tagSource.length === 0) {
        hard.push("tag has no valid source");
      } else if (sentences && tagText) {
        const citedForTag = tagSource.map((i) => sentences[i]).join(" ");
        if (!appearsVerbatim(tagText, citedForTag)) {
          hard.push(`tag text "${tagText}" not found verbatim in its cited sentence(s) ${JSON.stringify(tagSource)}`);
        }
      }
    }
  }

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
 * 3-in-a-row scale, every scene a run of 2-3 beats, (multi-beat programmes
 * only — a one-beat deflection is exempt by construction) the final
 * beat's ground bookending scene 1's, and (WP10) every scene's narration
 * agreeing across its beats, equalling those beats' lines concatenated,
 * and staying within maxSceneWords — plus a soft numeric-grounding
 * warning when `sentences` is available.
 */
function checkProgramme(label, beats, clipSeconds = 5, sentences = null) {
  const progFailures = [];
  const progWarnings = [];
  const heroes = beats.filter((b) => b?.hero === true).length;
  if (heroes > 1) progFailures.push(`${heroes} hero beats (limit 1)`);
  for (let i = 0; i + 2 < beats.length; i += 1) {
    const [a, b, c] = [beats[i], beats[i + 1], beats[i + 2]];
    if (a?.scale && a.scale === b?.scale && b.scale === c?.scale) {
      progFailures.push(`scale "${a.scale}" repeats for beats ${i + 1}-${i + 3}`);
    }
  }
  // WP8.1 §2/§3 and WP10 §1: scene-level, unconditional (even a one-beat
  // deflection is its own one-beat "scene"). Mirrors validateProgramme.
  const maxScene = maxSceneWords(clipSeconds);
  for (const run of sceneRuns(beats)) {
    const first = run[0];
    if (first?.connector) {
      const disagrees = run.some((b) => {
        const c = b?.connector;
        return !c || c.kind !== first.connector.kind || c.from !== first.connector.from || c.to !== first.connector.to || c.colour !== first.connector.colour;
      });
      if (disagrees) progFailures.push(`scene ${first?.scene}'s beats disagree on connector`);
      const sceneSubjects = new Set(run.flatMap((b) => (Array.isArray(b?.subjects) ? b.subjects : [])));
      if (!sceneSubjects.has(first.connector.from) || !sceneSubjects.has(first.connector.to)) {
        progFailures.push(`scene ${first?.scene}'s connector ("${first.connector.from}" -> "${first.connector.to}") is not among the scene's subjects`);
      }
    }
    const tagCount = run.filter((b) => b?.tag !== null && b?.tag !== undefined).length;
    if (tagCount > 1) progFailures.push(`scene ${first?.scene} has ${tagCount} tags (limit 1)`);

    // WP10 §1/§5.
    const firstNarration = String(first?.narration ?? "");
    const disagreesNarration = run.some((b) => String(b?.narration ?? "") !== firstNarration);
    if (disagreesNarration) progFailures.push(`scene ${first?.scene}'s beats disagree on narration`);
    const narrationWords = words(firstNarration);
    if (narrationWords > maxScene) progFailures.push(`scene ${first?.scene}'s narration is ${narrationWords} words (limit ${maxScene})`);
    const joinedLines = run.map((b) => String(b?.line ?? "")).join(" ");
    if (normaliseWs(joinedLines) !== normaliseWs(firstNarration)) {
      progFailures.push(`scene ${first?.scene}'s narration does not equal its beats' lines concatenated`);
    }
    if (sentences) {
      const citedIdx = Array.from(new Set(run.flatMap((b) => (Array.isArray(b?.source) ? b.source : [])))).sort((x, y) => x - y);
      const citedText = citedIdx.map((i) => sentences[i] ?? "").join(" ");
      const citedDigits = numbersIn(citedText);
      for (const n of spelledNumbersIn(firstNarration)) {
        if (!citedDigits.some((d) => numbersClose(d, n))) {
          progWarnings.push(
            `scene ${first?.scene}'s narration states "${n}" (spelled out) not found among its cited sentences' ` +
              `own figures ${JSON.stringify(citedIdx)} (heuristic number check; may be a false positive for a paraphrase or a non-monetary count)`
          );
        }
      }
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
  for (const w of progWarnings) {
    warnings += 1;
    console.log(`warn  ${label}: ${w}`);
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

function report(label, beat, sentences, clipSeconds = 5) {
  beats += 1;
  const { hard, soft } = checkBeat(beat, sentences, clipSeconds);
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
  const clipSeconds = manifest?.switches?.clipSeconds ?? 5;
  const files = readdirSync(dir).filter((f) => /^\d+\.json$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b));
  const beats = [];
  for (const file of files) {
    const rec = readJson(path.join(dir, file));
    if (!rec) continue;
    // WP8.1: a shot's record carries `beats` (plural — one entry at 5s/10s,
    // 2-3 at CLIP_SECONDS=15's one-scene-per-shot); a pre-WP8.1 recording
    // still has the old singular `beat`.
    const shotBeats = Array.isArray(rec.beats) ? rec.beats.map((b) => b.beat) : rec.beat ? [rec.beat] : [];
    shotBeats.forEach((beat, i) => {
      report(`${path.relative(ROOT, dir)}/${file}${shotBeats.length > 1 ? `#${i + 1}` : ""}`, beat, sentences, clipSeconds);
      beats.push(beat);
    });
  }
  checkProgramme(path.relative(ROOT, dir), beats, clipSeconds, sentences);
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
  const clipSeconds = t.clipSeconds ?? 5;
  t.beats.forEach((beat, i) => report(`${path.relative(ROOT, file)}#${i + 1}`, beat, null, clipSeconds));
  checkProgramme(path.relative(ROOT, file), t.beats, clipSeconds, null);
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
