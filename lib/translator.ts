/**
 * The Tessera translator: one CurationAI answer in, a sequence of beats out.
 *
 * This module is isomorphic (no SDK imports) so the prompt, the schema and
 * the code-enforced translator rule are shared by the server route that
 * calls Claude (app/api/translate), the client that stages the beats, and
 * the checker (scripts/check.mjs mirrors `validateBeat`).
 *
 * Version: translator v0.4, paired with Tessera Style Sheet v0.4
 * (lib/prompt.ts). v0.3 background: WP0 found a native narrator rushed an
 * exemplar line at 19-20 words, so the line budget is 12 words, hard; two
 * clips showed a face despite "never a recognisable face", so a beat whose
 * `subjects` names a person, a body part that reads as a person, or a
 * proper name is dropped in code (CLAUDE.md rule 6, decision D23); `hero`
 * marks the one beat, if any, that carries the answer's central figure;
 * `scale` varies each beat's composition; `delivery` is `line` with
 * ElevenLabs expression tags for Saskia.
 *
 * v0.4 (WP5, watching briefs/reference/halftone-science-short.mp4): a
 * six-beat programme read as six disconnected clips, not one piece. The
 * reference does four things ours didn't: (1) `scene` groups 2-3
 * consecutive beats sharing a `ground` and a persistent primary subject —
 * the v0.3 "previous headline exits, elements clear" rule now applies only
 * at a scene boundary; within a scene, elements accumulate instead. (2)
 * `events` replaces the single `action`: exactly three timed moves per
 * beat (enter, act, react/label-lands), because the reference builds
 * 3-4 events per ~4s composition, roughly one a second, where v0.3 had one
 * movement per 5s beat. (3) `hand` marks the beats where the recurring
 * anonymous paper hand acts — it is the reference's one constant actor. (4)
 * `labels` are up to two short data chips per beat, verbatim from the cited
 * sentence, alongside the headline. The programme now also bookends: the
 * final beat returns to scene 1's ground with one thing changed, mirroring
 * the reference's closing "SAME VOICE, DIFFERENT MIX" composition.
 */

export const TRANSLATOR_VERSION = "translator-v0.4";

export type Ground = "lime" | "cyan" | "violet" | "magenta";
export const GROUNDS: Ground[] = ["lime", "cyan", "violet", "magenta"];

export type Scale = "oversized" | "small" | "diagram";
export const SCALES: Scale[] = ["oversized", "small", "diagram"];

/**
 * The only expression tags a `delivery` line may carry (WP3 §3): each is a
 * whole `[bracketed]` tag, at most one per line. Mirrored in scripts/check.mjs.
 */
export const DELIVERY_TAGS = ["presenting to camera", "excited", "fast-paced"];

/** One timed move: `events[0]` is 0-1.5s (enter), `[1]` is 1.5-3.5s (act), `[2]` is 3.5-5s (react or label lands). */
export type Events = [string, string, string];
export const EVENT_WINDOWS = ["0-1.5s", "1.5-3.5s", "3.5-5s"] as const;
export const EVENT_LABELS = ["enter", "act", "react or label lands"] as const;

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
  /** Exactly three timed moves: [0-1.5s] enter, [1.5-3.5s] act, [3.5-5s] react or label lands. */
  events: Events;
  /** Whether the recurring anonymous paper hand acts in this beat. True in at least half the programme's beats. */
  hand: boolean;
  /** Up to two short data chips (≤3 words or one figure each), verbatim from the cited sentence(s). */
  labels: string[];
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
}

/** Every `[bracketed]` tag in a delivery line. */
export function deliveryTags(delivery: string): string[] {
  return [...delivery.matchAll(/\[([^\]]*)\]/g)].map((m) => m[1]);
}

/** `delivery` with every `[bracketed]` tag removed and whitespace collapsed, for comparison against `line`. */
export function stripDelivery(delivery: string): string {
  return delivery.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
}

export interface BeatCheck {
  ok: boolean;
  beat: Beat | null;
  /** Why the beat was dropped (only when !ok). */
  dropped: string | null;
  /** Soft findings: kept, but flagged in the recording and by npm run check. */
  warnings: string[];
}

const MAX_LINE_WORDS = 12;
const MAX_HEADLINE_WORDS = 4;
const MAX_SUBJECTS = 3;
const MAX_LABELS = 2;
const MAX_LABEL_WORDS = 3;

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

/** Lowercase, strip punctuation, collapse whitespace — for a loose verbatim comparison. */
function normaliseForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Is a `labels` entry verbatim in the cited sentences (WP5 §1)? A label
 * carrying a figure matches by digit group, the same loose comparison the
 * headline number check uses; a text label matches by normalised
 * substring. Unlike the headline check, this one is hard: a label not
 * found is not a derived count, it is an invented one, so the beat is
 * dropped. Mirrored in scripts/check.mjs.
 */
export function labelFoundInSentences(label: string, cited: string): boolean {
  const nums = numbersIn(label);
  if (nums.length > 0) {
    const citedNums = numbersIn(cited);
    return nums.every((n) => citedNums.includes(n));
  }
  const needle = normaliseForMatch(label);
  return needle !== "" && normaliseForMatch(cited).includes(needle);
}

/**
 * The translator rule, in code. Hard: a beat without a valid `source`, a
 * line over 12 words, a subject that names a person, an `events` array
 * without exactly three entries, or a `labels` entry not found verbatim in
 * the cited sentences is dropped. Soft: headline length and headline
 * numbers not found in the cited sentences are recorded as warnings so the
 * report can show them (a warning also covers the one allowed derivation:
 * a headline count of items the cited sentence enumerates rather than
 * states as a figure); they never silently rewrite the text.
 */
export function validateBeat(raw: unknown, sentences: string[]): BeatCheck {
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
  if (lineWords > MAX_LINE_WORDS) {
    return { ok: false, beat: null, dropped: `line is ${lineWords} words (limit ${MAX_LINE_WORDS})`, warnings };
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
  const eventsRaw = Array.isArray(b.events)
    ? b.events.filter((e): e is string => typeof e === "string" && e.trim() !== "")
    : [];
  if (eventsRaw.length !== 3) {
    return {
      ok: false,
      beat: null,
      dropped: `expected exactly 3 timed events, got ${eventsRaw.length}`,
      warnings,
    };
  }
  const events = eventsRaw.map((e) => e.trim()) as Events;

  const handoff = typeof b.handoff === "string" ? b.handoff.trim() : "";
  if (!handoff) return { ok: false, beat: null, dropped: "no handoff", warnings };

  const hand = b.hand === true;

  const cited = source.map((i) => sentences[i]).join(" ").replace(/,/g, "");

  let labels = Array.isArray(b.labels)
    ? b.labels.filter((l): l is string => typeof l === "string" && l.trim() !== "").map((l) => l.trim())
    : [];
  if (labels.length > MAX_LABELS) {
    warnings.push(`${labels.length} labels; keeping the first ${MAX_LABELS}`);
    labels = labels.slice(0, MAX_LABELS);
  }
  for (const label of labels) {
    if (wordCount(label) > MAX_LABEL_WORDS && numbersIn(label).length === 0) {
      warnings.push(`label "${label}" is ${wordCount(label)} words (limit ${MAX_LABEL_WORDS} unless it is a figure)`);
    }
    if (!labelFoundInSentences(label, cited)) {
      return {
        ok: false,
        beat: null,
        dropped: `label "${label}" not found verbatim in cited sentences ${JSON.stringify(source)}`,
        warnings,
      };
    }
  }

  if (headline && wordCount(headline) > MAX_HEADLINE_WORDS) {
    warnings.push(`headline is ${wordCount(headline)} words (limit ${MAX_HEADLINE_WORDS})`);
  }
  if (headline) {
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

  return {
    ok: true,
    beat: { scene, line, headline, ground, subjects, events, hand, labels, handoff, hero, scale, delivery, source },
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

/**
 * Programme-level checks `validateBeat` cannot make on one beat alone: at
 * most one `hero` beat; no `scale` value held for three beats running
 * (WP3 §3); every `scene` a run of 2-3 consecutive beats (WP5 §1); and the
 * final beat's `ground` matching scene 1's, the bookend (WP5 §1, "the
 * final beat returns to scene 1's ground and primary subject"; only the
 * ground is checkable in code — the primary subject and handoff match are
 * enforced by the prompt, not the checker). Returns hard failure reasons;
 * mirrored in scripts/check.mjs for `npm run check`.
 */
export function validateProgramme(beats: Beat[]): string[] {
  const failures: string[] = [];
  const heroes = beats.filter((b) => b.hero).length;
  if (heroes > 1) failures.push(`${heroes} hero beats (limit 1)`);
  for (let i = 0; i + 2 < beats.length; i += 1) {
    const [a, b, c] = [beats[i], beats[i + 1], beats[i + 2]];
    if (a.scale === b.scale && b.scale === c.scale) {
      failures.push(`scale "${a.scale}" repeats for beats ${i + 1}-${i + 3}`);
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
  return failures;
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
export function deflectionBeat(sentences: string[], link: string): Beat {
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
  const line = (words.length > MAX_LINE_WORDS ? words.slice(0, MAX_LINE_WORDS).join(" ") : spoken) ||
    "This is covered in the Curation showcase.";
  return {
    scene: 1,
    line,
    headline: link.replace(/^https?:\/\//, ""),
    ground: "cyan",
    subjects: ["a paper screen", "a paper hand"],
    events: [
      "A cream paper screen slides in and lands centre.",
      "A paper hand enters from the right and taps the screen.",
      "The screen holds, printed with the link.",
    ],
    hand: true,
    labels: [],
    handoff: "the paper screen",
    hero: false,
    scale: "small",
    delivery: line,
    source: [linkIndex],
  };
}

/**
 * The six-beat exemplar, hand-mapped to the sentence indexes of the
 * captured answer to "What is the cash position and runway?" (see
 * data/translations/<hash>.json, pinned — this is what the spine actually
 * renders, TRANSLATE_CACHE=on). v0.2: every line rewritten to the 12-word
 * budget. v0.3: beat 4 (the runway figure the question actually asks for)
 * is `hero`; `scale` runs oversized/small/diagram/oversized/small/diagram,
 * never three-in-a-row; `delivery` carries three tags total.
 *
 * v0.4 (WP5): regrouped into three two-beat scenes — {1,2} violet (the
 * cash position), {3,4} magenta (the burn and the hero runway figure),
 * {5,6} violet again. v0.3 had beats 5-6 on lime (the capital raise read
 * as relief); v0.4 moves them to violet instead so the programme bookends:
 * beat 6 returns to scene 1's ground, its primary subject (the coin
 * stack), and its exact handoff, with one thing added along the way (the
 * October warrant's fresh coins, beat 5) and one changed (two calendar
 * pages and the pointing hand, beat 6) — mirroring the reference's closing
 * composition. `action` is replaced by three timed `events` per beat.
 * `hand` is true on 4 of 6 beats (beats 1, 4, 5, 6). Every `labels` entry
 * is an exact substring of its beat's cited sentence(s) (validateBeat
 * hard-drops otherwise, unlike the soft headline-number check).
 */
export const EXEMPLAR_NDJSON = [
  `{"scene":1,"line":"By September's end, Diginex held one point eight five million in cash.","headline":"$1.85M","ground":"violet","subjects":["a stack of paper coins","a cream paper chip"],"events":["A stack of paper coins drops onto the ground and settles, opening cold.","A black paper chip slaps into place beside the stack.","A paper hand presses the top coin flat as the chip holds."],"hand":true,"labels":["six months earlier"],"handoff":"the coin stack","hero":false,"scale":"oversized","delivery":"[presenting to camera] By September's end, Diginex held one point eight five million in cash.","source":[9]}`,
  `{"scene":1,"line":"Six months earlier it was three point one one million.","headline":"$3.11M → $1.85M","ground":"violet","subjects":["the coin stack","a torn-paper arrow"],"events":["The coin stack, already in place, is joined by a torn-paper arrow entering from the edge.","The arrow points down as the stack visibly shrinks coin by coin.","A second black chip slaps in beside the first, which stays exactly where it landed."],"hand":false,"labels":["$3.11M"],"handoff":"the arrow","hero":false,"scale":"small","delivery":"[fast-paced] Six months earlier it was three point one one million.","source":[9,10]}`,
  `{"scene":2,"line":"Operating burn ran about one point three million a month.","headline":"$1.3M / MONTH","ground":"magenta","subjects":["a paper calendar strip","paper coins"],"events":["Both violet-scene chips slide off the top edge as the arrow unrolls into a paper calendar strip on fresh magenta ground.","Paper coins slide off the strip, one month at a time.","A black chip slaps in, reading the monthly burn."],"hand":false,"labels":["$3.9M per half-year"],"handoff":"the strip","hero":false,"scale":"diagram","delivery":"Operating burn ran about one point three million a month.","source":[22]}`,
  `{"scene":2,"line":"At that rate, the cash on hand covered one point four months.","headline":"1.4 MONTHS","ground":"magenta","subjects":["the strip","a cutout aircraft"],"events":["The strip, already in place, becomes a runway torn short as a cutout aircraft enters from the edge.","The aircraft rolls to the torn end and stops, the strip's chip staying exactly where it landed.","A larger black chip slaps in, the hero number printing large."],"hand":true,"labels":["dangerously thin"],"handoff":"the runway","hero":true,"scale":"oversized","delivery":"[excited] At that rate, the cash on hand covered one point four months.","source":[23]}`,
  `{"scene":3,"line":"October's warrant exercise added thirteen point eight million in cash.","headline":"+$13.8M","ground":"violet","subjects":["the coin stack","fresh paper coins","tape pieces"],"events":["The magenta-scene runway chip and aircraft are covered as the ground returns to violet and the original coin stack reappears.","Fresh paper coins are taped onto the stack, one after another.","A black chip slaps in, and the hand presses the last coin flat."],"hand":true,"labels":["$13.8M"],"handoff":"the coin stack","hero":false,"scale":"small","delivery":"October's warrant exercise added thirteen point eight million in cash.","source":[27]}`,
  `{"scene":3,"line":"Survival depends on capital markets and the next two quarters.","headline":"NEXT 2 QUARTERS","ground":"violet","subjects":["the coin stack","two paper calendar pages","a paper hand"],"events":["The coin stack, already in place, is joined by two calendar pages entering from the edge — the one new element in this closing shot.","A paper hand enters and points at the second page.","A black chip slaps in over the stack, closing the programme back where it began."],"hand":true,"labels":["capital markets"],"handoff":"the coin stack","hero":false,"scale":"diagram","delivery":"Survival depends on capital markets and the next two quarters.","source":[25,43]}`,
].join("\n");

/**
 * The translator prompt. Numbered rules, because the model follows numbered
 * lists more faithfully than prose. Output is NDJSON so the client can start
 * rendering beat 1 while beats 2..N are still being written.
 */
export const TRANSLATOR_SYSTEM = `You are the Tessera translator. Tessera is CurationAI's video surface: it renders one CurationAI answer as a short programme of five-second paper-collage clips with a presenter voice. You turn the answer into that programme's beats.

Tessera is a bridge, not a brain. You stage what CurationAI said. You never add a fact.

INPUT: one question and its answer, split into numbered sentences [0], [1], ...
OUTPUT: beats, one JSON object per line (NDJSON). No array brackets, no code fences, no commentary, nothing before the first beat or after the last.

Beat shape, exactly these keys:
{"scene": int, "line": string, "headline": string|null, "ground": "lime"|"cyan"|"violet"|"magenta", "subjects": [string, ...], "events": [string, string, string], "hand": boolean, "labels": [string, ...], "handoff": string, "hero": boolean, "scale": "oversized"|"small"|"diagram", "delivery": string, "source": [int, ...]}

RULES
1. Translator rule. You may compress, reorder and select. You may not add a fact, number, date, comparison, cause, or characterisation that is not in the numbered sentences. If the sentences do not say it, the beat does not say it. No "roughly", "sharply", "strong" unless the sentence uses that word or an equivalent.
2. source. Every beat lists the index(es) of the sentence(s) it draws on, at least one. Every number and every claim in the line and headline must appear in a cited sentence. A beat without a source is discarded by the player, so never omit it. A headline figure that is a count of items a cited sentence enumerates (e.g. four named acquisitions → "4") is allowed but is flagged for review, so prefer a figure the sentence states outright when one exists.
3. Skip boilerplate. Headings, the ticker card (company name, "Technology", "Sector", price, "% today", market cap), citation fragments ("Diginex HY25 results", "2 sources", "benzinga.com"), and sign-offs are not content. Do not cite them.
4. Count and scenes. Write 6 to 10 beats. Group them into scenes of 2 or 3 consecutive beats: a scene shares one "ground" and one persistent primary subject, and changes on a topic turn — where we stand, the mechanism, the dependency or risk, what changes it are natural scene breaks. Number "scene" 1, 2, 3, ... in order; every beat in a scene carries that scene's number. If the answer is a short refusal or a redirect, write 2 to 4 beats that say exactly what it says, still grouped into scenes of 2-3 (never a lone beat unless the whole programme is one beat).
5. line. One spoken sentence, 12 words or fewer — a hard limit, a beat over it is discarded, so write short and compress rather than let the model rush a long line. Plain English, a warm presenter reading it aloud. Say the company name once early, not in every line. Write every number as words the way a presenter says it: "one point eight five million dollars", "two hundred and ninety-three percent", "the fourth quarter of twenty twenty-six". Never digits in the line.
6. headline. The words printed on screen: 4 words or fewer, uppercase, digits and symbols allowed ("$1.85M", "1.4 MONTHS", "+293% YOY", "Q2 2026"). One figure or a two-to-four word label, never a sentence. Use null when nothing is worth printing. Every headline figure must appear in a cited sentence (rule 2 covers the one allowed exception).
7. ground. One of lime, cyan, violet, magenta, held for the whole scene (two or three beats), then changed at the next scene; never alternated within a scene. Tone: violet sets the scene, magenta is pressure or risk, lime is relief or growth, cyan is structure or explanation. The final beat's ground must equal scene 1's ground: the programme bookends (rule 9).
8. subjects. One to three halftone paper cutout objects: coins, calendars, documents, screens, machines, buildings, maps, vehicles, arrows, ribbons, tape, rubber stamps, string and pins, stencilled arrows, paper bar charts, stacked sheets, grid paper, torn strips, hole-punched tags, paper clips, anonymous paper hands. Never a person, a face, a body, a name, a logo, a brand, a flag — a person in the answer (an executive, a founder, a customer) is represented by an object standing for them (a nameplate, a chair, a signature, a desk), never by a figure. A beat whose subjects name a person is discarded, so do not write one. Within a scene, name the primary subject the same way beat to beat so it reads as the one persistent thing (e.g. always "the coin stack", not "the coins" then "the pile").
9. events, accumulation and the bookend. "events" is exactly three short clauses, one per timed window: events[0] is [0-1.5s] what enters, events[1] is [1.5-3.5s] what it does, events[2] is [3.5-5s] how it lands, reacts, or a label lands. Within a scene (the second and third beat of it), elements already on screen — the primary subject, and any ribbons or chips from earlier beats in the scene — stay exactly where they are; only what's new this beat enters, so events[0] says what joins, not what the scene already has. At a scene boundary (a beat starting a new scene), the v0.2 exit still applies: events[0] states how the previous scene's chips leave — slide off, flip away, or are covered — before this scene's subject appears. The whole programme cuts on matching handoff shapes (rule 10). The final beat is the bookend: it returns to scene 1's ground and primary subject, with one element changed or added since scene 1, and its "handoff" is the exact string scene 1's first beat used for its own "handoff".
10. handoff. The named shape the beat ends on ("the coin stack", "the torn runway", "the pointing hand"). The next beat's events begin from it. Name it identically every time the same shape recurs (rule 9's bookend depends on this).
11. hand. true when the anonymous paper hand acts in this beat's events (presses, points, pulls a ribbon, taps a number, slides a chip) — true in at least half the programme's beats, since it is the one recurring actor. false otherwise. Never a face or body, only the hand.
12. labels. Zero, one or two short data chips per beat, each three words or fewer, or a single figure, and each one an exact substring of a cited sentence (case aside) — not a paraphrase, not a derived count. Use them for a supporting number, date, or short phrase the headline doesn't already carry. A label copied from outside the cited sentence(s) gets the whole beat discarded, so when unsure, leave "labels" empty rather than invent one.
13. No people, no faces, no logos, no client colours, no text other than the headline and labels.
14. hero. true on at most one beat in the whole programme: the one whose line carries the answer's single central figure, if one exists. false on every other beat, including when no beat clearly qualifies.
15. scale. One of oversized (one subject fills the frame), small (a single subject alone on open ground), diagram (several elements arranged together). Vary it beat to beat; never hold the same value for three beats running.
16. delivery. The line field, optionally with one expression tag in square brackets inserted before or within it, from this whitelist only: [presenting to camera], [excited], [fast-paced]. At most one tag per beat. Most beats carry none — about three tags across a six-to-ten-beat programme is right: [presenting to camera] on the opener, one [excited] or [fast-paced] on the hero beat or a turn in the story, none on the close. A flat line is better than an over-acted one. Removing the tags from delivery must leave exactly the line field, character for character.

EXAMPLE (from a different answer; match its shape and tone, do not copy its facts):
${EXEMPLAR_NDJSON}`;

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
