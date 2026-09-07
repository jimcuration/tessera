/**
 * The prompt compiler: STYLE SHEET + BEAT + COPY LIST + AUDIO BLOCK.
 *
 * Tessera Style Sheet v0.3 is a numbered list on purpose: fal's prompt
 * rewriter copies numbered lists and paraphrases prose. Keep it numbered.
 * v0.1 measured that fal's rewriter drops any line phrased as a
 * prohibition (0/18 survival on "no brands" and "numbers never count up",
 * WP0 report §6) while descriptive lines survive at 16-18/18; v0.2 states
 * everything as a description of the world, with a prohibition appended
 * only where a description alone would not do. v0.2's line 6 ("no glow,
 * neon, bloom") kept a literal prohibition tail and survived *worse* than
 * v0.1 (7/18 vs 11/18, WP2 report §6); v0.3 deletes it as a standalone
 * line and folds its content into line 3's description of every cutout as
 * matte paper reflecting only the room light. Line 4's vocabulary is
 * widened (WP3, Robin: "refine with more elements and more variety").
 * Line 7 (headline typography) now caps width at a third of the frame
 * unless the beat is marked `hero`, and a new line 8 varies composition
 * scale beat to beat — both answer Robin's "the text is too big and feels
 * clumsy." The four grounds are named, never hex: palette values are
 * approximate until Jim confirms, and the video model reads names well.
 *
 * WP5 built a v0.4 of this file (deep/saturated grounds held per scene,
 * cream-or-pale-yellow-on-black headline+label type, and three new lines
 * for accumulation, the recurring hand, and a hot ribbon colour) and
 * measured it in briefs/WP5-report.md. Merging WP5 to main, Robin asked
 * to keep the translator's `scene`/`hand`/bookend additions but restore
 * this file to v0.3 exactly and drop the `labels` field they came with —
 * so `Beat` still carries `scene` and `hand` (lib/translator.ts), but
 * neither one is surfaced into the compiled prompt below; this file is
 * v0.3, unchanged in substance from the WP3 version.
 */

import type { Beat, Ground, Scale } from "./translator";

export const STYLE_SHEET_VERSION = "style-sheet-v0.3";

export type Voice = "native" | "saskia";

const GROUND_NAMES: Record<Ground, string> = {
  lime: "lime green",
  cyan: "pale cyan",
  violet: "soft violet",
  magenta: "deep magenta",
};

/**
 * Approximate hex for the interface only (the cursor blinks in the next
 * beat's ground colour). Not used in prompts. Approximate until Jim confirms.
 */
export const GROUND_HEX: Record<Ground, string> = {
  lime: "#C6F04C",
  cyan: "#BDEBF2",
  violet: "#C9B6F5",
  magenta: "#C2177A",
};

/** The eleven lines, verbatim from CLAUDE.md, with line 2 filled by the beat. */
export function styleSheet(ground: Ground): string[] {
  return [
    "Modern editorial paper collage: bold magazine composition, refined 2D motion design, photographed flat under soft room light.",
    `One flat block-colour paper ground fills the frame: ${GROUND_NAMES[ground]}. The ground is a single unbroken colour.`,
    "Subjects are black-and-white halftone photographic cutouts with rough white torn-paper edges: objects, machines, buildings, maps, coins, screens, vehicles, anonymous paper hands. Every cutout is a plain, unmarked object: calendar pages, documents, coins, screens and vehicles are blank and unprinted, with no lettering, numerals, symbols, liveries or marks on them. Every cutout is matte paper reflecting only the room light, with a plain blank face: coin rims, document faces, screens and vehicle sides carry no lettering, numerals or marks. This rule extends to every tag, card, document and photograph in the frame: each shows a blank or abstract paper surface, texture, or halftone pattern only, the way a coin or a screen does — never a person's face, portrait or headshot, printed or photographic, however small or partial.",
    "Diagram elements are flat matte paper shapes and ribbons, tape, rubber stamps, string and pins, stencilled arrows, paper bar charts, stacked sheets, grid paper, torn strips, paper clips, in cream, black, pale yellow or the ground's contrasting colour, with real paper texture and print dots.",
    "One consistent light from the upper left; each paper layer casts a small soft shadow.",
    "Layout: the headline chip owns the upper third of the frame and stays uncovered; subjects and diagrams occupy the lower two-thirds. When the frame opens on a previous composition, its elements slide off or are covered in the first second and the new headline lands on clear ground.",
    "Headline typography: one extra-bold sans-serif in black or cream, printed on a cream or black paper chip: one line, no wider than a third of the frame width, with safe margins, the chip sitting clear of the subjects. Letterforms are accurate, complete and stable from the frame they appear in; the chip is printed once and does not redraw. Chips carry lettering only — never an image, photograph, portrait or face. When the beat marks a hero number, that number alone may be printed larger, up to half the frame width.",
    "Compositions vary in scale from beat to beat: some show one oversized subject filling the frame, some a small subject alone on open ground, some several elements arranged as a diagram.",
    "Motion: elements enter fast with slight overshoot and a stable landing, then hold a clear reading window; one strongest focus at a time; the camera is locked; movement starts on the first frame and a small loop continues at the end; no empty frames.",
    "16:9, exactly 5 seconds, one composition, at most one crisp cut.",
    "Identity anchor: rough white torn edges on every cutout; small paper shadow from the upper-left light.",
  ];
}

const SCALE_TEXT: Record<Scale, string> = {
  oversized: "This composition is oversized: one subject fills most of the frame.",
  small: "This composition is small-scale: a single subject sits alone on open ground.",
  diagram: "This composition is a diagram: several elements are arranged together.",
};

export function audioBlockA(line: string): string {
  const spoken = line.replace(/"/g, "'");
  return `AUDIO: One English narrator, warm, clear, natural, brisk but unhurried, never an advertising shout. Speak the following line exactly once, word for word, beginning on the first frame: "${spoken}". No other dialogue. Light paper-slap and tape sound effects beneath the voice; no music.`;
}

/** Default audio block: wordless. Saskia's narration is layered in the player. */
export const AUDIO_BLOCK_B =
  "AUDIO: No voice, no speech, no dialogue, no lyrics. Light paper-slap and tape sound effects only; no music.";

export function copyList(headline: string | null, tagText?: string | null): string {
  const parts: string[] = [];
  if (headline) {
    parts.push(`"${headline}"`);
  }
  if (tagText) {
    parts.push(`"${tagText}"`);
  }
  if (parts.length === 0) {
    return "ON-SCREEN TEXT: none. No text appears in frame.";
  }
  return `ON-SCREEN TEXT: ${parts.join(", ")}. Each string is printed complete and correct from its first visible frame and never changes. These are the only lettering in the frame.`;
}

/** WP8.1 §2: the connector line, identical wherever the scene's beats describe it. */
export function connectorLine(beat: Beat): string {
  return `Connector: a ${beat.connector.colour} ${beat.connector.kind} runs from ${beat.connector.from} to ${beat.connector.to}, in one direction, physically resting on the paper ground between them.`;
}

/** WP8.1 §3: only present on the one beat (if any) whose `tag` is non-null. */
export function tagLine(beat: Beat): string | null {
  if (!beat.tag) return null;
  return `Tag: one small round cream paper tag, the size of a coin, reads "${beat.tag.text}"; a short black line points from it at the connector.`;
}

export function beatBlock(beat: Beat, previousHandoff: string | null, clipSeconds: 5 | 10 | 15 = 5): string {
  const lines = [
    `BEAT`,
    `Ground: ${GROUND_NAMES[beat.ground]}.`,
    `Subjects: ${beat.subjects.join("; ")}.`,
    previousHandoff
      ? `Opens on ${previousHandoff}, carried over from the previous shot, which transforms as the action begins.`
      : `Opens cold on the ground colour; the first subject enters on the first frame.`,
    `Action: ${beat.action}`,
    `Ends holding on ${beat.handoff}.`,
    SCALE_TEXT[beat.scale],
    beat.headline
      ? beat.hero
        ? `Headline printed on a paper chip: "${beat.headline}". This is the hero beat: the number may print larger, up to half the frame width.`
        : `Headline printed on a paper chip: "${beat.headline}".`
      : `No headline.`,
    connectorLine(beat),
  ];
  const tagText = tagLine(beat);
  if (tagText) lines.push(tagText);
  // WP8: this shot's actual duration, from lib/config.ts's CLIP_SECONDS.
  // Stated here in the beat block, not in the numbered style sheet above
  // (that file's content is out of WP8's scope, owned by WP7) — this line
  // overrides the style sheet's stated "5 seconds" when it differs.
  if (clipSeconds !== 5) {
    lines.push(`Duration: this shot is exactly ${clipSeconds} seconds, not 5 (overrides the style sheet's stated length above).`);
  }
  return lines.join("\n");
}

export interface CompiledPrompt {
  prompt: string;
  styleSheetVersion: string;
  voice: Voice;
}

/**
 * Compile one beat into a clip prompt, in the order the brief fixes:
 * style sheet → beat (ground, subjects, action, handoff, headline) → copy
 * list → audio block. Identical for CHAIN=on and off; only the image
 * conditioning differs.
 */
export function compilePrompt(args: {
  beat: Beat;
  voice: Voice;
  previousHandoff: string | null;
  /** WP8/WP8.1: CLIP_SECONDS (lib/config.ts). Defaults to 5, the CLAUDE.md baseline. 15 uses compileScenePrompt instead, not this function. */
  clipSeconds?: 5 | 10;
}): CompiledPrompt {
  const { beat, voice, previousHandoff, clipSeconds = 5 } = args;
  const sheet = styleSheet(beat.ground)
    .map((line, i) => `${i + 1}. ${line}`)
    .join("\n");
  const audio = voice === "native" ? audioBlockA(beat.line) : AUDIO_BLOCK_B;
  const prompt = [
    `TESSERA STYLE SHEET`,
    sheet,
    ``,
    beatBlock(beat, previousHandoff, clipSeconds),
    ``,
    copyList(beat.headline, beat.tag?.text ?? null),
    ``,
    audio,
  ].join("\n");
  return { prompt, styleSheetVersion: STYLE_SHEET_VERSION, voice };
}

/** Seconds a section for beat index `i` (0-based) within a scene starts at. WP8.1's fixed-5s-per-beat timing; used as the fallback when voice-led timing (WP8.2) is unavailable. */
export function sceneOffsetSeconds(i: number): number {
  return i * 5;
}

/**
 * WP8.2: the accepted range for fal's `duration` input on
 * minimax/h3-max-turbo/{text,image}-to-video, found empirically —
 * `scripts/probe-duration.mts`, run 2026-09-07 against the real API (the
 * published schema documents only `duration: integer, default 5`, no
 * min/max/step). 4s and every value from 16s up returned HTTP 422
 * (Unprocessable Entity) before any render started; every integer 5-15
 * rendered, each at (very close to, not exactly) its requested length —
 * e.g. requested 11 measured 11.55s, requested 15 measured 15.10s. Not an
 * enum restricted to {5,10,15}: 6, 11 and 13 all rendered too.
 */
export const FAL_DURATION_MIN = 5;
export const FAL_DURATION_MAX = 15;

/**
 * WP8.2 follow-up: a scene whose own narration exceeds this many seconds
 * gets split at a beat boundary into two (or, recursively, more) chained
 * clips instead of one clip whose requested duration would have to be
 * clamped to FAL_DURATION_MAX. Set below FAL_DURATION_MAX so that even
 * after CLIP_AIR_SECONDS (1.0s) is added and rounded up, a group at or
 * under budget requests at most FAL_DURATION_MAX (14 + 1.0 -> ceil ->
 * 15) — a split scene should never itself need clamping.
 */
export const SCENE_AUDIO_BUDGET_SECONDS = 14;

/**
 * WP8.2 follow-up: split a scene's beats (and their parallel per-beat
 * audio durations) at a beat boundary into contiguous groups, each at or
 * under `budget` seconds of its own narration — or a single beat, if one
 * beat alone already exceeds budget (nothing left to split further). The
 * split point is chosen to minimize the larger of the two resulting
 * groups' own narration totals (not just beat count), recursing into
 * either side that still exceeds budget. A scene within budget already
 * (the common case) returns unchanged, as its own single group.
 *
 * Generic over the caller's own per-beat item shape (`lib/programme.ts`'s
 * `{n, beat, warnings}` and `scripts/render.mts`'s identical shape both
 * use this as-is) — `durations[i]` must correspond to `items[i]`.
 */
export function splitSceneByAudioBudget<T>(items: T[], durations: number[], budget: number = SCENE_AUDIO_BUDGET_SECONDS): T[][] {
  if (items.length <= 1) return [items];
  const total = durations.reduce((sum, d) => sum + d, 0);
  if (total <= budget) return [items];

  let bestSplit = 1;
  let bestMax = Infinity;
  let prefix = 0;
  for (let k = 1; k < items.length; k += 1) {
    prefix += durations[k - 1];
    const candidateMax = Math.max(prefix, total - prefix);
    if (candidateMax < bestMax) {
      bestMax = candidateMax;
      bestSplit = k;
    }
  }

  const left = splitSceneByAudioBudget(items.slice(0, bestSplit), durations.slice(0, bestSplit), budget);
  const right = splitSceneByAudioBudget(items.slice(bestSplit), durations.slice(bestSplit), budget);
  return [...left, ...right];
}

/** One beat's on-screen section, seconds within the shot's own clip. */
export interface SceneSection {
  start: number;
  end: number;
}

export interface VoiceLedTiming {
  sections: SceneSection[];
  /** Seconds requested of fal for the whole scene clip — integer, clamped to FAL_DURATION_MIN/MAX. */
  requestedDuration: number;
  /** Sum of the beats' own narrated-audio durations, before the 1.0s air and the clamp. */
  totalNarrationSeconds: number;
  /** True when totalNarrationSeconds + 1.0s, rounded up, fell outside fal's accepted range and had to be clamped. */
  clamped: boolean;
}

const SECTION_LEAD_SECONDS = 0.4;
const CLIP_AIR_SECONDS = 1.0;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * WP8.2 items 2-3: turn each beat's own narrated-audio duration (from
 * ElevenLabs, per-beat, already measured from the actually-cut mp3 —
 * app/api/voice/route.ts's `durationSeconds`, populated the same way
 * whether the split came from timestamps or the silence-gap fallback) into
 * the scene's on-screen section timecodes and the clip's requested
 * duration.
 *
 * Each section runs from the end of the previous line to the end of its
 * own line, plus a lead that grows by 0.4s at every boundary crossed (so
 * the picture holds a beat longer than Saskia's own line at each cut,
 * compensating for the model's tendency to front-load — brief's own
 * example: [0-d1+0.4s], [d1+0.4-d1+d2+0.8s], ...). Beat 1 always starts at
 * 0. The last section's end is pinned to the clip's actual requested
 * duration (not the boundary formula) since that is the true length of the
 * clip the video model is being asked to fill, and the two numbers can
 * differ once the requested duration is clamped to fal's range.
 *
 * The clip's requested duration is the total narration plus 1.0s of
 * trailing air, rounded up to the whole second fal's `duration` field
 * requires, clamped to FAL_DURATION_MIN/MAX above.
 */
export function computeVoiceLedTiming(durations: number[]): VoiceLedTiming {
  const totalNarrationSeconds = durations.reduce((sum, d) => sum + d, 0);
  const raw = Math.ceil(totalNarrationSeconds + CLIP_AIR_SECONDS);
  const requestedDuration = Math.min(FAL_DURATION_MAX, Math.max(FAL_DURATION_MIN, raw));
  const clamped = requestedDuration !== raw;

  const sections: SceneSection[] = [];
  let cumulative = 0;
  let start = 0;
  for (let i = 0; i < durations.length; i += 1) {
    cumulative += durations[i];
    const isLast = i === durations.length - 1;
    const end = isLast ? Math.max(requestedDuration, start + 0.5) : cumulative + SECTION_LEAD_SECONDS * (i + 1);
    sections.push({ start: round1(start), end: round1(end) });
    start = end;
  }
  return { sections, requestedDuration, totalNarrationSeconds, clamped };
}

/**
 * WP8.1 §1: compile a whole SCENE (2-3 beats) into one fal request, in the
 * reference prompt's own shape (briefs/reference/reference-prompt.md) —
 * one SCENE AND STORY overview, then one named, timecoded section per
 * beat, then one combined copy list covering every beat's headline (and
 * tag, if any) in order, then the audio block. Style sheet is the same
 * numbered list as the single-beat path (beat 1's ground: a scene holds
 * one ground throughout, so any beat's would do); its duration line always
 * needs the override since a scene is never 5s.
 *
 * WP8.2: `sections`/`clipSeconds`, when passed, override the fixed 5s-per-
 * beat timing below with voice-led timecodes (computeVoiceLedTiming) and
 * the audio-derived total duration. Omitted (or when voice-led timing
 * could not be computed — native voice, or Saskia's per-beat durations
 * were unavailable), this falls back to WP8.1's original fixed-5s-per-beat
 * behaviour unchanged.
 */
export function compileScenePrompt(args: {
  beats: Beat[];
  voice: Voice;
  previousHandoff: string | null;
  sections?: SceneSection[];
  clipSeconds?: number;
}): CompiledPrompt {
  const { beats, voice, previousHandoff } = args;
  const sections_ = args.sections ?? beats.map((_, i) => ({ start: sceneOffsetSeconds(i), end: sceneOffsetSeconds(i) + 5 }));
  const clipSeconds = args.clipSeconds ?? beats.length * 5;
  const sheet = styleSheet(beats[0].ground)
    .map((line, i) => `${i + 1}. ${line}`)
    .join("\n");

  const sections = beats.map((beat, i) => {
    const { start, end } = sections_[i];
    const opens =
      i === 0
        ? previousHandoff
          ? `Opens on ${previousHandoff}, carried over from the previous scene, which transforms as the action begins.`
          : `Opens cold on the ground colour; the first subject enters on the first frame.`
        : `Opens on ${beats[i - 1].handoff}, carried over from the previous section, which transforms as this section's action begins.`;
    const lines = [
      `[${start.toFixed(1)}-${end.toFixed(1)}s] SECTION ${i + 1}`,
      `Subjects: ${beat.subjects.join("; ")}.`,
      opens,
      `Action: ${beat.action}`,
      `Ends holding on ${beat.handoff}.`,
      SCALE_TEXT[beat.scale],
      beat.headline
        ? beat.hero
          ? `Headline printed on a paper chip: "${beat.headline}". This is the hero beat: the number may print larger, up to half the frame width.`
          : `Headline printed on a paper chip: "${beat.headline}".`
        : `No headline this section.`,
      connectorLine(beat),
    ];
    const tagText = tagLine(beat);
    if (tagText) lines.push(tagText);
    return lines.join("\n");
  });

  // TEXT CONTROL, reference-prompt style: every headline and the tag (if
  // any), listed once, in the order they appear, with the exclusivity rule
  // spelled out so only the current section's own text is on screen.
  const headlineOrder = beats.map((b) => b.headline).filter((h): h is string => Boolean(h));
  const tagOrder = beats.map((b) => b.tag?.text).filter((t): t is string => Boolean(t));
  const textOrder = [...headlineOrder, ...tagOrder];
  const copy =
    textOrder.length === 0
      ? "ON-SCREEN TEXT: none. No text appears in any section."
      : `ON-SCREEN TEXT, strictly in this order: ${textOrder.map((t) => `"${t}"`).join(", then ")}. Only the current section's own text is visible at any time; each string is printed complete and correct from its first visible frame and never changes; these are the only lettering in the frame.`;

  const audio = voice === "native" ? audioBlockA(beats.map((b) => b.line).join(" ")) : AUDIO_BLOCK_B;

  const prompt = [
    `TESSERA STYLE SHEET`,
    sheet,
    ``,
    `Duration: this is one continuous ${clipSeconds}-second generation covering ${beats.length} sections back to back (overrides the style sheet's stated length above), not ${beats.length} separate clips.`,
    ``,
    `SCENE`,
    `One scene, ${beats.length} sections, cutting or continuing at each section boundary as each section's own action describes. One held ground colour throughout: ${GROUND_NAMES[beats[0].ground]}.`,
    ``,
    sections.join("\n\n"),
    ``,
    copy,
    ``,
    audio,
  ].join("\n");
  return { prompt, styleSheetVersion: STYLE_SHEET_VERSION, voice };
}

/**
 * Key phrases per style-sheet line, for the report's "which lines survived
 * in expanded_prompt" check. A line survives when any of its phrases (or a
 * close paraphrase) appears in the rewritten prompt.
 */
export const STYLE_SHEET_SIGNALS: string[][] = [
  ["paper collage", "collage", "magazine"],
  ["block-colour", "block color", "flat ground", "solid ground", "lime green", "pale cyan", "soft violet", "deep magenta"],
  ["halftone", "torn-paper", "torn paper", "cutout", "blank face", "unmarked", "reflecting only the room light", "no glow", "no neon", "no halo", "never a person's face", "never a face", "blank paper texture"],
  ["paper shapes", "ribbons", "tape", "print dots", "paper texture", "rubber stamp", "stencilled arrow", "bar chart", "stacked sheets", "grid paper", "torn strip", "paper clip"],
  ["upper-left light", "upper left", "paper-layer shadow", "paper shadow"],
  ["headline chip", "upper third", "lower two-thirds", "clear ground"],
  ["extra-bold", "sans-serif", "paper chip", "headline", "third of the frame", "hero", "lettering only", "only lettering"],
  ["oversized", "small-scale", "open ground", "diagram", "vary in scale"],
  ["overshoot", "stable landing", "reading window", "camera is locked", "first frame"],
  ["16:9", "5 seconds", "one composition", "crisp cut"],
  ["torn-paper edges", "torn edges", "identity anchor", "upper-left"],
];
