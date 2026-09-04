/**
 * The Tessera translator: one CurationAI answer in, a sequence of beats out.
 *
 * This module is isomorphic (no SDK imports) so the prompt, the schema and
 * the code-enforced translator rule are shared by the server route that
 * calls Claude (app/api/translate), the client that stages the beats, and
 * the checker (scripts/check.mjs mirrors `validateBeat`).
 *
 * Version: translator v0.1, paired with Tessera Style Sheet v0.1 (lib/prompt.ts).
 */

export const TRANSLATOR_VERSION = "translator-v0.1";

export type Ground = "lime" | "cyan" | "violet" | "magenta";
export const GROUNDS: Ground[] = ["lime", "cyan", "violet", "magenta"];

export interface Beat {
  /** Spoken sentence, 18 words or fewer. */
  line: string;
  /** On-screen words, 4 or fewer, or null. */
  headline: string | null;
  ground: Ground;
  /** Halftone cutout objects, 1–3. */
  subjects: string[];
  /** One clear cause-and-effect movement. */
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

const MAX_LINE_WORDS = 18;
const MAX_HEADLINE_WORDS = 4;
const MAX_SUBJECTS = 3;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Digit groups in a headline, normalised for the soft number check. */
function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""));
}

/**
 * The translator rule, in code. Hard: a beat without a valid `source` is
 * dropped. Soft: length and number findings are recorded as warnings so the
 * report can show them; they never silently rewrite the text.
 */
export function validateBeat(raw: unknown, sentences: string[]): BeatCheck {
  const warnings: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, beat: null, dropped: "not an object", warnings };
  }
  const b = raw as Record<string, unknown>;

  const line = typeof b.line === "string" ? b.line.trim() : "";
  if (!line) return { ok: false, beat: null, dropped: "no line", warnings };

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
  if (subjects.length > MAX_SUBJECTS) {
    warnings.push(`${subjects.length} subjects; keeping the first ${MAX_SUBJECTS}`);
    subjects = subjects.slice(0, MAX_SUBJECTS);
  }
  const action = typeof b.action === "string" ? b.action.trim() : "";
  if (!action) return { ok: false, beat: null, dropped: "no action", warnings };
  const handoff = typeof b.handoff === "string" ? b.handoff.trim() : "";
  if (!handoff) return { ok: false, beat: null, dropped: "no handoff", warnings };

  const lineWords = wordCount(line);
  if (lineWords > MAX_LINE_WORDS) {
    warnings.push(`line is ${lineWords} words (limit ${MAX_LINE_WORDS})`);
  }
  if (headline && wordCount(headline) > MAX_HEADLINE_WORDS) {
    warnings.push(`headline is ${wordCount(headline)} words (limit ${MAX_HEADLINE_WORDS})`);
  }
  if (headline) {
    const cited = source.map((i) => sentences[i]).join(" ").replace(/,/g, "");
    for (const n of numbersIn(headline)) {
      if (!cited.includes(n)) {
        warnings.push(`headline number "${n}" not found in cited sentences ${JSON.stringify(source)}`);
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

/** The six-beat exemplar from briefs/WP0.md, used in the prompt as the tone reference. */
export const EXEMPLAR_NDJSON = [
  `{"line":"At the end of September, Diginex held one point eight five million dollars in cash.","headline":"$1.85M","ground":"violet","subjects":["a stack of paper coins","a cream paper chip"],"action":"A single halftone stack of paper coins drops onto a cream chip and settles.","handoff":"the coin stack","source":[9]}`,
  `{"line":"Six months earlier it was three point one one million — the burn shows a company mid-transition.","headline":"$3.11M → $1.85M","ground":"violet","subjects":["the coin stack","a torn-paper arrow"],"action":"The stack shrinks coin by coin; a torn-paper arrow slides in and points down.","handoff":"the arrow","source":[9,10]}`,
  `{"line":"Operating burn ran about one point three million a month.","headline":"$1.3M / MONTH","ground":"magenta","subjects":["a paper calendar strip","paper coins"],"action":"The arrow unrolls into a paper calendar strip; coins slide off it month by month.","handoff":"the strip","source":[22]}`,
  `{"line":"At that rate, the cash on hand covered roughly one point four months.","headline":"1.4 MONTHS","ground":"magenta","subjects":["a paper runway","a cutout aircraft"],"action":"The strip becomes a runway that is torn short; a cutout aircraft rolls toward the torn end and stops.","handoff":"the runway","source":[23]}`,
  `{"line":"An eleven point four million warrant exercise kept the company afloat — and October added thirteen point eight million more.","headline":"+$13.8M","ground":"lime","subjects":["fresh paper coins","the runway","tape pieces"],"action":"Fresh paper coins are taped onto the runway one after another, extending it across the frame.","handoff":"the extended runway","source":[20,27]}`,
  `{"line":"Survival depends on capital markets; the next two quarters show whether revenue can narrow the gap.","headline":"NEXT 2 QUARTERS","ground":"lime","subjects":["two paper calendar pages","a paper hand"],"action":"Two paper calendar pages land on the runway; a paper hand enters and points at the second.","handoff":"the pointing hand","source":[25,43]}`,
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
2. source. Every beat lists the index(es) of the sentence(s) it draws on, at least one. Every number and every claim in the line and headline must appear in a cited sentence. A beat without a source is discarded by the player, so never omit it.
3. Skip boilerplate. Headings, the ticker card (company name, "Technology", "Sector", price, "% today", market cap), citation fragments ("Diginex HY25 results", "2 sources", "benzinga.com"), and sign-offs are not content. Do not cite them.
4. Count. Write 6 to 10 beats. Follow the answer's own arc: where we stand, the mechanism, the dependency or risk, what changes it. If the answer is a short refusal or a redirect, write 2 to 4 beats that say exactly what it says.
5. line. One spoken sentence, 18 words or fewer, plain English, a warm presenter reading it aloud. Say the company name once early, not in every line. Write every number as words the way a presenter says it: "one point eight five million dollars", "two hundred and ninety-three percent", "the fourth quarter of twenty twenty-six". Never digits in the line.
6. headline. The words printed on screen: 4 words or fewer, uppercase, digits and symbols allowed ("$1.85M", "1.4 MONTHS", "+293% YOY", "Q2 2026"). One figure or a two-to-four word label, never a sentence. Use null when nothing is worth printing. Every headline figure must appear in a cited sentence.
7. ground. One of lime, cyan, violet, magenta. Hold a ground for two or three consecutive beats, then change; never alternate every beat. Tone: violet sets the scene, magenta is pressure or risk, lime is relief or growth, cyan is structure or explanation.
8. subjects. One to three halftone paper cutout objects: coins, calendars, documents, screens, machines, buildings, maps, vehicles, arrows, ribbons, tape, anonymous paper hands. Never a person, a face, a logo, a brand, a flag.
9. action. One clear cause-and-effect movement with a start and a landing: what enters, what it does, where it holds. The first beat opens cold. Every later beat opens by transforming the previous beat's handoff shape, so the whole programme cuts on matching shapes.
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
