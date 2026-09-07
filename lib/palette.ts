/**
 * WP7: the `PALETTE=a|b|c` colour system for Tessera Style Sheet v0.6.
 *
 * The translator's `Ground` type stays a fixed four-value enum
 * (lime/cyan/violet/magenta, lib/translator.ts) — `scene`/bookend logic and
 * `validateProgramme` depend on that fixed set, and this brief does not
 * touch the translator schema. What changes per palette is which actual
 * colour each of those four engine keys prints as, in the compiled prompt.
 *
 * A palette supplies an ordered list of swatches; a `Ground` key maps onto
 * that list by its fixed position in `GROUND_ORDER` (lime=0, cyan=1,
 * violet=2, magenta=3), modulo the list's length. A 4-swatch palette (A) is
 * then a plain 1:1 rename. A 3-swatch palette (B) reuses its first swatch
 * for the 4th engine key. A 2-swatch palette (C) alternates every other key
 * — exactly the "grounds alternate" the brief describes for C, and "scene
 * grounds map onto each palette's set in order" for all three.
 *
 * Merging WP7 to main, Robin asked for `PALETTE` unset (no env var, or an
 * invalid value) to mean the original four named grounds — lime green,
 * pale cyan, soft violet, deep magenta, no hex — rather than defaulting
 * into palette A's "Electric Curation" branding. `DEFAULT_PALETTE` below is
 * that state: a fourth `PaletteDef`-shaped value, same shape as A/B/C so
 * `styleSheet()`/`beatBlock()` (lib/prompt.ts) don't need a branch, but not
 * itself a selectable `PaletteId` — `PALETTE=a|b|c` remains the explicit,
 * opt-in way to test one of WP7's three named palettes; leaving it unset is
 * not a fourth named option.
 */

import type { Ground } from "./translator";

export type PaletteId = "a" | "b" | "c";
export const PALETTE_IDS: PaletteId[] = ["a", "b", "c"];

export interface Swatch {
  name: string;
  /** Hex string for an explicit palette (A/B/C); null for the unset default, which names grounds the way v0.3 always did — no hex. */
  hex: string | null;
}

export interface PaletteDef {
  id: PaletteId | null;
  label: string;
  grounds: Swatch[];
  /** The full "main colours" sentence fragment for the sheet's visual-system line. */
  mainColorsPhrase: string;
  /** Name of the light (non-black) chip/typography colour, for the visual-system line. */
  lightChipName: string;
  /** Diagram-element/ribbon colour vocabulary for the sheet's diagram line, given the current beat's resolved ground swatch. */
  ribbonText: (current: Swatch) => string;
  /** Headline chip material + type-colour clause for the sheet's headline line, given the current beat's resolved ground swatch. */
  chipText: (current: Swatch) => string;
}

const GROUND_ORDER: Ground[] = ["lime", "cyan", "violet", "magenta"];

/** PALETTE unset (or an unrecognised value): the original v0.3 four named grounds, no hex. */
const DEFAULT_GROUNDS: Swatch[] = [
  { name: "lime green", hex: null },
  { name: "pale cyan", hex: null },
  { name: "soft violet", hex: null },
  { name: "deep magenta", hex: null },
];

export const DEFAULT_PALETTE: PaletteDef = {
  id: null,
  label: "Default (unbranded)",
  grounds: DEFAULT_GROUNDS,
  mainColorsPhrase: "Lime green, pale cyan, soft violet and deep magenta",
  lightChipName: "cream",
  ribbonText: () => "in cream, black, pale yellow or the ground's contrasting colour",
  chipText: () => "printed on a cream or black paper chip",
};

const A_GROUNDS: Swatch[] = [
  { name: "lime green", hex: "#C8F135" },
  { name: "electric cyan", hex: "#2BD9F0" },
  { name: "electric violet", hex: "#8A5CF6" },
  { name: "hot magenta", hex: "#E8338C" },
];

const B_GROUNDS: Swatch[] = [
  { name: "saturated cobalt blue", hex: "#2252FF" },
  { name: "vivid orange", hex: "#FF6728" },
  { name: "bright yellow", hex: "#FFE14A" },
];

const C_GROUNDS: Swatch[] = [
  { name: "deep near-black", hex: "#0E0E0F" },
  { name: "warm white", hex: "#FFF8E7" },
];
const C_ACCENT: Swatch = { name: "hot accent orange", hex: "#FF6728" };

export const PALETTES: Record<PaletteId, PaletteDef> = {
  a: {
    id: "a",
    label: "Electric Curation",
    grounds: A_GROUNDS,
    mainColorsPhrase:
      "Lime green #C8F135, electric cyan #2BD9F0, electric violet #8A5CF6 and hot magenta #E8338C",
    lightChipName: "warm white #FFF8E7",
    ribbonText: (current) =>
      `in black, warm white #FFF8E7, or ${current.name}'s contrasting colour from the palette`,
    chipText: () => "printed on a black or warm white paper chip",
  },
  b: {
    id: "b",
    label: "Reference",
    grounds: B_GROUNDS,
    mainColorsPhrase: "Saturated cobalt blue #2252FF, vivid orange #FF6728 and bright yellow #FFE14A",
    lightChipName: "cream",
    ribbonText: (current) => {
      const others = B_GROUNDS.filter((g) => g.name !== current.name);
      return `in black, cream, or ${others.map((o) => `${o.name} ${o.hex}`).join(" and ")}, the palette's other two colours`;
    },
    chipText: () => "printed on a black or cream paper chip",
  },
  c: {
    id: "c",
    label: "Mono-plus-one",
    grounds: C_GROUNDS,
    mainColorsPhrase: `Deep near-black #0E0E0F and warm white #FFF8E7, alternating, with one ${C_ACCENT.name} ${C_ACCENT.hex}`,
    lightChipName: "cream",
    ribbonText: () => `in ${C_ACCENT.name} ${C_ACCENT.hex} only, the film's one accent colour`,
    chipText: (current) =>
      current.name === "deep near-black"
        ? `printed in cream on a ${C_ACCENT.name} paper chip`
        : `printed in black on a ${C_ACCENT.name} paper chip`,
  },
};

/** The active palette's definition — one of A/B/C, or the unset default. */
export function paletteDef(palette: PaletteId | null): PaletteDef {
  return palette ? PALETTES[palette] : DEFAULT_PALETTE;
}

/** Which swatch a `Ground` key prints as, under the given palette (or the unset default). */
export function resolveGround(ground: Ground, palette: PaletteId | null): Swatch {
  const def = paletteDef(palette);
  const idx = GROUND_ORDER.indexOf(ground);
  return def.grounds[idx % def.grounds.length];
}
