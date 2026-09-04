/**
 * The Tessera translator: one CurationAI answer in, a sequence of beats out.
 *
 * This module is isomorphic (no SDK imports) so the prompt, the schema and
 * the code-enforced translator rule are shared by the server route that
 * calls Claude (app/api/translate), the client that stages the beats, and
 * the checker (scripts/check.mjs mirrors `validateBeat`).
 *
 * Version: translator v0.2, paired with Tessera Style Sheet v0.2
 * (lib/prompt.ts). WP0 found: a native narrator rushed an exemplar line at
 * 19-20 words, so the line budget is now 12 words, hard; two clips showed a
 * face despite "never a recognisable face", so a beat whose `subjects`
 * names a person, a body part that reads as a person, or a proper name is
 * now dropped in code, not just discouraged in the prompt (CLAUDE.md rule
 * 6, decision D23).
 */

export const TRANSLATOR_VERSION = "translator-v0.2";

export type Ground = "lime" | "cyan" | "violet" | "magenta";
export const GROUNDS: Ground[] = ["lime", "cyan", "violet", "magenta"];

export interface Beat {
  /** Spoken sentence, 12 words or fewer. */
  line: string;
  /** On-screen words, 4 or fewer, or null. */
  headline: string | null;
  ground: Ground;
  /** Halftone cutout objects, 1–3. Never a person. */
  subjects: string[];
  /** One clear cause-and-effect movement, including how the previous handoff exits. */
  action: string;
  /** The named shape this beat ends on, which the next beat transforms. */
  handoff: string;
  /** Indexes into the answer's sentences. Never empty: no source, no render. */
  source: number[];
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

/**
 * The translator rule, in code. Hard: a beat without a valid `source`, a
 * line over 12 words, or a subject that names a person is dropped. Soft:
 * headline length and headline numbers not found in the cited sentences
 * are recorded as warnings so the report can show them (a warning also
 * covers the one allowed derivation: a headline count of items the cited
 * sentence enumerates rather than states as a figure); they never silently
 * rewrite the text.
 */
export function validateBeat(raw: unknown, sentences: string[]): BeatCheck {
  const warnings: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, beat: null, dropped: "not an object", warnings };
  }
  const b = raw as Record<string, unknown>;

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
  const action = typeof b.action === "string" ? b.action.trim() : "";
  if (!action) return { ok: false, beat: null, dropped: "no action", warnings };
  const handoff = typeof b.handoff === "string" ? b.handoff.trim() : "";
  if (!handoff) return { ok: false, beat: null, dropped: "no handoff", warnings };

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

  return {
    ok: true,
    beat: { line, headline, ground, subjects, action, handoff, source },
    dropped: null,
    warnings,
  };
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
  const line = words.length > MAX_LINE_WORDS ? words.slice(0, MAX_LINE_WORDS).join(" ") : spoken;
  return {
    line: line || "This is covered in the Curation showcase.",
    headline: link.replace(/^https?:\/\//, ""),
    ground: "cyan",
    subjects: ["a paper screen", "a paper hand"],
    action:
      "A cream paper screen slides in and lands centre; a paper hand enters from the right and taps the screen, which holds the printed link.",
    handoff: "the paper screen",
    source: [linkIndex],
  };
}

/**
 * The six-beat exemplar, hand-mapped to the sentence indexes of the
 * captured answer to "What is the cash position and runway?" (see
 * data/translations/<hash>.json, pinned). v0.2: every line rewritten to
 * the 12-word budget (v0.1's beat 5 ran 19-20 words and made the native
 * narrator rush it); beat 5 is cut rather than split, so the spine stays
 * six beats (18 clips across the three spine sessions, matching WP0's
 * denominators). Every action now names what leaves from the previous
 * beat's headline chip and how, per rule 9.
 */
export const EXEMPLAR_NDJSON = [
  `{"line":"By September's end, Diginex held one point eight five million in cash.","headline":"$1.85M","ground":"violet","subjects":["a stack of paper coins","a cream paper chip"],"action":"A single halftone stack of paper coins drops onto a cream chip and settles.","handoff":"the coin stack","source":[9]}`,
  `{"line":"Six months earlier it was three point one one million.","headline":"$3.11M → $1.85M","ground":"violet","subjects":["the coin stack","a torn-paper arrow"],"action":"The previous chip slides off the top edge as the coin stack shrinks coin by coin; a torn-paper arrow enters and points down.","handoff":"the arrow","source":[9,10]}`,
  `{"line":"Operating burn ran about one point three million a month.","headline":"$1.3M / MONTH","ground":"magenta","subjects":["a paper calendar strip","paper coins"],"action":"The previous chip flips away as the arrow unrolls into a paper calendar strip; coins slide off it month by month.","handoff":"the strip","source":[22]}`,
  `{"line":"At that rate, the cash on hand covered one point four months.","headline":"1.4 MONTHS","ground":"magenta","subjects":["a paper runway","a cutout aircraft"],"action":"The previous chip is covered as the strip becomes a runway torn short; a cutout aircraft rolls to the torn end and stops.","handoff":"the runway","source":[23]}`,
  `{"line":"October's warrant exercise added thirteen point eight million in cash.","headline":"+$13.8M","ground":"lime","subjects":["fresh paper coins","the runway","tape pieces"],"action":"The previous chip slides off as fresh paper coins are taped onto the runway one after another, extending it across the frame.","handoff":"the extended runway","source":[27]}`,
  `{"line":"Survival depends on capital markets and the next two quarters.","headline":"NEXT 2 QUARTERS","ground":"lime","subjects":["two paper calendar pages","a paper hand"],"action":"The previous chip flips down as two paper calendar pages land on the runway; a paper hand enters and points at the second.","handoff":"the pointing hand","source":[25,43]}`,
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
{"line": string, "headline": string|null, "ground": "lime"|"cyan"|"violet"|"magenta", "subjects": [string, ...], "action": string, "handoff": string, "source": [int, ...]}

RULES
1. Translator rule. You may compress, reorder and select. You may not add a fact, number, date, comparison, cause, or characterisation that is not in the numbered sentences. If the sentences do not say it, the beat does not say it. No "roughly", "sharply", "strong" unless the sentence uses that word or an equivalent.
2. source. Every beat lists the index(es) of the sentence(s) it draws on, at least one. Every number and every claim in the line and headline must appear in a cited sentence. A beat without a source is discarded by the player, so never omit it. A headline figure that is a count of items a cited sentence enumerates (e.g. four named acquisitions → "4") is allowed but is flagged for review, so prefer a figure the sentence states outright when one exists.
3. Skip boilerplate. Headings, the ticker card (company name, "Technology", "Sector", price, "% today", market cap), citation fragments ("Diginex HY25 results", "2 sources", "benzinga.com"), and sign-offs are not content. Do not cite them.
4. Count. Write 6 to 10 beats. Follow the answer's own arc: where we stand, the mechanism, the dependency or risk, what changes it. If the answer is a short refusal or a redirect, write 2 to 4 beats that say exactly what it says.
5. line. One spoken sentence, 12 words or fewer — a hard limit, a beat over it is discarded, so write short and compress rather than let the model rush a long line. Plain English, a warm presenter reading it aloud. Say the company name once early, not in every line. Write every number as words the way a presenter says it: "one point eight five million dollars", "two hundred and ninety-three percent", "the fourth quarter of twenty twenty-six". Never digits in the line.
6. headline. The words printed on screen: 4 words or fewer, uppercase, digits and symbols allowed ("$1.85M", "1.4 MONTHS", "+293% YOY", "Q2 2026"). One figure or a two-to-four word label, never a sentence. Use null when nothing is worth printing. Every headline figure must appear in a cited sentence (rule 2 covers the one allowed exception).
7. ground. One of lime, cyan, violet, magenta. Hold a ground for two or three consecutive beats, then change; never alternate every beat. Tone: violet sets the scene, magenta is pressure or risk, lime is relief or growth, cyan is structure or explanation.
8. subjects. One to three halftone paper cutout objects: coins, calendars, documents, screens, machines, buildings, maps, vehicles, arrows, ribbons, tape, anonymous paper hands. Never a person, a face, a body, a name, a logo, a brand, a flag — a person in the answer (an executive, a founder, a customer) is represented by an object standing for them (a nameplate, a chair, a signature, a desk), never by a figure. A beat whose subjects name a person is discarded, so do not write one.
9. action. One clear cause-and-effect movement with a start and a landing: what enters, what it does, where it holds. The first beat opens cold. Every later beat states, in this order: (a) how the previous beat's headline chip leaves — it slides off, flips away, or is covered, so the new headline lands on clear ground — then (b) how the previous handoff shape itself transforms into this beat's subjects. The whole programme cuts on matching handoff shapes, with a clean headline change each time.
10. handoff. The named shape the beat ends on ("the coin stack", "the torn runway", "the pointing hand"). The next beat's action begins from it.
11. No people, no faces, no logos, no client colours, no text other than the headline.

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
