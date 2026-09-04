/**
 * The prompt compiler: STYLE SHEET + BEAT + COPY LIST + AUDIO BLOCK.
 *
 * Tessera Style Sheet v0.1 is a numbered list on purpose: fal's prompt
 * rewriter copies numbered lists and paraphrases prose. Keep it numbered.
 * The four grounds are named, never hex: palette values are approximate
 * until Jim confirms, and the video model reads names well.
 */

import type { Beat, Ground } from "./translator";

export const STYLE_SHEET_VERSION = "style-sheet-v0.1";

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

/** The twelve lines, verbatim from CLAUDE.md, with line 2 filled by the beat. */
export function styleSheet(ground: Ground): string[] {
  return [
    "Modern editorial paper collage. Bold magazine composition, refined 2D motion design.",
    `One dominant flat block-colour background for the whole shot: ${GROUND_NAMES[ground]}. Never a rainbow, never a gradient.`,
    "Subjects are black-and-white halftone photographic cutouts with rough white torn-paper edges: objects, machines, buildings, maps, coins, screens, vehicles, anonymous paper hands. Never a recognisable person's face.",
    "Diagram elements are flat matte paper shapes and ribbons in cream, black, pale yellow, or the background's contrasting colour. Real paper texture, print dots, small tape pieces.",
    "Consistent upper-left light. Small paper-layer shadows only.",
    "Everything is flat matte printed paper. No glow, no neon, no bloom, no halos, no luminous edges. Nothing emits light. Not glossy 3D. Not live action.",
    "Headline typography: one extra-bold sans-serif, black or cream, printed on paper chips, large, safe margins. English spelling and letterforms accurate and stable. Only the headline text in the copy list, nothing else.",
    "Motion: elements enter fast with slight overshoot and a stable landing, then hold a clear reading window. One strongest visual focus at a time. No camera shake. Movement starts on the first frame; a small loop continues at the end. No empty frames.",
    "Numbers, when specified, are printed complete from their first visible frame. Never counting up, never morphing, never redrawn.",
    "No brands, logos, watermarks, or text beyond the copy list.",
    "16:9, exactly 5 seconds, one composition, at most one crisp cut.",
    "Identity anchor: rough white torn-paper edges on every cutout; small paper shadow from upper-left light.",
  ];
}

export function audioBlockA(line: string): string {
  const spoken = line.replace(/"/g, "'");
  return `AUDIO: One English narrator, warm, clear, natural, brisk but unhurried, never an advertising shout. Speak the following line exactly once, word for word, beginning on the first frame: "${spoken}". No other dialogue. Light paper-slap and tape sound effects beneath the voice; no music.`;
}

export const AUDIO_BLOCK_B =
  "AUDIO: No voice, no speech, no dialogue, no lyrics. Light paper-slap and tape sound effects only; no music.";

export function copyList(headline: string | null): string {
  if (!headline) {
    return "COPY LIST: none. No text appears in frame.";
  }
  return `COPY LIST: "${headline}". Exact strings; nothing else appears in frame.`;
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
  ["block-colour", "block color", "flat background", "solid background", "lime green", "pale cyan", "soft violet", "deep magenta"],
  ["halftone", "torn-paper", "torn paper", "cutout"],
  ["paper shapes", "ribbons", "tape", "print dots", "paper texture"],
  ["upper-left light", "upper left", "paper-layer shadow", "paper shadow"],
  ["flat matte", "no glow", "no neon", "nothing emits light", "not glossy"],
  ["extra-bold", "sans-serif", "paper chip", "headline"],
  ["overshoot", "stable landing", "reading window", "no camera shake", "first frame"],
  ["printed complete", "never counting", "never morphing"],
  ["no brands", "no logos", "watermark"],
  ["16:9", "5 seconds", "one composition", "crisp cut"],
  ["torn-paper edges", "torn paper edges", "identity anchor", "upper-left"],
];
