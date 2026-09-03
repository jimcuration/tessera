import { ROWS as RAW_ROWS, TITLES as RAW_TITLES } from "@/catalog/titles.mjs";

export type Mode = "story" | "chaos";

export interface Title {
  id: string;
  title: string;
  /** One-line hook shown on cards. */
  tagline: string;
  /** Two-sentence synopsis for the billboard and detail sheet. */
  logline: string;
  genres: string[];
  year: number;
  rating: "ALL" | "13+" | "16+";
  mode: Mode;
  /** Pinned to the billboard on first load. */
  featured?: boolean;
  /** Style tokens appended to every generated shot. */
  style: string;
  /** What the showrunner writes the live episode from. */
  premise: string;
  /** Nano Banana 2 key-art prompt. */
  coverPrompt: string;
  /** H3 Max Turbo preview clip prompt (trailer + cold open). */
  previewPrompt: string;
}

export interface Row {
  id: string;
  label: string;
  /** Rendered with LIVE badges (the brainrot channels). */
  live?: boolean;
  ids: string[];
}

export const TITLES = RAW_TITLES as Title[];
export const ROWS = RAW_ROWS as Row[];

const BY_ID = new Map(TITLES.map((title) => [title.id, title]));

export function titleById(id: string): Title | undefined {
  return BY_ID.get(id);
}

export function featuredTitle(): Title {
  return TITLES.find((title) => title.featured) ?? TITLES[0];
}

/** Pre-generated assets, produced by scripts/generate-catalog.mjs. */
export interface ManifestEntry {
  /** Local path under /public, e.g. /catalog/covers/<id>.jpg */
  cover: string;
  /** fal CDN URL of the preview clip. */
  preview: string;
  previewSeconds: number;
}

export interface Manifest {
  generatedAt: string;
  titles: Record<string, ManifestEntry>;
}

let manifestPromise: Promise<Manifest | null> | null = null;

/** Fetch /catalog/manifest.json once; null when the catalog was never built. */
export function loadManifest(): Promise<Manifest | null> {
  if (!manifestPromise) {
    manifestPromise = fetch("/catalog/manifest.json", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<Manifest>) : null))
      .catch(() => null);
  }
  return manifestPromise;
}

/** Same-origin media URL for a fal CDN clip (frame grabs need no CORS). */
export function mediaUrl(rawUrl: string): string {
  return `/api/media?url=${encodeURIComponent(rawUrl)}`;
}
