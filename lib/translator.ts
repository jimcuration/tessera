/**
 * The Tessera translator: one CurationAI answer in, a sequence of beats out.
 *
 * This module is isomorphic (no SDK imports) so the prompt, the schema and
 * the code-enforced translator rule are shared by the server route that
 * calls Claude (app/api/translate), the client that stages the beats, and
 * the checker (scripts/check.mjs mirrors `validateBeat`/`validateProgramme`
 * in plain JS, since that script runs under plain `node`, not `tsx`, and so
 * cannot import this file directly).
 *
 * Version: translator v0.3.1, paired with Tessera Style Sheet v0.3
 * (lib/prompt.ts). v0.3 background: WP0 found a native narrator rushed an
 * exemplar line at 19-20 words, so the line budget is 12 words, hard; two
 * clips showed a face despite "never a recognisable face", so a beat whose
 * `subjects` names a person, a body part that reads as a person, or a
 * proper name is dropped in code (CLAUDE.md rule 6, decision D23); `hero`
 * marks the one beat, if any, that carries the answer's central figure;
 * `scale` varies each beat's composition; `delivery` is `line` with
 * ElevenLabs expression tags for Saskia.
 *
 * v0.3.1 (WP5, merged to main with the style sheet and `labels` reverted):
 * `scene` groups 2-3 consecutive beats sharing a `ground` and a persistent
 * primary subject; `hand` marks the beats where the recurring anonymous
 * paper hand acts; the programme bookends — the final beat's `ground` must
 * equal scene 1's, enforced by `validateProgramme`. WP5 also built
 * `events` (replacing `action`) and `labels` (data chips verbatim from the
 * cited sentence) alongside a v0.4 style sheet; those two, and the v0.4
 * style sheet, were not carried into this merge — see
 * briefs/WP5-report.md and briefs/WP5-handoff.md for what WP5 actually
 * built and measured, and CLAUDE.md's history note for why the merge
 * landed narrower than that.
 *
 * v0.3.2 (WP8.1, D33): every scene now names one `connector` (a paper
 * ribbon/arrow/string physically running from one named subject to
 * another, persisting for the scene) and may carry at most one small
 * round `tag` (a coin-sized paper tag, ≤2 words or one figure, verbatim
 * from a cited sentence). Both apply at every clip length, not just the
 * new CLIP_SECONDS=15 scene-generation mode (lib/prompt.ts,
 * lib/stream.ts) that motivated them. Because `connector` is a new
 * required field, this is a version bump: a cached/pinned translation
 * recorded under v0.3.1 has no `connector` and reads as stale, exactly
 * like every earlier translator-version bump (regenerated live, not
 * hard-failed — see app/api/translate/route.ts and scripts/check.mjs).
 * Named v0.3.2, not v0.4: an earlier, never-merged WP5 schema already
 * used the literal string "translator-v0.4" for a different, incompatible
 * shape (`events`/`labels`), and some of its cached translations are still
 * present in data/translations/ — reusing "v0.4" here would make this
 * code treat those as current and validate them against these new rules.
 *
 * WP7 (paired with style sheet v0.6, lib/prompt.ts): the action rule's old
 * clause requiring every beat to say how the previous beat's headline chip
 * leaves before the new one lands is gone. That fought image-to-video
 * chaining — WP0 found chaining inherits the previous composition, which
 * is what makes the cut seamless and is also what covers a headline
 * sometimes (WP0-report.md §7) — so WP7 drops the clause (headline
 * occlusion is accepted, not fought) in favour of a shape-match-cut
 * framing, carried into every exemplar's action text below. No schema
 * change, so this did not need its own version bump; it landed in the
 * same v0.3.2 as the connector/tag fields above.
 *
 * v0.4.0 (WP10, "one person talking"): the translator never had a writing
 * brief before this — its prompt was a schema and a set of limits, and the
 * lines came out as bitty, self-contained captions. Two changes:
 *
 *  1. Structure. For each scene the translator now writes the scene's
 *     narration as one flowing passage FIRST (2-3 beats' worth, from the
 *     cited sentences), and only then marks beat boundaries inside it.
 *     `narration` is a new field: the scene's full passage, identical on
 *     every beat of the scene (the same pattern WP8.1 used for
 *     `connector`, since the streaming protocol emits one beat object per
 *     NDJSON line and has no separate scene-level message). A beat's
 *     `line` is that passage's text between its boundaries, verbatim: the
 *     scene's beats' `line`s, joined with a single space, must reconstruct
 *     `narration` exactly (validateProgramme). This is why nothing in
 *     lib/programme.ts, app/api/translate/route.ts or app/api/voice/route.ts
 *     needed to change for WP10: app/api/voice/route.ts already rebuilds a
 *     scene's full spoken text by joining each beat's own text with the
 *     same single-space separator (its `sceneText`/`sceneTextForTTS`) to
 *     send ElevenLabs one request per scene — with `line`s that
 *     concatenate correctly, that reconstruction already *is* `narration`,
 *     word for word.
 *  2. Voice. A house-style writing brief for "Saskia" (briefs/WP10.md §2),
 *     baked into the prompt as its own VOICE section, plus three worked
 *     example passages (§3) that show the target voice with every figure
 *     traceable to a cited sentence. Two rules override the voice, always:
 *     style is free but substance is inherited (no fact/figure/claim that
 *     isn't in the cited sentences, no opinion of Saskia's own), and at
 *     most one aside per scene.
 *
 * Word budget is unchanged (`maxLineWords`); a scene's `narration` is
 * bounded at `maxLineWords(clipSeconds) * 3` (`maxSceneWords`), since a
 * scene is 2-3 beats.
 *
 * A short banned-word list (the voice brief's own "avoid" list) fails a
 * beat outright; a first-person opinion marker ("I think", "I'd",
 * "honestly I", ...) is a soft warning unless the beat's own cited
 * sentences carry no hedge of their own, in which case it is a hard
 * failure too (Saskia may not invent an opinion CurationAI didn't have).
 *
 * Because `narration` is a new required field, this is a version bump —
 * exactly like every earlier translator-version bump (regenerated live,
 * not hard-failed — see app/api/translate/route.ts and scripts/check.mjs).
 * Named v0.4.0, not the bare "v0.4": an earlier, never-merged WP5 schema
 * already used the literal string "translator-v0.4" for a different,
 * incompatible shape (`events`/`labels`), and some of its cached
 * translations are still present in data/translations/ — reusing that
 * exact string here would make this code treat those as current and
 * validate them against these new rules (see v0.3.2's note above, which
 * hit the same trap first).
 */

export const TRANSLATOR_VERSION = "translator-v0.4.0";

export type Ground = "lime" | "cyan" | "violet" | "magenta";
export const GROUNDS: Ground[] = ["lime", "cyan", "violet", "magenta"];

export type Scale = "oversized" | "small" | "diagram";
export const SCALES: Scale[] = ["oversized", "small", "diagram"];

/**
 * The only expression tags a `delivery` line may carry (WP3 §3): each is a
 * whole `[bracketed]` tag, at most one per line. Mirrored in scripts/check.mjs.
 */
export const DELIVERY_TAGS = ["presenting to camera", "excited", "fast-paced"];

/**
 * WP8.1 §2: the one paper prop (ribbon, arrow, string) that runs from one
 * named element to another within a scene, in one direction, and persists
 * once introduced. `from`/`to` must each name a subject appearing
 * somewhere among the scene's beats (validateProgramme). Every beat in a
 * scene carries the same connector (like `ground`, and like WP10's
 * `narration` below).
 */
export interface Connector {
  kind: string;
  from: string;
  to: string;
  colour: string;
}

/**
 * WP8.1 §3: at most one per scene — a small round paper tag, coin-sized,
 * printed with one figure or ≤2 words taken verbatim from a cited
 * sentence, pointing at the connector.
 */
export interface Tag {
  text: string;
  /** Sentence index(es) `text` must appear in, verbatim (case-insensitive). */
  source: number[];
}

export interface Beat {
  /** 1-based; beats sharing a scene share `ground` and a persistent primary subject. Groups of 2-3. */
  scene: number;
  /** Spoken sentence, 12 words or fewer. */
  line: string;
  /** On-screen words, 4 or fewer, or null. */
  headline: string | null;
  ground: Ground;
  /** Halftone cutout objects, 1–3. Never a person. */
  subjects: string[];
  /** One clear cause-and-effect movement: a shape-match cut, the previous handoff transforming into this beat's subjects. */
  action: string;
  /** Whether the recurring anonymous paper hand acts in this beat. */
  hand: boolean;
  /** The named shape this beat ends on, which the next beat transforms. */
  handoff: string;
  /** Whether this beat's line carries the answer's central figure. At most one per programme. */
  hero: boolean;
  /** How this beat's composition is scaled. Varies beat to beat; never three-in-a-row the same. */
  scale: Scale;
  /** `line` with at most one DELIVERY_TAGS tag in square brackets, for Saskia. Stripped of tags, equals `line` exactly. */
  delivery: string;
  /** Indexes into the answer's sentences. Never empty: no source, no render. */
  source: number[];
  /** WP8.1: the scene's one connector prop. Identical on every beat of the scene. */
  connector: Connector;
  /** WP8.1: at most one non-null per scene. */
  tag: Tag | null;
  /**
   * WP10: the scene's full flowing passage, written before its beats were
   * cut from it — identical on every beat of the scene (the `connector`
   * pattern). The scene's beats' `line`s, joined with a single space, must
   * equal this exactly (validateProgramme). ≤ `maxSceneWords(clipSeconds)`.
   */
  narration: string;
}

/** Every `[bracketed]` tag in a delivery line. */
export function deliveryTags(delivery: string): string[] {
  return [...delivery.matchAll(/\[([^\]]*)\]/g)].map((m) => m[1]);
}

/** `delivery` with every `[bracketed]` tag removed and whitespace collapsed, for comparison against `line`. */
export function stripDelivery(delivery: string): string {
  return delivery.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
}

/** Collapse whitespace for a verbatim-modulo-spacing comparison (WP10: narration vs. concatenated lines). */
function normaliseWs(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export interface BeatCheck {
  ok: boolean;
  beat: Beat | null;
  /** Why the beat was dropped (only when !ok). */
  dropped: string | null;
  /** Soft findings: kept, but flagged in the recording and by npm run check. */
  warnings: string[];
}

const MAX_HEADLINE_WORDS = 4;
const MAX_SUBJECTS = 3;
/** WP8.1 §3: a tag's text is one figure or at most this many words. */
const MAX_TAG_WORDS = 2;

/**
 * WP8/WP8.1: the spoken-line word budget scales with clip length so a beat
 * still reads as one unhurried sentence at its clip's pace — 12 words at
 * 5s (the limit WP0 measured a native narrator rushing past), 22 at 10s
 * and 15s (roughly double, for one sentence or two short ones, not a
 * list; WP8 brief §1). At 15s a beat is still a 5s section within a
 * larger scene generation (WP8.1 §1), not a longer clip in its own right,
 * but the brief keeps the word budget the same as 10s regardless.
 * Mirrored in scripts/check.mjs.
 */
export function maxLineWords(clipSeconds: 5 | 10 | 15): number {
  return clipSeconds === 5 ? 12 : 22;
}

/**
 * WP10 §1: a scene's `narration` passage is 2-3 beats' worth, so its word
 * budget is three beats at the per-beat limit — 36 at 5s, 66 at 10s/15s
 * (brief's own worked number, "word budget stays 22/beat, so a scene's
 * narration is ≤ 66 words"). Mirrored in scripts/check.mjs.
 */
export function maxSceneWords(clipSeconds: 5 | 10 | 15): number {
  return maxLineWords(clipSeconds) * 3;
}

/**
 * Terms that mean a beat's subjects depict a person rather than an object.
 * CLAUDE.md rule 6: no recognisable people in generated imagery; anonymous
 * paper hands are the one allowed human trace (they carry no identity).
 * Mirrored in scripts/check.mjs.
 */
export const PEOPLE_LEXICON = [
  "person",
  "people",
  "man",
  "men",
  "woman",
  "women",
  "face",
  "faces",
  "figure",
  "figures",
  "executive",
  "executives",
  "ceo",
  "cfo",
  "coo",
  "cto",
  "worker",
  "workers",
  "customer",
  "customers",
  "crowd",
  "character",
  "characters",
  "employee",
  "employees",
  "founder",
  "founders",
  "staff",
  "spokesperson",
  "presenter",
  "narrator",
  "analyst",
  "analysts",
  "investor",
  "investors",
  "chairman",
  "chairwoman",
  "boy",
  "girl",
];

/**
 * WP10 §2/§5: the voice brief's own "avoid" list — corporate buzzwords and
 * throat-clearing phrases. A hard fail: Saskia's line may not use these,
 * whole word or whole phrase, case-insensitive. Mirrored in scripts/check.mjs.
 */
export const BANNED_PHRASES = [
  "one might consider",
  "it is important to note",
  "in order to",
  "due to the fact that",
  "leverage",
  "leveraging",
  "unlock",
  "unlocking",
  "landscape",
  "robust",
  "ecosystem",
  "journey",
  "navigate",
  "navigating",
];

/**
 * WP10 §2/§5: markers of a first-person opinion Saskia is not allowed to
 * originate ("she has no opinions of her own; she has CurationAI's, said
 * warmly"). Soft by default; validateBeat hard-fails a beat that uses one
 * when its own cited sentences carry no hedge of their own (HEDGE_LEXICON).
 * Mirrored in scripts/check.mjs.
 */
export const OPINION_MARKERS = ["i think", "i'd", "i would", "honestly i", "i'm not sure", "maybe it's just me"];

/**
 * WP10 §5: words that mean a cited sentence itself hedges, so a beat's own
 * opinion-marker language (OPINION_MARKERS) is restating the source's own
 * uncertainty rather than inventing Saskia's. Deliberately small and
 * literal — this is a heuristic proxy for "the answer itself hedges", not
 * a semantic read of the sentence; see this file's header and
 * briefs/WP10-handoff.md for its limits. Mirrored in scripts/check.mjs.
 */
export const HEDGE_LEXICON = [
  "may",
  "might",
  "could",
  "likely",
  "unlikely",
  "roughly",
  "approximately",
  "possibly",
  "perhaps",
  "appears",
  "seems",
  "suggest",
  "suggests",
  "expect",
  "expects",
  "expected",
  "believe",
  "believes",
  "uncertain",
  "risk",
  "risks",
  "plausible",
  "unclear",
  "assum",
  "if ",
];

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Does any subject read as a person? Checked against the lexicon (whole
 * words, case-insensitive) and, separately, against the shape of a proper
 * name: two or more capitalised words (a person's name), or one capitalised
 * word that is not the first word of the subject (an object named at the
 * start of a phrase, e.g. "Diginex nameplate", reads as an object; a
 * capital appearing mid-phrase reads as someone's name).
 */
export function subjectNamesPerson(subject: string): string | null {
  const lower = subject.toLowerCase();
  for (const term of PEOPLE_LEXICON) {
    if (new RegExp(`\\b${term}\\b`).test(lower)) return `matches "${term}"`;
  }
  const words = subject.trim().split(/\s+/);
  const capWords = words.filter((w) => /^[A-Z][a-z]+$/.test(w));
  if (capWords.length >= 2) return "looks like a proper name";
  if (capWords.length === 1 && words.indexOf(capWords[0]) > 0) return "looks like a proper name";
  return null;
}

/** Digit groups in a headline, normalised for the soft number check. */
function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""));
}

const NUM_ONES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const NUM_TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const NUM_MAGNITUDE: Record<string, number> = { thousand: 1_000, million: 1_000_000, billion: 1_000_000_000 };

/**
 * WP10 §5 heuristic: pull the numeric figures a spelled-out passage states
 * (rule 6: "never digits in the line") back out as decimal strings, so
 * they can be checked against the cited sentences' own digits the same
 * way headline numbers already are (numbersIn, above). This is NOT a full
 * English-number parser or a semantic sentence-mapper — it is a narrow
 * proxy for "every sentence in narration maps to a cited sentence" (brief
 * §5), scoped to the concrete, checkable part of that claim (no invented
 * figures), documented as approximate in briefs/WP10-handoff.md. Small
 * bare counts ("two quarters", "six months") are deliberately dropped to
 * avoid noise: only decimals, or numbers with a "hundred"/magnitude word,
 * are reported. Mirrored in scripts/check.mjs.
 */
export function spelledNumbersIn(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[.,;:!?()"'‘’“”…]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    if (!(words[i] in NUM_ONES) && !(words[i] in NUM_TENS)) {
      i += 1;
      continue;
    }
    let value = 0;
    let matchedAny = false;
    let hadMagnitude = false;
    let usedTens = false;
    let usedOnes = false;
    while (i < words.length) {
      const w = words[i];
      if (w === "and" && matchedAny) {
        i += 1;
        continue;
      }
      // A year spoken in two chunks ("twenty twenty-six") is two tens/ones
      // groups back to back, not one number to sum — a second tens word (or
      // a second ones word after a tens word already closed a group) starts
      // a new number instead of merging into this one.
      if (w in NUM_TENS && usedTens) break;
      if (w in NUM_ONES && usedOnes && NUM_ONES[w] < 10) break;
      if (w in NUM_ONES) {
        value += NUM_ONES[w];
        matchedAny = true;
        usedOnes = true;
        i += 1;
      } else if (w in NUM_TENS) {
        value += NUM_TENS[w];
        matchedAny = true;
        usedTens = true;
        i += 1;
      } else if (w === "hundred" && matchedAny) {
        value *= 100;
        hadMagnitude = true;
        // The hundreds digit is now fixed; a ones/tens word next fills in
        // the remainder ("two hundred and ninety-three"), not a repeat of
        // the hundreds group, so the back-to-back guards above reset.
        usedOnes = false;
        usedTens = false;
        i += 1;
      } else if (w in NUM_MAGNITUDE && matchedAny) {
        value *= NUM_MAGNITUDE[w];
        hadMagnitude = true;
        i += 1;
        break; // WP10's figures don't chain magnitudes ("million thousand")
      } else {
        break;
      }
    }
    if (!matchedAny) {
      i += 1;
      continue;
    }
    let decimalStr = "";
    if (words[i] === "point") {
      let j = i + 1;
      const digits: string[] = [];
      while (j < words.length && words[j] in NUM_ONES && NUM_ONES[words[j]] <= 9) {
        digits.push(String(NUM_ONES[words[j]]));
        j += 1;
      }
      if (digits.length) {
        decimalStr = `.${digits.join("")}`;
        i = j;
      }
    }
    if (value >= 10 || decimalStr || hadMagnitude) {
      out.push(`${value}${decimalStr}`);
    }
  }
  return out;
}

/** Loose numeric match: same value, or within 1% — spelled-out figures round-trip exactly, but leave a little room. */
function numbersClose(a: string, b: string): boolean {
  const fa = Number.parseFloat(a);
  const fb = Number.parseFloat(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) return a === b;
  if (fa === fb) return true;
  return Math.abs(fa - fb) <= Math.max(0.01, Math.abs(fb) * 0.01);
}

/**
 * The translator rule, in code. Hard: a beat without a valid `source`, a
 * line over 12 words, or a subject that names a person is dropped. Soft:
 * headline length and headline numbers not found in the cited sentences
 * are recorded as warnings so the report can show them (a warning also
 * covers the one allowed derivation: a headline count of items the cited
 * sentence enumerates rather than states as a figure); they never silently
 * rewrite the text.
 */
/** Case-insensitive, whitespace-collapsed substring check ("verbatim" per WP8.1 §3). */
function appearsVerbatim(needle: string, haystack: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return norm(haystack).includes(norm(needle));
}

export function validateBeat(raw: unknown, sentences: string[], clipSeconds: 5 | 10 | 15 = 5): BeatCheck {
  const warnings: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, beat: null, dropped: "not an object", warnings };
  }
  const b = raw as Record<string, unknown>;

  const scene = typeof b.scene === "number" && Number.isInteger(b.scene) && b.scene > 0 ? b.scene : null;
  if (scene === null) return { ok: false, beat: null, dropped: "no scene (positive integer)", warnings };

  const line = typeof b.line === "string" ? b.line.trim() : "";
  if (!line) return { ok: false, beat: null, dropped: "no line", warnings };
  const lineWords = wordCount(line);
  const maxWords = maxLineWords(clipSeconds);
  if (lineWords > maxWords) {
    return { ok: false, beat: null, dropped: `line is ${lineWords} words (limit ${maxWords})`, warnings };
  }

  const sourceRaw = Array.isArray(b.source) ? b.source : [];
  const source = Array.from(
    new Set(
      sourceRaw
        .map((s) => (typeof s === "number" ? s : Number.parseInt(String(s), 10)))
        .filter((s) => Number.isInteger(s) && s >= 0 && s < sentences.length)
    )
  ).sort((x, y) => x - y);
  if (source.length === 0) {
    return { ok: false, beat: null, dropped: "no source", warnings };
  }

  // WP10 §5: the voice brief's own avoid-list, hard-fail (a corporate
  // buzzword/cliché is never in Saskia's voice, whatever the source says).
  const lineLower = line.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lineLower)) {
      return { ok: false, beat: null, dropped: `line uses a banned phrase "${phrase}"`, warnings };
    }
  }

  // WP10 §2/§5: a first-person opinion marker is fine only when the beat's
  // own cited sentence(s) already hedge — otherwise Saskia would be
  // originating an opinion CurationAI never had, which the voice brief
  // rules out unconditionally.
  const citedForBeat = source.map((i) => sentences[i] ?? "").join(" ").toLowerCase();
  const hasHedge = HEDGE_LEXICON.some((h) => citedForBeat.includes(h));
  const opinionHit = OPINION_MARKERS.find((m) => lineLower.includes(m));
  if (opinionHit) {
    if (!hasHedge) {
      return {
        ok: false,
        beat: null,
        dropped: `line uses a first-person opinion marker "${opinionHit}" but its cited sentence(s) ${JSON.stringify(source)} do not hedge`,
        warnings,
      };
    }
    warnings.push(`line uses a first-person opinion marker "${opinionHit}" (cited sentence hedges, so kept)`);
  }

  const headline =
    typeof b.headline === "string" && b.headline.trim() ? b.headline.trim() : null;
  let ground: Ground = "violet";
  if (typeof b.ground === "string" && (GROUNDS as string[]).includes(b.ground)) {
    ground = b.ground as Ground;
  } else {
    warnings.push(`ground "${String(b.ground)}" not in palette; using violet`);
  }
  let subjects = Array.isArray(b.subjects)
    ? b.subjects.filter((s): s is string => typeof s === "string" && s.trim() !== "")
    : [];
  if (subjects.length === 0) {
    return { ok: false, beat: null, dropped: "no subjects", warnings };
  }
  for (const subject of subjects) {
    const person = subjectNamesPerson(subject);
    if (person) {
      return { ok: false, beat: null, dropped: `subject "${subject}" names a person (${person})`, warnings };
    }
  }
  if (subjects.length > MAX_SUBJECTS) {
    warnings.push(`${subjects.length} subjects; keeping the first ${MAX_SUBJECTS}`);
    subjects = subjects.slice(0, MAX_SUBJECTS);
  }
  const action = typeof b.action === "string" ? b.action.trim() : "";
  if (!action) return { ok: false, beat: null, dropped: "no action", warnings };
  const handoff = typeof b.handoff === "string" ? b.handoff.trim() : "";
  if (!handoff) return { ok: false, beat: null, dropped: "no handoff", warnings };

  const hand = b.hand === true;

  if (headline && wordCount(headline) > MAX_HEADLINE_WORDS) {
    warnings.push(`headline is ${wordCount(headline)} words (limit ${MAX_HEADLINE_WORDS})`);
  }
  if (headline) {
    const cited = source.map((i) => sentences[i]).join(" ").replace(/,/g, "");
    for (const n of numbersIn(headline)) {
      if (!cited.includes(n)) {
        warnings.push(
          `headline number "${n}" not found as a figure in cited sentences ${JSON.stringify(source)} ` +
            `(fine if it is a count of items those sentences enumerate; flagged either way)`
        );
      }
    }
  }

  const hero = b.hero === true;

  let scale: Scale = "small";
  if (typeof b.scale === "string" && (SCALES as string[]).includes(b.scale)) {
    scale = b.scale as Scale;
  } else {
    warnings.push(`scale "${String(b.scale)}" not one of ${SCALES.join("/")}; using small`);
  }

  const delivery = typeof b.delivery === "string" && b.delivery.trim() ? b.delivery.trim() : line;
  const tags = deliveryTags(delivery);
  for (const tag of tags) {
    if (!DELIVERY_TAGS.includes(tag)) {
      return { ok: false, beat: null, dropped: `delivery tag "[${tag}]" not in the whitelist`, warnings };
    }
  }
  if (tags.length > 1) {
    return { ok: false, beat: null, dropped: `delivery carries ${tags.length} tags (limit 1)`, warnings };
  }
  if (stripDelivery(delivery) !== line) {
    return { ok: false, beat: null, dropped: `delivery, stripped of tags, does not match line`, warnings };
  }

  // WP8.1 §2: every beat carries the scene's one connector — structural
  // validity only here (well-formed, from !== to); whether from/to are
  // actually among the scene's subjects, and whether every beat in the
  // scene agrees, needs the whole scene and is checked in validateProgramme.
  const connectorRaw = b.connector;
  if (!connectorRaw || typeof connectorRaw !== "object") {
    return { ok: false, beat: null, dropped: "no connector", warnings };
  }
  const c = connectorRaw as Record<string, unknown>;
  const connectorKind = typeof c.kind === "string" ? c.kind.trim() : "";
  const connectorFrom = typeof c.from === "string" ? c.from.trim() : "";
  const connectorTo = typeof c.to === "string" ? c.to.trim() : "";
  const connectorColour = typeof c.colour === "string" ? c.colour.trim() : "";
  if (!connectorKind || !connectorFrom || !connectorTo || !connectorColour) {
    return { ok: false, beat: null, dropped: "connector missing kind/from/to/colour", warnings };
  }
  if (connectorFrom.toLowerCase() === connectorTo.toLowerCase()) {
    return { ok: false, beat: null, dropped: "connector's from and to are the same element", warnings };
  }
  const connector: Connector = { kind: connectorKind, from: connectorFrom, to: connectorTo, colour: connectorColour };

  // WP8.1 §3: at most one per scene (checked in validateProgramme); here,
  // structural validity and the verbatim-in-cited-sentence check.
  let sceneTag: Tag | null = null;
  if (b.tag !== null && b.tag !== undefined) {
    if (typeof b.tag !== "object") {
      return { ok: false, beat: null, dropped: "tag is not an object or null", warnings };
    }
    const t = b.tag as Record<string, unknown>;
    const tagText = typeof t.text === "string" ? t.text.trim() : "";
    if (!tagText) return { ok: false, beat: null, dropped: "tag has no text", warnings };
    if (wordCount(tagText) > MAX_TAG_WORDS) {
      return { ok: false, beat: null, dropped: `tag text "${tagText}" is ${wordCount(tagText)} words (limit ${MAX_TAG_WORDS})`, warnings };
    }
    const tagSourceRaw = Array.isArray(t.source) ? t.source : [];
    const tagSource = Array.from(
      new Set(
        tagSourceRaw
          .map((s) => (typeof s === "number" ? s : Number.parseInt(String(s), 10)))
          .filter((s) => Number.isInteger(s) && s >= 0 && s < sentences.length)
      )
    ).sort((x, y) => x - y);
    if (tagSource.length === 0) {
      return { ok: false, beat: null, dropped: "tag has no valid source", warnings };
    }
    const citedForTag = tagSource.map((i) => sentences[i]).join(" ");
    if (!appearsVerbatim(tagText, citedForTag)) {
      return {
        ok: false,
        beat: null,
        dropped: `tag text "${tagText}" not found verbatim in its cited sentence(s) ${JSON.stringify(tagSource)}`,
        warnings,
      };
    }
    sceneTag = { text: tagText, source: tagSource };
  }

  // WP10 §1: the scene's flowing passage. Structural check only here (non-
  // empty); whether it's identical across the scene's beats, whether it
  // equals those beats' lines concatenated, and its own word budget all
  // need the whole scene and are checked in validateProgramme.
  const narration = typeof b.narration === "string" ? b.narration.trim() : "";
  if (!narration) return { ok: false, beat: null, dropped: "no narration", warnings };

  return {
    ok: true,
    beat: { scene, line, headline, ground, subjects, action, hand, handoff, hero, scale, delivery, source, connector, tag: sceneTag, narration },
    dropped: null,
    warnings,
  };
}

/**
 * Runs of consecutive beats sharing a `scene` number, in order. Does not
 * itself require the numbers to be sequential or gapless — that would be
 * one more way for a malformed programme to fail two different checks for
 * the same underlying reason; `validateProgramme` below checks length only.
 */
function sceneRuns(beats: Beat[]): Beat[][] {
  const runs: Beat[][] = [];
  for (const beat of beats) {
    const last = runs[runs.length - 1];
    if (last && last[0].scene === beat.scene) last.push(beat);
    else runs.push([beat]);
  }
  return runs;
}

export interface ProgrammeCheck {
  /** Hard failures: mirrors the pre-WP10 return shape's meaning (a non-empty array meant a bad programme). */
  failures: string[];
  /** Soft findings (WP10: the numeric-grounding heuristic below). */
  warnings: string[];
}

/**
 * Programme-level checks `validateBeat` cannot make on one beat alone: at
 * most one `hero` beat; no `scale` value held for three beats running
 * (WP3 §3); every `scene` a run of 2-3 consecutive beats; the final beat's
 * `ground` matching scene 1's, the bookend (only the ground is checkable
 * in code — the primary subject and handoff match are enforced by the
 * prompt, not the checker); the WP8.1 connector/tag scene-consistency
 * rules; and (WP10) every scene's `narration` agreeing across its beats,
 * equalling those beats' `line`s concatenated, and staying within
 * `maxSceneWords`. `sentences`, when supplied, additionally powers a soft
 * numeric-grounding warning (spelledNumbersIn vs. the scene's own cited
 * sentences) — omitted where the caller has no sentences to check against
 * (a cached translation file; see scripts/check.mjs). Mirrored in
 * scripts/check.mjs for `npm run check`.
 */
export function validateProgramme(beats: Beat[], clipSeconds: 5 | 10 | 15 = 5, sentences?: string[]): ProgrammeCheck {
  const failures: string[] = [];
  const warnings: string[] = [];
  const heroes = beats.filter((b) => b.hero).length;
  if (heroes > 1) failures.push(`${heroes} hero beats (limit 1)`);
  for (let i = 0; i + 2 < beats.length; i += 1) {
    const [a, b, c] = [beats[i], beats[i + 1], beats[i + 2]];
    if (a.scale === b.scale && b.scale === c.scale) {
      failures.push(`scale "${a.scale}" repeats for beats ${i + 1}-${i + 3}`);
    }
  }
  // WP8.1 §2/§3 and WP10 §1: connector/tag/narration are scene-level even
  // though every beat carries its own copy — checked here, per scene,
  // unconditionally (unlike the scene-run/bookend checks below, this
  // applies even to a one-beat deflection: it still has one "scene" of one
  // beat).
  const maxScene = maxSceneWords(clipSeconds);
  for (const run of sceneRuns(beats)) {
    const first = run[0];
    const disagrees = run.some(
      (b) =>
        b.connector.kind !== first.connector.kind ||
        b.connector.from !== first.connector.from ||
        b.connector.to !== first.connector.to ||
        b.connector.colour !== first.connector.colour
    );
    if (disagrees) failures.push(`scene ${first.scene}'s beats disagree on connector`);
    const sceneSubjects = new Set(run.flatMap((b) => b.subjects));
    if (!sceneSubjects.has(first.connector.from) || !sceneSubjects.has(first.connector.to)) {
      failures.push(
        `scene ${first.scene}'s connector ("${first.connector.from}" → "${first.connector.to}") is not among the scene's subjects`
      );
    }
    const tagCount = run.filter((b) => b.tag !== null).length;
    if (tagCount > 1) failures.push(`scene ${first.scene} has ${tagCount} tags (limit 1)`);

    // WP10 §1/§5.
    const disagreesNarration = run.some((b) => b.narration !== first.narration);
    if (disagreesNarration) failures.push(`scene ${first.scene}'s beats disagree on narration`);
    const narrationWords = wordCount(first.narration);
    if (narrationWords > maxScene) {
      failures.push(`scene ${first.scene}'s narration is ${narrationWords} words (limit ${maxScene})`);
    }
    const joinedLines = run.map((b) => b.line).join(" ");
    if (normaliseWs(joinedLines) !== normaliseWs(first.narration)) {
      failures.push(`scene ${first.scene}'s narration does not equal its beats' lines concatenated`);
    }
    if (sentences) {
      const citedIdx = Array.from(new Set(run.flatMap((b) => b.source))).sort((x, y) => x - y);
      const citedText = citedIdx.map((i) => sentences[i] ?? "").join(" ");
      for (const n of spelledNumbersIn(first.narration)) {
        if (!numbersIn(citedText).some((d) => numbersClose(d, n))) {
          warnings.push(
            `scene ${first.scene}'s narration states "${n}" (spelled out) not found among its cited sentences' ` +
              `own figures ${JSON.stringify(citedIdx)} (heuristic number check; may be a false positive for a paraphrase or a non-monetary count)`
          );
        }
      }
    }
  }
  // Scene grouping and the bookend only apply to a real, multi-beat
  // programme: a one-beat deflection (lib/translator.ts#deflectionBeat) is
  // never a scene of 2-3 or its own bookend, by construction, not by fault.
  if (beats.length > 1) {
    for (const run of sceneRuns(beats)) {
      if (run.length < 2 || run.length > 3) {
        failures.push(`scene ${run[0].scene} has ${run.length} beat(s) (expected 2-3)`);
      }
    }
    if (beats[0].ground !== beats[beats.length - 1].ground) {
      failures.push(
        `final beat's ground "${beats[beats.length - 1].ground}" does not bookend scene 1's ground "${beats[0].ground}"`
      );
    }
  }
  return { failures, warnings };
}

/** Render the sentences the way the prompt and the recorder show them. */
export function numberSentences(sentences: string[]): string {
  return sentences.map((s, i) => `[${i}] ${s}`).join("\n");
}

/**
 * A deflection record ("this is covered in the showcase: <link>") renders
 * as a single beat with the link as the headline. Built in code: no model
 * call, no invention. Source is the sentence that carries the link.
 */
export function deflectionBeat(sentences: string[], link: string, clipSeconds: 5 | 10 | 15 = 5): Beat {
  const linkIndex = Math.max(
    0,
    sentences.findIndex((s) => s.includes(link))
  );
  const first = sentences[linkIndex] ?? sentences[0] ?? "";
  // The spoken line is the sentence minus the URL, trimmed to the limit.
  const spoken = first
    .replace(link, "")
    .replace(/[:\s—-]+$/, "")
    .trim();
  const words = spoken.split(/\s+/).filter(Boolean);
  const maxWords = maxLineWords(clipSeconds);
  const line = (words.length > maxWords ? words.slice(0, maxWords).join(" ") : spoken) ||
    "This is covered in the Curation showcase.";
  return {
    scene: 1,
    line,
    headline: link.replace(/^https?:\/\//, ""),
    ground: "cyan",
    subjects: ["a paper screen", "a paper hand"],
    action:
      "A cream paper screen slides in and lands centre; a paper hand enters from the right and taps the screen, which holds the printed link.",
    hand: true,
    handoff: "the paper screen",
    hero: false,
    scale: "small",
    delivery: line,
    source: [linkIndex],
    // WP8.1: a plausible connector between this beat's own two subjects,
    // since `connector` is required on every Beat regardless of programme
    // length; this one-beat "scene" is exempt from every other scene rule
    // (validateProgramme) but not from having a well-formed connector.
    connector: { kind: "string", from: "a paper screen", to: "a paper hand", colour: "black" },
    tag: null,
    // WP10: a one-beat "scene" is its own whole passage, same reasoning as connector above.
    narration: line,
  };
}

/**
 * WP10 exemplar, 5s-clip form (12-word-per-line budget: maxLineWords(5)).
 * Hand-mapped to the same captured answer to "What is the cash position
 * and runway?" as the pre-WP10 exemplar (data/translations/<hash>.json,
 * pinned — see that file's own note for exactly which hash). Three scenes
 * of three beats each (a scene's 22-word budget at 10s/15s does not fit
 * this brief's own worked example passages — see EXEMPLAR_NDJSON_WIDE's
 * doc comment — so at 5s the same facts and voice are cut tighter still,
 * three shorter beats a scene instead of two, to fit 12 words each).
 * Bookends on violet, like the pre-WP10 exemplar (see EXEMPLAR_NDJSON_WIDE's
 * doc comment for why scene 3 is violet here rather than the brief's
 * illustrative "lime"). WP7 (merged after this exemplar was written):
 * every non-opening beat's `action` opens straight on the shape-match
 * transformation rather than first stating how the previous headline chip
 * leaves — the action rule's dropped clause, this file's header comment.
 */
export const EXEMPLAR_NDJSON_5S = [
  `{"scene":1,"line":"Here's the number that matters.","headline":null,"ground":"violet","subjects":["a stack of paper coins","a cream paper chip"],"action":"A single halftone stack of paper coins drops onto a cream chip and settles.","hand":false,"handoff":"the coin stack","hero":false,"scale":"oversized","delivery":"[presenting to camera] Here's the number that matters.","source":[9],"connector":{"kind":"paper ribbon","from":"the coin stack","to":"a torn-paper arrow","colour":"black"},"tag":null,"narration":"Here's the number that matters. By September's end, Diginex held one point eight five million in cash. Six months before, it was three point one one — a transition."}`,
  `{"scene":1,"line":"By September's end, Diginex held one point eight five million in cash.","headline":"$1.85M","ground":"violet","subjects":["the coin stack","a cream paper chip"],"action":"Fresh coins settle onto the chip, one by one, until the stack holds its full height.","hand":false,"handoff":"the coin stack","hero":false,"scale":"small","delivery":"By September's end, Diginex held one point eight five million in cash.","source":[9],"connector":{"kind":"paper ribbon","from":"the coin stack","to":"a torn-paper arrow","colour":"black"},"tag":null,"narration":"Here's the number that matters. By September's end, Diginex held one point eight five million in cash. Six months before, it was three point one one — a transition."}`,
  `{"scene":1,"line":"Six months before, it was three point one one — a transition.","headline":"$3.11M → $1.85M","ground":"violet","subjects":["the coin stack","a torn-paper arrow"],"action":"The coin stack shrinks coin by coin; a torn-paper arrow enters and points down at it.","hand":false,"handoff":"the arrow","hero":false,"scale":"diagram","delivery":"Six months before, it was three point one one — a transition.","source":[9,10],"connector":{"kind":"paper ribbon","from":"the coin stack","to":"a torn-paper arrow","colour":"black"},"tag":null,"narration":"Here's the number that matters. By September's end, Diginex held one point eight five million in cash. Six months before, it was three point one one — a transition."}`,
  `{"scene":2,"line":"And the burn is about one point three million a month.","headline":"$1.3M / MONTH","ground":"magenta","subjects":["a paper calendar strip","paper coins"],"action":"The arrow unrolls into a paper calendar strip; coins slide off it month by month.","hand":false,"handoff":"the strip","hero":false,"scale":"oversized","delivery":"And the burn is about one point three million a month.","source":[22],"connector":{"kind":"paper string","from":"a paper calendar strip","to":"a paper runway","colour":"orange"},"tag":{"text":"$1.3M","source":[22]},"narration":"And the burn is about one point three million a month. Which means the cash on hand covers roughly one point four months. That's not long."}`,
  `{"scene":2,"line":"Which means the cash on hand covers roughly one point four months.","headline":"1.4 MONTHS","ground":"magenta","subjects":["a paper runway","a cutout aircraft"],"action":"The strip becomes a runway torn short; a cutout aircraft rolls to the torn end and stops.","hand":false,"handoff":"the runway","hero":true,"scale":"small","delivery":"[excited] Which means the cash on hand covers roughly one point four months.","source":[23],"connector":{"kind":"paper string","from":"a paper calendar strip","to":"a paper runway","colour":"orange"},"tag":null,"narration":"And the burn is about one point three million a month. Which means the cash on hand covers roughly one point four months. That's not long."}`,
  `{"scene":2,"line":"That's not long.","headline":null,"ground":"magenta","subjects":["the runway","the cutout aircraft"],"action":"The runway's torn edge curls up very slightly in the light, holding on the aircraft stopped at the end.","hand":false,"handoff":"the runway","hero":false,"scale":"diagram","delivery":"That's not long.","source":[23],"connector":{"kind":"paper string","from":"a paper calendar strip","to":"a paper runway","colour":"orange"},"tag":null,"narration":"And the burn is about one point three million a month. Which means the cash on hand covers roughly one point four months. That's not long."}`,
  `{"scene":3,"line":"Here's what kept them going: capital markets.","headline":null,"ground":"violet","subjects":["the coin stack","fresh paper coins"],"action":"The ground returns to violet and the coin stack reappears; fresh paper coins hover above it.","hand":false,"handoff":"the coin stack","hero":false,"scale":"oversized","delivery":"Here's what kept them going: capital markets.","source":[25],"connector":{"kind":"paper ribbon","from":"the coin stack","to":"two paper calendar pages","colour":"cream"},"tag":null,"narration":"Here's what kept them going: capital markets. October's warrant exercise added thirteen point eight million. The next two quarters will tell the story."}`,
  `{"scene":3,"line":"October's warrant exercise added thirteen point eight million.","headline":"+$13.8M","ground":"violet","subjects":["the coin stack","fresh paper coins","tape pieces"],"action":"Fresh paper coins are taped onto the stack one after another until it grows visibly taller.","hand":false,"handoff":"the coin stack","hero":false,"scale":"small","delivery":"October's warrant exercise added thirteen point eight million.","source":[27],"connector":{"kind":"paper ribbon","from":"the coin stack","to":"two paper calendar pages","colour":"cream"},"tag":null,"narration":"Here's what kept them going: capital markets. October's warrant exercise added thirteen point eight million. The next two quarters will tell the story."}`,
  `{"scene":3,"line":"The next two quarters will tell the story.","headline":"NEXT 2 QUARTERS","ground":"violet","subjects":["the coin stack","two paper calendar pages","a paper hand"],"action":"Two paper calendar pages land beside the coin stack; a paper hand enters and points at the second.","hand":true,"handoff":"the coin stack","hero":false,"scale":"diagram","delivery":"The next two quarters will tell the story.","source":[42,43],"connector":{"kind":"paper ribbon","from":"the coin stack","to":"two paper calendar pages","colour":"cream"},"tag":null,"narration":"Here's what kept them going: capital markets. October's warrant exercise added thirteen point eight million. The next two quarters will tell the story."}`,
].join("\n");

/**
 * WP10 exemplar, 10s/15s-clip form (22-word-per-line budget:
 * maxLineWords(10|15)), built directly from briefs/WP10.md §3's three
 * worked passages — the actual sentences quoted there, split at word-count-
 * driven beat boundaries. Two deviations from that brief text, both
 * necessary to keep this exemplar passing validateProgramme (acceptance
 * criterion 3 requires the rewritten exemplars pass `npm run check`), both
 * called out in briefs/WP10-handoff.md:
 *
 *  - The brief's scene 3 passage is 47 words; two beats at the 22-word cap
 *    hold at most 44. It is cut into three beats here (5, 6, 7), not the
 *    brief's illustrative "beats 5–6" two-beat count — the programme is 7
 *    beats total, still within rule 4's 6-10.
 *  - The brief's scene 3 is "lime"; validateProgramme's bookend rule
 *    requires the final beat's ground to equal scene 1's ("violet"). Scene
 *    3 is violet here, matching the pre-WP10 pinned exemplar's own choice
 *    for the same reason (see that exemplar's v0.3.1 history note, now
 *    superseded by this one).
 *
 * Every figure and claim below still traces to the same cited sentences as
 * the brief's own passages (briefs/WP10.md §3's closing paragraph). WP7
 * (merged after this exemplar was written): every non-opening beat's
 * `action` opens straight on the shape-match transformation rather than
 * first stating how the previous headline chip leaves.
 */
export const EXEMPLAR_NDJSON_WIDE = [
  `{"scene":1,"line":"So here's the number that matters. At the end of September, Diginex had one point eight five million in the bank.","headline":"$1.85M","ground":"violet","subjects":["a stack of paper coins","a cream paper chip"],"action":"A single halftone stack of paper coins drops onto a cream chip and settles.","hand":false,"handoff":"the coin stack","hero":false,"scale":"oversized","delivery":"[presenting to camera] So here's the number that matters. At the end of September, Diginex had one point eight five million in the bank.","source":[9],"connector":{"kind":"paper ribbon","from":"the coin stack","to":"a torn-paper arrow","colour":"black"},"tag":null,"narration":"So here's the number that matters. At the end of September, Diginex had one point eight five million in the bank. Six months before that? Three point one one. That's a company spending its way through a transition."}`,
  `{"scene":1,"line":"Six months before that? Three point one one. That's a company spending its way through a transition.","headline":"$3.11M → $1.85M","ground":"violet","subjects":["the coin stack","a torn-paper arrow"],"action":"The coin stack shrinks coin by coin; a torn-paper arrow enters and points down at it.","hand":false,"handoff":"the arrow","hero":false,"scale":"small","delivery":"[fast-paced] Six months before that? Three point one one. That's a company spending its way through a transition.","source":[9,10],"connector":{"kind":"paper ribbon","from":"the coin stack","to":"a torn-paper arrow","colour":"black"},"tag":null,"narration":"So here's the number that matters. At the end of September, Diginex had one point eight five million in the bank. Six months before that? Three point one one. That's a company spending its way through a transition."}`,
  `{"scene":2,"line":"And the burn is about one point three million a month.","headline":"$1.3M / MONTH","ground":"magenta","subjects":["a paper calendar strip","paper coins"],"action":"The arrow unrolls into a paper calendar strip; coins slide off it month by month.","hand":false,"handoff":"the strip","hero":false,"scale":"diagram","delivery":"And the burn is about one point three million a month.","source":[22],"connector":{"kind":"paper string","from":"a paper calendar strip","to":"a paper runway","colour":"orange"},"tag":{"text":"$1.3M","source":[22]},"narration":"And the burn is about one point three million a month. Which means the cash on hand covers roughly one point four months. That's… not long."}`,
  `{"scene":2,"line":"Which means the cash on hand covers roughly one point four months. That's… not long.","headline":"1.4 MONTHS","ground":"magenta","subjects":["a paper runway","a cutout aircraft"],"action":"The strip becomes a runway torn short; a cutout aircraft rolls to the torn end and stops.","hand":false,"handoff":"the runway","hero":true,"scale":"oversized","delivery":"[excited] Which means the cash on hand covers roughly one point four months. That's… not long.","source":[23],"connector":{"kind":"paper string","from":"a paper calendar strip","to":"a paper runway","colour":"orange"},"tag":null,"narration":"And the burn is about one point three million a month. Which means the cash on hand covers roughly one point four months. That's… not long."}`,
  `{"scene":3,"line":"But here's what kept them going: an eleven point four million warrant exercise, and then thirteen point eight million more in October.","headline":"+$11.4M, +$13.8M","ground":"violet","subjects":["the coin stack","fresh paper coins","tape pieces"],"action":"The ground returns to violet and the coin stack reappears; fresh paper coins are taped onto it in two batches, one after another.","hand":false,"handoff":"the coin stack","hero":false,"scale":"small","delivery":"But here's what kept them going: an eleven point four million warrant exercise, and then thirteen point eight million more in October.","source":[20,27],"connector":{"kind":"paper ribbon","from":"the coin stack","to":"two paper calendar pages","colour":"cream"},"tag":null,"narration":"But here's what kept them going: an eleven point four million warrant exercise, and then thirteen point eight million more in October. Diginex lives on the capital markets right now. The next two quarters tell you whether the revenue can start closing that gap on its own."}`,
  `{"scene":3,"line":"Diginex lives on the capital markets right now.","headline":"CAPITAL MARKETS","ground":"violet","subjects":["the coin stack","two paper calendar pages"],"action":"Two paper calendar pages land beside the coin stack; a cream ribbon settles between them.","hand":false,"handoff":"the coin stack","hero":false,"scale":"diagram","delivery":"Diginex lives on the capital markets right now.","source":[25],"connector":{"kind":"paper ribbon","from":"the coin stack","to":"two paper calendar pages","colour":"cream"},"tag":null,"narration":"But here's what kept them going: an eleven point four million warrant exercise, and then thirteen point eight million more in October. Diginex lives on the capital markets right now. The next two quarters tell you whether the revenue can start closing that gap on its own."}`,
  `{"scene":3,"line":"The next two quarters tell you whether the revenue can start closing that gap on its own.","headline":"NEXT 2 QUARTERS","ground":"violet","subjects":["the coin stack","two paper calendar pages","a paper hand"],"action":"Two paper calendar pages settle beside the coin stack; a paper hand enters and points at the second.","hand":true,"handoff":"the coin stack","hero":false,"scale":"small","delivery":"The next two quarters tell you whether the revenue can start closing that gap on its own.","source":[42,43],"connector":{"kind":"paper ribbon","from":"the coin stack","to":"two paper calendar pages","colour":"cream"},"tag":null,"narration":"But here's what kept them going: an eleven point four million warrant exercise, and then thirteen point eight million more in October. Diginex lives on the capital markets right now. The next two quarters tell you whether the revenue can start closing that gap on its own."}`,
].join("\n");

/** Pre-WP10 name, kept so nothing importing the old constant breaks; now an alias for the wide (10s/15s) exemplar. */
export const EXEMPLAR_NDJSON = EXEMPLAR_NDJSON_WIDE;

/**
 * WP10 §2: the voice brief, verbatim from briefs/WP10.md §2 (acceptance
 * criterion 2). Markdown emphasis kept as-is; it is prose guidance for the
 * model, not part of the JSON schema.
 */
const VOICE_SECTION = `VOICE

You are writing for Saskia, a Curation presenter, talking to one person sitting across from her. Not broadcasting.

**Sound like a person.** Use contractions. Vary the rhythm: a short punchy sentence, then a longer one that breathes. Start a sentence with "And" or "But" when it's right. Use a fragment for emphasis. Let a thought trail with an ellipsis when that's how it moves. Say "you" and "we."

**Keep it simple and concrete.** Explain it like you would to a friend over coffee. Relatable images over jargon. Not "achieve operating leverage" but "the costs stop growing as fast as the money coming in." Every figure exact and complete.

**Open with recognition, deliver as discovery.** Start where the listener already is — the thing they'd notice, the number that matters — then reveal what it means. Insight sounds discovered, not declared. Prefer "here's the number that matters" to "it is important to note."

**Clarity over cleverness.** Every word moves the listener forward. No paired-phrase constructions for their own sake ("not this, but that"), no rhetorical yes-and-no, no over-confident illustration. If a line sounds pleased with itself, cut it.

**Avoid:** corporate buzzwords; "one might consider" (say "you might"); "it is important to note" (just note it); "in order to" (to); "due to the fact that" (because); "leverage," "unlock," "landscape," "robust," "ecosystem," "journey," "navigate."

**Two rules that override the style, always:**

- **Style is free; substance is inherited.** Every fact, figure, claim and characterisation comes from the cited sentences. Saskia can say "that's not long" when the answer says "dangerously thin." She cannot say "honestly, I'd be nervous," ever. She has no opinions of her own; she has CurationAI's, said warmly. No "I think," "I'm not sure," or "maybe it's just me" unless the answer itself hedges.
- **One aside per scene, at most, and it has to do work.** A beat of recognition, a "which is…" — then back to the answer. No tangents; every line has a source pointer and a clock.`;

/**
 * WP10 §3: the worked example passages, verbatim from briefs/WP10.md §3
 * (acceptance criterion 2) — illustrative prose showing the target voice,
 * independent of clip length (unlike EXEMPLAR_NDJSON_5S/_WIDE below, which
 * must additionally satisfy the per-clip-length word budget exactly).
 */
const EXAMPLE_PASSAGES_SECTION = `EXAMPLE PASSAGES (the voice above, worked — illustrative; the beat count per scene here is for the 22-word/beat budget, so cut a passage this long into three beats instead of two wherever two would exceed it)

Scene 1 (violet), beats 1–2:
> So here's the number that matters. At the end of September, Diginex had one point eight five million in the bank. Six months before that? Three point one one. That's a company spending its way through a transition.

Scene 2 (magenta), beats 3–4:
> And the burn is about one point three million a month. Which means the cash on hand covers roughly one point four months. That's… not long.

Scene 3 (lime), beats 5–6:
> But here's what kept them going: an eleven point four million warrant exercise, and then thirteen point eight million more in October. Diginex lives on the capital markets right now. The next two quarters tell you whether the revenue can start closing that gap on its own.

Every figure is in the cited sentences; "not long" maps to "dangerously thin"; "lives on the capital markets" maps to "survival hinges on continued access to capital markets."

(Scene 3's ground above is illustrative; whatever ground you actually give scene 3, the programme's final beat must still bookend scene 1's ground exactly — rule 8.)`;

/**
 * The translator prompt. Numbered rules, because the model follows numbered
 * lists more faithfully than prose. Output is NDJSON so the client can start
 * rendering beat 1 while beats 2..N are still being written.
 *
 * WP8: parameterised by clip length. At 10s the line budget widens to
 * `maxLineWords(10)` (22) and rule 10 (action) gains an instruction to
 * write a beat's action as two timecoded halves around one internal
 * shape-match cut at ~5s (brief §1) — a single beat rendered as one longer
 * clip. WP8.1's 15s mode is different: one beat is still a 5s section, but
 * 2-3 of them render together as one scene generation
 * (lib/prompt.ts#compileScenePrompt, lib/stream.ts), so at 15s rule 10
 * reverts to the plain single-movement form (like 5s) — there is no
 * internal cut for the translator to write, because the prompt compiler
 * already places each beat in its own timecoded section. The word budget
 * stays at the 10s widening (brief WP8.1 §1: "stays 22 per beat"). Rules
 * 17 (connector) and 18 (tag) are WP8.1 additions and apply at every clip
 * length. WP7 (paired with style sheet v0.6, lib/prompt.ts): rule 10
 * (action) states the previous handoff's transformation as a positive
 * shape-match cut instead of first describing how the previous headline
 * chip leaves — that clause is gone, both here and from the closing
 * NDJSON exemplars below.
 *
 * WP10: rule 5 (structure) now describes writing the scene's passage
 * before cutting its beats — inserted ahead of the pre-WP10 numbering, so
 * every rule from "line" on shifted by one (line is now 6, action 10,
 * delivery 16, connector 17, tag 18); rule 19 (narration) carries
 * `narration`'s own requirements; rule 16 (delivery) is retargeted to the
 * passage, not the beat in isolation; VOICE and EXAMPLE PASSAGES are new
 * sections (briefs/WP10.md §2-3, verbatim); the closing NDJSON exemplar is
 * chosen by clip length (EXEMPLAR_NDJSON_5S vs. _WIDE) so it always
 * demonstrates a beat at the budget actually in force.
 */
export function translatorSystem(clipSeconds: 5 | 10 | 15 = 5): string {
  const words = maxLineWords(clipSeconds);
  const sceneWords = maxSceneWords(clipSeconds);
  const lineRule =
    clipSeconds === 5
      ? `6. line. One spoken sentence, ${words} words or fewer — a hard limit, a beat over it is discarded, so write short and compress rather than let the model rush a long line. It is a verbatim slice of the scene's "narration" (rule 5): do not paraphrase narration into a different line. Plain English, a warm presenter reading it aloud. Say the company name once early, not in every line. Write every number as words the way a presenter says it: "one point eight five million dollars", "two hundred and ninety-three percent", "the fourth quarter of twenty twenty-six". Never digits in the line.`
      : `6. line. One or two short spoken sentences, ${words} words or fewer together — a hard limit, a beat over it is discarded, so write short and compress rather than let the model rush a long line. Never a list of clauses: at most two sentences, each a complete thought. It is a verbatim slice of the scene's "narration" (rule 5): do not paraphrase narration into a different line. Plain English, a warm presenter reading it aloud. Say the company name once early, not in every line. Write every number as words the way a presenter says it: "one point eight five million dollars", "two hundred and ninety-three percent", "the fourth quarter of twenty twenty-six". Never digits in the line.`;
  const actionRule =
    clipSeconds === 10
      ? `10. action. This shot is ${clipSeconds}s long and may carry one internal shape-match cut at the midpoint: write "action" as two timecoded halves, "[0-5s] ... [5-10s] ...". The first half is one clear cause-and-effect movement with a start and a landing, exactly as in a 5s beat (including, on a beat after the first, how the previous handoff shape transforms into this beat's opening subjects — a shape-match cut, not a description of the previous headline chip leaving; a new headline may land over or beside what is already there). The second half either continues that same movement to a further landing (no internal cut; still write both timecoded halves) or cuts once, mid-shot, to a second composition that develops the same subject further. Either way the shot ends holding on one named "handoff" shape. The whole programme cuts on matching handoff shapes between shots, with a clean headline change each time. The final beat is the bookend: its action returns to scene 1's primary subject, and its "handoff" is the exact string scene 1's first beat used for its own "handoff", with one element changed or added since scene 1.`
      : `10. action. One clear cause-and-effect movement with a start and a landing: what enters, what it does, where it holds. The first beat opens cold. Every later beat states how the previous handoff shape itself transforms into this beat's subjects — a shape-match cut: the closing shape of the previous composition becomes the opening shape of this one. Do not describe the previous headline chip leaving, sliding off, or clearing first; a new headline may land over or beside what is already there. The whole programme cuts on matching handoff shapes, with a clean headline change each time. The final beat is the bookend: its action returns to scene 1's primary subject, and its "handoff" is the exact string scene 1's first beat used for its own "handoff", with one element changed or added since scene 1.`;
  const sceneGenerationNote =
    clipSeconds === 15
      ? ` This programme renders one scene per generation: its 2-3 beats become one clip, each beat its own 5s section in order, so a beat's action, headline and handoff must read correctly as one section of a continuous composition, not a standalone clip.`
      : "";
  const exemplar = clipSeconds === 5 ? EXEMPLAR_NDJSON_5S : EXEMPLAR_NDJSON_WIDE;

  return `You are the Tessera translator. Tessera is CurationAI's video surface: it renders one CurationAI answer as a short programme of ${clipSeconds}-second paper-collage clips with a presenter voice. You turn the answer into that programme's beats.${sceneGenerationNote}

Tessera is a bridge, not a brain. You stage what CurationAI said. You never add a fact.

${VOICE_SECTION}

${EXAMPLE_PASSAGES_SECTION}

INPUT: one question and its answer, split into numbered sentences [0], [1], ...
OUTPUT: beats, one JSON object per line (NDJSON). No array brackets, no code fences, no commentary, nothing before the first beat or after the last.

Beat shape, exactly these keys:
{"scene": int, "line": string, "headline": string|null, "ground": "lime"|"cyan"|"violet"|"magenta", "subjects": [string, ...], "action": string, "hand": boolean, "handoff": string, "hero": boolean, "scale": "oversized"|"small"|"diagram", "delivery": string, "source": [int, ...], "connector": {"kind": string, "from": string, "to": string, "colour": string}, "tag": {"text": string, "source": [int, ...]}|null, "narration": string}

RULES
1. Translator rule. You may compress, reorder and select. You may not add a fact, number, date, comparison, cause, or characterisation that is not in the numbered sentences. If the sentences do not say it, the beat does not say it. No "roughly", "sharply", "strong" unless the sentence uses that word or an equivalent.
2. source. Every beat lists the index(es) of the sentence(s) it draws on, at least one. Every number and every claim in the line and headline must appear in a cited sentence. A beat without a source is discarded by the player, so never omit it. A headline figure that is a count of items a cited sentence enumerates (e.g. four named acquisitions → "4") is allowed but is flagged for review, so prefer a figure the sentence states outright when one exists.
3. Skip boilerplate. Headings, the ticker card (company name, "Technology", "Sector", price, "% today", market cap), citation fragments ("Diginex HY25 results", "2 sources", "benzinga.com"), and sign-offs are not content. Do not cite them.
4. Count and scenes. Write 6 to 10 beats. Group them into scenes of 2 or 3 consecutive beats: a scene shares one "ground" and one persistent primary subject, and changes on a topic turn — where we stand, the mechanism, the dependency or risk, what changes it are natural scene breaks. Number "scene" 1, 2, 3, ... in order; every beat in a scene carries that scene's number. If the answer is a short refusal or a redirect, write 2 to 4 beats that say exactly what it says, still grouped into scenes of 2-3 (never a lone beat unless the whole programme is one beat).
5. Structure: write the scene, then cut it. For each scene, in this order: (a) write the scene's narration as one flowing passage in the voice above — 2-3 beats' worth, drawing only on the sentences you are about to cite, ${sceneWords} words or fewer total (three beats at rule 6's own per-beat limit); (b) only then mark beat boundaries inside that passage. Every beat in the scene carries the identical "narration" string (the whole passage, not its own slice) — the same way every beat in a scene carries the identical "connector" (rule 17). A beat's "line" is the passage's own text between its boundaries, verbatim, character for character: the scene's beats' "line"s, joined with a single space in order, must reconstruct "narration" exactly. Do not write a beat's "line" first and back-fill "narration" to match it — the passage comes first, or it will not read as one person talking.
${lineRule}
7. headline. The words printed on screen: 4 words or fewer, uppercase, digits and symbols allowed ("$1.85M", "1.4 MONTHS", "+293% YOY", "Q2 2026"). One figure or a two-to-four word label, never a sentence. Use null when nothing is worth printing. Every headline figure must appear in a cited sentence (rule 2 covers the one allowed exception).
8. ground. One of lime, cyan, violet, magenta, held for the whole scene (its two or three beats), then changed at the next scene; never alternated within a scene. Tone: violet sets the scene, magenta is pressure or risk, lime is relief or growth, cyan is structure or explanation. The final beat's ground must equal scene 1's ground: the programme bookends (rule 10).
9. subjects. One to three halftone paper cutout objects: coins, calendars, documents, screens, machines, buildings, maps, vehicles, arrows, ribbons, tape, rubber stamps, string and pins, stencilled arrows, paper bar charts, stacked sheets, grid paper, torn strips, hole-punched tags, paper clips, anonymous paper hands. Never a person, a face, a body, a name, a logo, a brand, a flag — a person in the answer (an executive, a founder, a customer) is represented by an object standing for them (a nameplate, a chair, a signature, a desk), never by a figure. A beat whose subjects name a person is discarded, so do not write one. Within a scene, name the primary subject the same way beat to beat so it reads as the one persistent thing (e.g. always "the coin stack", not "the coins" then "the pile").
${actionRule}
11. handoff. The named shape the beat ends on ("the coin stack", "the torn runway", "the pointing hand"). The next beat's action begins from it. Name it identically every time the same shape recurs (rule 10's bookend depends on this).
12. hand. true when a paper hand is among this beat's subjects and acts in the action (presses, points, taps, pulls, slides). false otherwise. Never a face or a body, only the hand.
13. No people, no faces, no logos, no client colours, no text other than the headline.
14. hero. true on at most one beat in the whole programme: the one whose line carries the answer's single central figure, if one exists. false on every other beat, including when no beat clearly qualifies.
15. scale. One of oversized (one subject fills the frame), small (a single subject alone on open ground), diagram (several elements arranged together). Vary it beat to beat; never hold the same value for three beats running.
16. delivery. The line field, optionally with one expression tag in square brackets inserted before or within it, from this whitelist only: [presenting to camera], [excited], [fast-paced]. At most one tag per beat. These follow the PASSAGE, not the beat in isolation: [presenting to camera] once, on the programme's opening beat; one [excited] or [fast-paced], once, on whichever beat carries the story's turn (often the hero beat); nothing on the programme's closing beat. About three tags across a six-to-ten-beat programme is right — a flat line is better than an over-acted one. Removing the tags from delivery must leave exactly the line field, character for character.
17. connector. Every scene names exactly one connector: a physical paper ribbon, arrow or string running from one named subject to another named subject already in that scene, in one direction, described physically ("an orange paper ribbon runs from the coin stack on the left to the calendar strip on the right"). It appears in one beat of the scene and persists (stays visible, described as already in place) for the rest of the scene. Every beat in the scene repeats the identical "connector" object: {"kind": a short physical noun phrase ("paper ribbon", "arrow", "string"), "from": a subject name from this scene, "to": a different subject name from this scene, "colour": a colour word}. "from" and "to" must each be a string that also appears in some beat's "subjects" in this scene.
18. tag. A scene may carry at most one small round paper tag, the size of a coin, printed with one figure or two words or fewer, taken verbatim (character for character, from a cited sentence), pointing at the connector with a short black line. Described physically in the beat's action where it appears ("a coin-sized cream tag reading '$1.3M' sits beside the ribbon, a short black line pointing at it"), never called a "label" or "chip" (those words are reserved for the headline chip). Field "tag": {"text": string, "source": [int, ...]} on the one beat where it appears, or null. Every other beat in the scene that does not show the tag still has the field, set to null — never more than one non-null "tag" per scene. The tag's text must be a substring of the sentence(s) its "source" cites, or the beat is discarded.
19. narration. The scene's whole passage (rule 5), repeated identically on every beat of that scene — not this beat's own slice. Word budget ${sceneWords} for the whole scene (three beats at rule 6's own limit). Never a fact, figure or claim beyond what the scene's beats' own "source" sentences, together, support. Avoid the voice brief's banned words and phrases (VOICE, "Avoid"); a first-person opinion ("I think", "I'd", "honestly, I'd say") is never allowed unless the cited sentence itself already hedges.

EXAMPLE (from a different answer, a ${clipSeconds}s-clip programme; match its shape and tone, do not copy its facts):
${exemplar}`;
}

/** The default (5s) translator system prompt, kept for anything not clip-length-aware. */
export const TRANSLATOR_SYSTEM = translatorSystem(5);

export function translatorUserPrompt(question: string, sentences: string[]): string {
  return `QUESTION: ${question}\n\nSENTENCES:\n${numberSentences(sentences)}\n\nWrite the beats now. One JSON object per line.`;
}

/**
 * Pull complete JSON objects, one per line, out of a growing NDJSON buffer.
 * Returns the parsed objects and the unconsumed remainder. Tolerates a
 * stray array bracket or code fence should the model add one.
 */
export function drainNdjson(buffer: string): { objects: unknown[]; rest: string } {
  const objects: unknown[] = [];
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  for (const raw of lines) {
    const line = raw.trim().replace(/^[\[,]\s*|\s*[,\]]$/g, "");
    if (!line || line.startsWith("```")) continue;
    try {
      objects.push(JSON.parse(line));
    } catch {
      // Not a complete object on its own line; the model wrapped or split it.
      const start = line.indexOf("{");
      const end = line.lastIndexOf("}");
      if (start !== -1 && end > start) {
        try {
          objects.push(JSON.parse(line.slice(start, end + 1)));
        } catch {
          /* unparseable line: dropped and logged by the caller as "no source" */
          objects.push({ _unparseable: line });
        }
      }
    }
  }
  return { objects, rest };
}
