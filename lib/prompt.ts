/**
 * The prompt compiler: STYLE SHEET + BEAT + COPY LIST + AUDIO BLOCK.
 *
 * Tessera Style Sheet v0.6 (WP7). Robin: "completely replicate that
 * reference style, retain the transitions, pull the colours into a more
 * modern palette" (briefs/WP7.md), reading from
 * briefs/reference/reference-prompt.md — the actual prompt behind
 * `halftone-science-short.mp4`. Two things changed from v0.3:
 *
 * 1. Transitions restored to WP0 behaviour. v0.3's line 6 (headline chip
 *    owns the upper third and stays uncovered; previous elements slide off
 *    or are covered in the first second) is deleted outright, sheet and
 *    translator (lib/translator.ts) both — that line was WP3/WP5's fix for
 *    headline occlusion, but it fights the image-to-video chain: WP0 found
 *    chaining inherits the previous composition, which is what makes the
 *    cut seamless and is also what covered beat 1's headline in that report
 *    (WP0-report.md §7). WP7 accepts the occlusion rather than instruct
 *    against it (the brief: "do not add rules to prevent it") and instead
 *    states the transition as a positive practice, verbatim from the
 *    brief: a new line for shape-match cuts.
 * 2. The surface and motion lines are replaced with the reference prompt's
 *    own VISUAL SYSTEM and MOTION PRINCIPLES paragraphs (kept as one
 *    numbered line each — fal's rewriter copies numbered lists, WP0
 *    report §6, so the list stays numbered even though each item is now a
 *    full paragraph, same as v0.3's lines 3/4/6/7/9 already were).
 *    Adapted, exactly as the brief specifies: the reference's one named
 *    character is removed (subjects are objects, machines, buildings,
 *    maps, coins, screens, vehicles that carry no livery — folding in
 *    WP6.1's finding that the video model invents an airline livery on an
 *    unbranded aircraft cutout unless told it carries none, WP6.1-report.md
 *    §3 — and the anonymous paper hand as the recurring actor); the
 *    reference's fixed colour names are replaced by whichever palette is
 *    selected (lib/palette.ts, `PALETTE=a|b|c`, unset by default — see
 *    below); the reference has no single face sentence to swap, so its
 *    character-description sentences are replaced outright by CLAUDE.md
 *    rule 6's wording, carried over unchanged from v0.3's line 3 ("never a
 *    person's face, portrait or headshot..."). Everything else the brief
 *    marks explicitly out of scope (materials — halftone, torn edges —
 *    stay; headline width cap and the hero exception stay; 12-word lines,
 *    `scene`, `hand`, `delivery`, source pointers all stay, lib/translator.ts
 *    unchanged beyond the transition-rule edit above).
 *
 * PALETTE default (merged to main): Robin asked that leaving `PALETTE`
 * unset keep the original v0.3 four named grounds (lime green, pale cyan,
 * soft violet, deep magenta — no hex) rather than defaulting into palette
 * A's "Electric Curation" branding. `lib/palette.ts#DEFAULT_PALETTE` is
 * that state; `PALETTE=a|b|c` remains available as an explicit opt-in to
 * test one of WP7's three named palettes.
 *
 * v0.3 background, still true of the parts of the sheet that are unchanged:
 * WP0 found fal's rewriter drops any line phrased as a pure prohibition
 * (0/18 survival on "no brands" and "numbers never count up", WP0 report
 * §6) while descriptive lines survive; v0.2 stated everything as a
 * description of the world, with a prohibition appended only where a
 * description alone would not do; v0.2's line 6 ("no glow, neon, bloom")
 * kept a literal prohibition tail and survived *worse* than v0.1 (7/18 vs
 * 11/18, WP2 report §6), so v0.3 folded it into a description instead. The
 * reference prompt's own VISUAL SYSTEM paragraph ends on a similar
 * prohibition clause ("no glow, no neon, no bloom..."), but folded inside
 * a long descriptive paragraph rather than standing as its own numbered
 * line — the same shape as the v0.2-to-v0.3 fix, not a regression of it —
 * so v0.6 keeps it exactly where the reference puts it.
 *
 * WP5 built a v0.4 of this file (deep/saturated grounds held per scene,
 * cream-or-pale-yellow-on-black headline+label type, and three new lines
 * for accumulation, the recurring hand, and a hot ribbon colour) and
 * measured it in briefs/WP5-report.md. Merging WP5 to main, Robin asked
 * to keep the translator's `scene`/`hand`/bookend additions but restore
 * this file to v0.3 and drop the `labels` field they came with — so
 * `Beat` still carries `scene` and `hand` (lib/translator.ts), and v0.6
 * above builds on that restored v0.3, not on WP5's v0.4.
 */

import type { Beat, Ground, Scale } from "./translator";
import { paletteDef, resolveGround, type PaletteId, type Swatch } from "./palette";

export const STYLE_SHEET_VERSION = "style-sheet-v0.6";

/**
 * WP8.2 changed how a scene's on-screen timing is computed
 * (computeVoiceLedTiming, below) without touching the style sheet or
 * translator. Recordings made before that change carry no per-section
 * timecodes built from Saskia's real narration lengths, so they must not be
 * offered as cache hits alongside recordings made after — bump this string
 * whenever the timing computation changes and it needs to invalidate the
 * cache. Threaded through FindCacheInput/session.json the same way
 * TRANSLATOR_VERSION and STYLE_SHEET_VERSION are (lib/cache.ts).
 */
export const TIMING_VERSION = "timing-v1-voice-led";

export type Voice = "native" | "saskia";

/**
 * Approximate hex for the interface only (the cursor blinks in the next
 * beat's ground colour, components/player.tsx) — the player is out of
 * scope for WP7, so these stay the v0.3 values regardless of `PALETTE`.
 * Not used in prompts. Approximate until Jim confirms.
 */
export const GROUND_HEX: Record<Ground, string> = {
  lime: "#C6F04C",
  cyan: "#BDEBF2",
  violet: "#C9B6F5",
  magenta: "#C2177A",
};

/**
 * The seven lines of Tessera Style Sheet v0.6, palette- and ground-resolved.
 * `palette` is null for the unset default (the original v0.3 four named
 * grounds, no hex) or one of WP7's explicit A/B/C palettes
 * (lib/palette.ts).
 */
export function styleSheet(ground: Ground, palette: PaletteId | null): string[] {
  const def = paletteDef(palette);
  const current: Swatch = resolveGround(ground, palette);
  const groundLabel = current.hex ? `${current.name} ${current.hex}` : current.name;
  return [
    `${def.mainColorsPhrase} are the main colours, with pure black and ${def.lightChipName} for typography and printed photographs; each composition holds one strong dominant background colour rather than an all-over rainbow. Subjects are black-and-white halftone photographic cutouts with rough white torn-paper borders and consistent appearance from shot to shot: objects, machines, buildings, maps, coins, screens and vehicles that carry no lettering, numerals, symbols or liveries, and the same anonymous paper hand recurring as the one actor throughout. Every cutout shows a plain, unmarked surface — never a person's face, portrait or headshot, printed or photographic, however small or partial, on any tag, card, document or photograph in the frame. Bold magazine collage and refined 2D motion design: real paper texture, print dots, a little tape and small paper-layer shadows from consistent upper-left light. Every surface is flat matte printed paper: no glow, no neon, no bloom, no light halos, no luminous or backlit edges, nothing emits light anywhere in the frame. Not glossy plastic 3D animation or a live-action presenter.`,
    `One flat block-colour paper ground fills the frame: ${groundLabel}. The ground is a single unbroken colour.`,
    `Diagram elements are flat matte paper shapes and ribbons, tape, rubber stamps, string and pins, stencilled arrows, paper bar charts, stacked sheets, grid paper, torn strips, hole-punched tags, paper clips, ${def.ribbonText(current)}, with real paper texture and print dots.`,
    `Cuts are shape-match cuts: the closing shape of one composition becomes the opening shape of the next.`,
    `Headline typography: one extra-bold sans-serif ${def.chipText(current)}, one line, no wider than a third of the frame width, with safe margins, the chip sitting clear of the subjects. Letterforms are accurate, complete and stable from the frame they appear in; the chip is printed once and does not redraw. Chips carry lettering only — never an image, photograph, portrait or face. When the beat marks a hero number, that number alone may be printed larger, up to half the frame width.`,
    `High energy comes from major changes of scale, shape-matching and typographic composition, not incessant camera shake: some compositions show one oversized subject filling the frame, some a small subject alone on open ground, some several elements arranged as a diagram. Each beat forms its composition rapidly, then preserves a short clear reading window. Objects enter with fast deceleration, a slight overshoot and a stable landing; headlines retain clear letterforms after landing. Cause and effect happen sequentially, with one strongest visual focus at a time; the camera is locked. Movement starts on the first frame, and a small loop continues at the end. No empty waiting frames.`,
    `16:9, exactly 5 seconds, one composition, at most one crisp cut.`,
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

export function beatBlock(beat: Beat, previousHandoff: string | null, palette: PaletteId | null, clipSeconds: 5 | 10 | 15 = 5): string {
  const ground = resolveGround(beat.ground, palette);
  const groundLabel = ground.hex ? `${ground.name} ${ground.hex}` : ground.name;
  const lines = [
    `BEAT`,
    `Ground: ${groundLabel}.`,
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
  palette: PaletteId | null;
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
  /** WP7: PALETTE (lib/config.ts). Defaults to null — the unset default (v0.3's four named grounds). */
  palette?: PaletteId | null;
}): CompiledPrompt {
  const { beat, voice, previousHandoff, clipSeconds = 5, palette = null } = args;
  const sheet = styleSheet(beat.ground, palette)
    .map((line, i) => `${i + 1}. ${line}`)
    .join("\n");
  const audio = voice === "native" ? audioBlockA(beat.line) : AUDIO_BLOCK_B;
  const prompt = [
    `TESSERA STYLE SHEET`,
    sheet,
    ``,
    beatBlock(beat, previousHandoff, palette, clipSeconds),
    ``,
    copyList(beat.headline, beat.tag?.text ?? null),
    ``,
    audio,
  ].join("\n");
  return { prompt, styleSheetVersion: STYLE_SHEET_VERSION, voice, palette };
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
  /** WP7: PALETTE (lib/config.ts). Defaults to null — the unset default (v0.3's four named grounds). */
  palette?: PaletteId | null;
}): CompiledPrompt {
  const { beats, voice, previousHandoff, palette = null } = args;
  const sections_ = args.sections ?? beats.map((_, i) => ({ start: sceneOffsetSeconds(i), end: sceneOffsetSeconds(i) + 5 }));
  const clipSeconds = args.clipSeconds ?? beats.length * 5;
  const sheet = styleSheet(beats[0].ground, palette)
    .map((line, i) => `${i + 1}. ${line}`)
    .join("\n");
  const sceneGround = resolveGround(beats[0].ground, palette);
  const sceneGroundLabel = sceneGround.hex ? `${sceneGround.name} ${sceneGround.hex}` : sceneGround.name;

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
    `One scene, ${beats.length} sections, cutting or continuing at each section boundary as each section's own action describes. One held ground colour throughout: ${sceneGroundLabel}.`,
    ``,
    sections.join("\n\n"),
    ``,
    copy,
    ``,
    audio,
  ].join("\n");
  return { prompt, styleSheetVersion: STYLE_SHEET_VERSION, voice, palette };
}

/**
 * Key phrases per style-sheet line, for the report's "which lines survived
 * in expanded_prompt" check (v0.6, 7 lines; mirrored by hand in
 * scripts/report.mjs, same as v0.3's 11-line list was). A line survives
 * when any of its phrases (or a close paraphrase) appears in the rewritten
 * prompt.
 */
export const STYLE_SHEET_SIGNALS: string[][] = [
  ["halftone", "torn-paper", "torn paper", "cutout", "unmarked", "no glow", "no neon", "no halo", "never a person's face", "never a face", "collage", "magazine", "paper-layer shadow", "upper-left"],
  ["block-colour", "block color", "flat ground", "solid ground", "single-color", "single colour", "single-colour", "single unbroken", "unbroken block", "block of", "paper ground", "paper background", "ground colour", "ground color"],
  ["paper shapes", "ribbons", "tape", "print dots", "rubber stamp", "stencilled arrow", "bar chart", "stacked sheets", "grid paper", "torn strip", "hole-punched", "paper clip"],
  ["shape-match", "closing shape", "opening shape", "match cut"],
  ["extra-bold", "sans-serif", "paper chip", "headline", "third of the frame", "hero", "lettering only", "only lettering"],
  ["overshoot", "stable landing", "reading window", "camera is locked", "first frame", "major changes of scale", "static shot"],
  ["16:9", "5 seconds", "one composition", "crisp cut"],
];
