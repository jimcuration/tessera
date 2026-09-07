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
 *    selected (lib/palette.ts, `PALETTE=a|b|c`); the reference has no
 *    single face sentence to swap, so its character-description sentences
 *    are replaced outright by CLAUDE.md rule 6's wording, carried over
 *    unchanged from v0.3's line 3 ("never a person's face, portrait or
 *    headshot..."). Everything else the brief marks explicitly out of
 *    scope (materials — halftone, torn edges — stay; headline width cap
 *    and the hero exception stay; 12-word lines, `scene`, `hand`,
 *    `delivery`, source pointers all stay, lib/translator.ts unchanged
 *    beyond the transition-rule edit above).
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
 * so v0.6 keeps it exactly where the reference puts it and the WP7 report
 * measures whether it survives.
 */

import type { Beat, Ground, Scale } from "./translator";
import { PALETTES, resolveGround, type PaletteId, type Swatch } from "./palette";

export const STYLE_SHEET_VERSION = "style-sheet-v0.6";

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

/** The seven lines of Tessera Style Sheet v0.6, palette- and ground-resolved. */
export function styleSheet(ground: Ground, palette: PaletteId): string[] {
  const current: Swatch = resolveGround(ground, palette);
  const def = PALETTES[palette];
  return [
    `${def.mainColorsPhrase} are the main colours, with pure black and ${def.lightChipName} for typography and printed photographs; each composition holds one strong dominant background colour rather than an all-over rainbow. Subjects are black-and-white halftone photographic cutouts with rough white torn-paper borders and consistent appearance from shot to shot: objects, machines, buildings, maps, coins, screens and vehicles that carry no lettering, numerals, symbols or liveries, and the same anonymous paper hand recurring as the one actor throughout. Every cutout shows a plain, unmarked surface — never a person's face, portrait or headshot, printed or photographic, however small or partial, on any tag, card, document or photograph in the frame. Bold magazine collage and refined 2D motion design: real paper texture, print dots, a little tape and small paper-layer shadows from consistent upper-left light. Every surface is flat matte printed paper: no glow, no neon, no bloom, no light halos, no luminous or backlit edges, nothing emits light anywhere in the frame. Not glossy plastic 3D animation or a live-action presenter.`,
    `One flat block-colour paper ground fills the frame: ${current.name} ${current.hex}. The ground is a single unbroken colour.`,
    `Diagram elements are flat matte paper shapes and ribbons, tape, rubber stamps, string and pins, stencilled arrows, paper bar charts, stacked sheets, grid paper, torn strips, hole-punched tags, paper clips, ${def.ribbonText(current)}, with real paper texture and print dots.`,
    `Cuts are shape-match cuts: the closing shape of one composition becomes the opening shape of the next.`,
    `Headline typography: one extra-bold sans-serif ${def.chipText(current)}, one line, no wider than a third of the frame width, with safe margins, the chip sitting clear of the subjects. Letterforms are accurate, complete and stable from the frame they appear in; the chip is printed once and does not redraw. When the beat marks a hero number, that number alone may be printed larger, up to half the frame width.`,
    `High energy comes from major changes of scale, shape-matching and typographic composition, not incessant camera shake: some compositions show one oversized subject filling the frame, some a small subject alone on open ground, some several elements arranged as a diagram. Each beat forms its composition rapidly, then preserves a short clear reading window. Objects enter with fast deceleration, a slight overshoot and a stable landing; headlines retain clear letterforms after landing. Cause and effect happen sequentially, with one strongest visual focus at a time; the camera is locked. Movement starts on the first frame, and a small loop continues at the end. No empty waiting frames.`,
    `16:9, exactly 5 seconds, one composition, at most one crisp cut.`,
  ];
}

export function audioBlockA(line: string): string {
  const spoken = line.replace(/"/g, "'");
  return `AUDIO: One English narrator, warm, clear, natural, brisk but unhurried, never an advertising shout. Speak the following line exactly once, word for word, beginning on the first frame: "${spoken}". No other dialogue. Light paper-slap and tape sound effects beneath the voice; no music.`;
}

/** Default audio block: wordless. Saskia's narration is layered in the player. */
export const AUDIO_BLOCK_B =
  "AUDIO: No voice, no speech, no dialogue, no lyrics. Light paper-slap and tape sound effects only; no music.";

export function copyList(headline: string | null): string {
  if (!headline) {
    return "ON-SCREEN TEXT: none. No text appears in frame.";
  }
  return `ON-SCREEN TEXT: "${headline}". This string is printed complete and correct from its first visible frame and never changes. It is the only lettering in the frame.`;
}

export function beatBlock(beat: Beat, previousHandoff: string | null, palette: PaletteId): string {
  const ground = resolveGround(beat.ground, palette);
  const lines = [
    `BEAT`,
    `Ground: ${ground.name} ${ground.hex}.`,
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
  ];
  return lines.join("\n");
}

const SCALE_TEXT: Record<Scale, string> = {
  oversized: "This composition is oversized: one subject fills most of the frame.",
  small: "This composition is small-scale: a single subject sits alone on open ground.",
  diagram: "This composition is a diagram: several elements are arranged together.",
};

export interface CompiledPrompt {
  prompt: string;
  styleSheetVersion: string;
  voice: Voice;
  palette: PaletteId;
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
  palette?: PaletteId;
}): CompiledPrompt {
  const { beat, voice, previousHandoff, palette = "a" } = args;
  const sheet = styleSheet(beat.ground, palette)
    .map((line, i) => `${i + 1}. ${line}`)
    .join("\n");
  const audio = voice === "native" ? audioBlockA(beat.line) : AUDIO_BLOCK_B;
  const prompt = [
    `TESSERA STYLE SHEET`,
    sheet,
    ``,
    beatBlock(beat, previousHandoff, palette),
    ``,
    copyList(beat.headline),
    ``,
    audio,
  ].join("\n");
  return { prompt, styleSheetVersion: STYLE_SHEET_VERSION, voice, palette };
}

/**
 * Key phrases per style-sheet line, for the report's "which lines survived
 * in expanded_prompt" check (v0.6, 7 lines; mirrored by hand in
 * scripts/report.mjs, same as v0.3's 11-line list was).
 */
export const STYLE_SHEET_SIGNALS: string[][] = [
  ["halftone", "torn-paper", "torn paper", "cutout", "unmarked", "no glow", "no neon", "no halo", "never a person's face", "never a face", "collage", "magazine", "paper-layer shadow", "upper-left"],
  ["block-colour", "block color", "flat ground", "solid ground", "single-color", "single colour", "single-colour", "single unbroken", "unbroken block", "block of", "paper ground", "paper background", "ground colour", "ground color"],
  ["paper shapes", "ribbons", "tape", "print dots", "rubber stamp", "stencilled arrow", "bar chart", "stacked sheets", "grid paper", "torn strip", "hole-punched", "paper clip"],
  ["shape-match", "closing shape", "opening shape", "match cut"],
  ["extra-bold", "sans-serif", "paper chip", "headline", "third of the frame", "hero"],
  ["overshoot", "stable landing", "reading window", "camera is locked", "first frame", "major changes of scale", "static shot"],
  ["16:9", "5 seconds", "one composition", "crisp cut"],
];
