/**
 * The prompt compiler: STYLE SHEET + BEAT + COPY LIST + AUDIO BLOCK.
 *
 * Tessera Style Sheet v0.4 is a numbered list on purpose: fal's prompt
 * rewriter copies numbered lists and paraphrases prose. Keep it numbered.
 * v0.1 measured that fal's rewriter drops any line phrased as a
 * prohibition (0/18 survival on "no brands" and "numbers never count up",
 * WP0 report §6) while descriptive lines survive at 16-18/18; v0.2 states
 * everything as a description of the world a prohibition would otherwise
 * name. v0.3 folded the "no glow" prohibition into line 3 (it survived
 * *worse* than v0.1 as a standalone prohibition, WP2 report §6), widened
 * line 4's vocabulary, and capped headline width at a third of the frame
 * unless the beat is `hero`.
 *
 * v0.4 (WP5, watching briefs/reference/halftone-science-short.mp4): a
 * six-beat programme read as six disconnected clips. Line 2 (grounds) now
 * names deep, saturated colours held for a whole scene, not one beat
 * (lib/translator.ts's `scene` groups 2-3 beats). Line 7 (headline
 * typography) moves from cream-or-black chips to cream-or-pale-yellow type
 * on black chips only, and now also covers the new `labels` data chips.
 * Three lines are new: accumulation (elements already on screen stay
 * exactly where they are within a scene — the v0.2 exit rule now applies
 * only at a scene boundary), the recurring paper hand, and one hot ribbon
 * colour per programme. Headline width itself stays a WP3.1 question,
 * untouched here. The four grounds are named, never hex: palette values
 * are approximate until Jim confirms, and the video model reads names well.
 */

import type { Beat, Ground, Scale } from "./translator";

export const STYLE_SHEET_VERSION = "style-sheet-v0.4";

export type Voice = "native" | "saskia";

const GROUND_NAMES: Record<Ground, string> = {
  lime: "saturated lime",
  cyan: "deep cyan",
  violet: "rich violet",
  magenta: "deep magenta",
};

/**
 * Approximate hex for the interface only (the cursor blinks in the next
 * beat's ground colour). Not used in prompts. Deepened for v0.4's
 * saturated grounds (WP5 §2); approximate until Jim confirms.
 */
export const GROUND_HEX: Record<Ground, string> = {
  lime: "#8FD400",
  cyan: "#0092B8",
  violet: "#6A3FC9",
  magenta: "#9C1568",
};

/** One hot contrasting colour for ribbons and diagram elements, one per programme (WP5 §2 line 14). */
export const HOT_RIBBON_HEX = "#E8471A";

/** The fourteen lines, verbatim from CLAUDE.md, with line 2 filled by the beat. */
export function styleSheet(ground: Ground): string[] {
  return [
    "Modern editorial paper collage: bold magazine composition, refined 2D motion design, photographed flat under soft room light.",
    `One deep, saturated block-colour paper ground fills the frame: ${GROUND_NAMES[ground]}, as the beat specifies. The ground holds its colour for the whole scene. The ground is a single unbroken colour.`,
    "Subjects are black-and-white halftone photographic cutouts with rough white torn-paper edges: objects, machines, buildings, maps, coins, screens, vehicles, anonymous paper hands. Every cutout is a plain, unmarked object: calendar pages, documents, coins, screens and vehicles are blank and unprinted, with no lettering, numerals, symbols, liveries or marks on them. Every cutout is matte paper reflecting only the room light, with a plain blank face: coin rims, document faces, screens and vehicle sides carry no lettering, numerals or marks.",
    "Diagram elements are flat matte paper shapes and ribbons, tape, rubber stamps, string and pins, stencilled arrows, paper bar charts, stacked sheets, grid paper, torn strips, hole-punched tags, paper clips, in cream, black, pale yellow or the ground's contrasting colour, with real paper texture and print dots.",
    "One consistent light from the upper left; each paper layer casts a small soft shadow.",
    "Layout: the headline chip owns the upper third of the frame and stays uncovered; subjects and diagrams occupy the lower two-thirds. When the frame opens on a previous scene's composition, its elements slide off or are covered in the first second and the new headline lands on clear ground.",
    "Headline and label typography: extra-bold sans-serif in cream or pale-yellow, printed on black paper chips. The headline chip is one line, no wider than a third of the frame width, with safe margins, sitting clear of the subjects; label chips are small, two words or a figure. Letterforms are accurate, complete and stable from the frame they appear in; each chip is printed once, slaps into place as a piece of paper, and then holds without redrawing. When the beat marks a hero number, that number alone may be printed larger, up to half the frame width.",
    "Compositions vary in scale from beat to beat: some show one oversized subject filling the frame, some a small subject alone on open ground, some several elements arranged as a diagram.",
    "Motion: elements enter fast with slight overshoot and a stable landing, then hold a clear reading window; one strongest focus at a time; the camera is locked; movement starts on the first frame and a small loop continues at the end; no empty frames.",
    "16:9, exactly 5 seconds, one composition, at most one crisp cut.",
    "Identity anchor: rough white torn edges on every cutout; small paper shadow from the upper-left light.",
    "Within a scene the composition accumulates: elements already in place stay exactly where they are while new elements arrive; the frame is fuller at the end of the beat than at the start.",
    "An anonymous paper hand, black-and-white halftone with a torn white edge, is the recurring actor: it presses, points, pulls ribbons and slides chips into place, entering from the frame edge.",
    "Ribbons and diagram elements use one hot contrasting paper colour per programme (a saturated orange or red-orange), plus cream and black.",
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

/** WP5 §2: the copy list gains the labels, in order, after the headline. */
export function copyList(headline: string | null, labels: string[] = []): string {
  const strings = [...(headline ? [headline] : []), ...labels];
  if (strings.length === 0) {
    return "ON-SCREEN TEXT: none. No text appears in frame.";
  }
  const quoted = strings.map((s) => `"${s}"`).join(", ");
  return `ON-SCREEN TEXT: ${quoted}. These strings are printed complete and correct from their first visible frame and never change. They are the only lettering in the frame.`;
}

const EVENT_WINDOW_LABELS = ["[0-1.5s] enter", "[1.5-3.5s] act", "[3.5-5s] react or label lands"];

/**
 * WP5 §1: `previousScene` tells the compiler whether this beat continues
 * its scene (elements accumulate, per style-sheet line 12) or opens a new
 * one (the v0.2 exit still applies: the previous scene's chips leave
 * first). `previousScene === null` means this is the programme's first
 * beat, a cold open regardless of `beat.scene`.
 */
export function beatBlock(beat: Beat, previousHandoff: string | null, previousScene: number | null): string {
  const continuesScene = previousScene !== null && previousScene === beat.scene;
  const lines = [
    `BEAT (scene ${beat.scene})`,
    `Ground: ${GROUND_NAMES[beat.ground]}.`,
    `Subjects: ${beat.subjects.join("; ")}.`,
    previousScene === null
      ? `Opens cold on the ground colour; the first subject enters on the first frame.`
      : continuesScene
        ? `Continues the current scene: everything already on screen — the primary subject, and any ribbons or chips from earlier beats in this scene — stays exactly where it is. Only this beat's new elements enter; the frame ends fuller than it began.`
        : `A new scene opens on ${previousHandoff ?? "the previous shot"}: the previous scene's chips leave first — they slide off, flip away, or are covered — then this scene's ground and primary subject appear on clear ground.`,
    `Events, timed:`,
    ...beat.events.map((e, i) => `  ${EVENT_WINDOW_LABELS[i]}: ${e}`),
    beat.hand ? `The recurring paper hand acts in this beat.` : `The paper hand does not appear in this beat.`,
    `Ends holding on ${beat.handoff}.`,
    SCALE_TEXT[beat.scale],
    beat.headline
      ? beat.hero
        ? `Headline printed on a black paper chip: "${beat.headline}". This is the hero beat: the number may print larger, up to half the frame width.`
        : `Headline printed on a black paper chip: "${beat.headline}".`
      : `No headline.`,
    beat.labels.length
      ? `Label chip(s) printed on black paper, small: ${beat.labels.map((l) => `"${l}"`).join(", ")}.`
      : `No label chips.`,
  ];
  return lines.join("\n");
}

export interface CompiledPrompt {
  prompt: string;
  styleSheetVersion: string;
  voice: Voice;
}

/**
 * Compile one beat into a clip prompt, in the order the brief fixes: style
 * sheet → beat (scene, ground, subjects, events, handoff, headline,
 * labels) → copy list → audio block. Identical for CHAIN=on and off; only
 * the image conditioning differs. `previousScene` is `null` for the
 * programme's first beat.
 */
export function compilePrompt(args: {
  beat: Beat;
  voice: Voice;
  previousHandoff: string | null;
  previousScene?: number | null;
}): CompiledPrompt {
  const { beat, voice, previousHandoff, previousScene = null } = args;
  const sheet = styleSheet(beat.ground)
    .map((line, i) => `${i + 1}. ${line}`)
    .join("\n");
  const audio = voice === "native" ? audioBlockA(beat.line) : AUDIO_BLOCK_B;
  const prompt = [
    `TESSERA STYLE SHEET`,
    sheet,
    ``,
    beatBlock(beat, previousHandoff, previousScene),
    ``,
    copyList(beat.headline, beat.labels),
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
  ["block-colour", "block color", "flat ground", "solid ground", "saturated lime", "deep cyan", "rich violet", "deep magenta", "saturated", "deep, saturated"],
  ["halftone", "torn-paper", "torn paper", "cutout", "blank face", "unmarked", "reflecting only the room light", "no glow", "no neon", "no halo"],
  ["paper shapes", "ribbons", "tape", "print dots", "paper texture", "rubber stamp", "stencilled arrow", "bar chart", "stacked sheets", "grid paper", "torn strip", "hole-punched", "paper clip"],
  ["upper-left light", "upper left", "paper-layer shadow", "paper shadow"],
  ["headline chip", "upper third", "lower two-thirds", "clear ground"],
  ["extra-bold", "sans-serif", "black paper chip", "cream", "pale-yellow", "pale yellow", "headline", "third of the frame", "hero", "label"],
  ["oversized", "small-scale", "open ground", "diagram", "vary in scale"],
  ["overshoot", "stable landing", "reading window", "camera is locked", "first frame"],
  ["16:9", "5 seconds", "one composition", "crisp cut"],
  ["torn-paper edges", "torn edges", "identity anchor", "upper-left"],
  ["accumulate", "accumulates", "already in place", "stay exactly where they are", "fuller"],
  ["paper hand", "recurring actor", "presses", "points", "pulls ribbons", "slides chips", "torn white edge"],
  ["hot contrasting", "orange", "red-orange", "one hot", "ribbons and diagram elements"],
];
