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

export function copyList(headline: string | null): string {
  if (!headline) {
    return "ON-SCREEN TEXT: none. No text appears in frame.";
  }
  return `ON-SCREEN TEXT: "${headline}". This string is printed complete and correct from its first visible frame and never changes. It is the only lettering in the frame.`;
}

export function beatBlock(beat: Beat, previousHandoff: string | null): string {
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
  ];
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
}): CompiledPrompt {
  const { beat, voice, previousHandoff } = args;
  const sheet = styleSheet(beat.ground)
    .map((line, i) => `${i + 1}. ${line}`)
    .join("\n");
  const audio = voice === "native" ? audioBlockA(beat.line) : AUDIO_BLOCK_B;
  const prompt = [
    `TESSERA STYLE SHEET`,
    sheet,
    ``,
    beatBlock(beat, previousHandoff),
    ``,
    copyList(beat.headline),
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
