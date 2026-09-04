/**
 * The prompt compiler: STYLE SHEET + BEAT + COPY LIST + AUDIO BLOCK.
 *
 * Tessera Style Sheet v0.2 is a numbered list on purpose: fal's prompt
 * rewriter copies numbered lists and paraphrases prose. Keep it numbered.
 * v0.1 measured that fal's rewriter drops any line phrased as a
 * prohibition (0/18 survival on "no brands" and "numbers never count up",
 * WP0 report §6) while descriptive lines survive at 16-18/18; v0.2 states
 * everything as a description of the world a prohibition would otherwise
 * name, and appends a short prohibition only where description alone
 * would not do. Line 7 is new: a layout law so a chained beat's inherited
 * composition clears before the new headline lands (WP0 found chaining
 * occluded 2 of 6 headlines). The four grounds are named, never hex:
 * palette values are approximate until Jim confirms, and the video model
 * reads names well.
 */

import type { Beat, Ground } from "./translator";

export const STYLE_SHEET_VERSION = "style-sheet-v0.2";

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
    "Subjects are black-and-white halftone photographic cutouts with rough white torn-paper edges: objects, machines, buildings, maps, coins, screens, vehicles, anonymous paper hands. Every cutout is a plain, unmarked object: calendar pages, documents, coins, screens and vehicles are blank and unprinted, with no lettering, numerals, symbols, liveries or marks on them.",
    "Diagram elements are flat matte paper shapes and ribbons in cream, black, pale yellow, or the ground's contrasting colour, with real paper texture, print dots and small pieces of tape.",
    "One consistent light from the upper left; each paper layer casts a small soft shadow.",
    "Every surface is matte printed paper reflecting only the room light: cutouts, chips, ribbons and ground all read as photographed paper, with the same flat finish edge to edge. No glow, neon, bloom or halo anywhere.",
    "Layout: the headline chip owns the upper third of the frame and stays uncovered; subjects and diagrams occupy the lower two-thirds. When the frame opens on a previous composition, its elements slide off or are covered in the first second and the new headline lands on clear ground.",
    "Headline typography: one extra-bold sans-serif in black or cream, printed on a cream or black paper chip, large, with safe margins. Letterforms are accurate, complete and stable from the frame they appear in; the chip is printed once and does not redraw.",
    "Motion: elements enter fast with slight overshoot and a stable landing, then hold a clear reading window; one strongest focus at a time; the camera is locked; movement starts on the first frame and a small loop continues at the end; no empty frames.",
    "16:9, exactly 5 seconds, one composition, at most one crisp cut.",
    "Identity anchor: rough white torn edges on every cutout; small paper shadow from the upper-left light.",
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
    beat.headline ? `Headline printed on a paper chip: "${beat.headline}".` : `No headline.`,
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
  ["halftone", "torn-paper", "torn paper", "cutout"],
  ["paper shapes", "ribbons", "tape", "print dots", "paper texture"],
  ["upper-left light", "upper left", "paper-layer shadow", "paper shadow"],
  ["flat matte", "no glow", "no neon", "nothing emits light", "not glossy", "no halo"],
  ["headline chip", "upper third", "lower two-thirds", "clear ground"],
  ["extra-bold", "sans-serif", "paper chip", "headline"],
  ["overshoot", "stable landing", "reading window", "camera is locked", "first frame"],
  ["16:9", "5 seconds", "one composition", "crisp cut"],
  ["torn-paper edges", "torn edges", "identity anchor", "upper-left"],
];
