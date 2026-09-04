import { TITLES as RAW_TITLES } from "@/catalog/titles.mjs";

export interface Title {
  id: string;
  /** Lowercase display name. */
  title: string;
  company: string;
  ticker: string;
  /** Where the answers come from (a fixture path in WP0). */
  premise: string;
  featured?: boolean;
}

export const TITLES = RAW_TITLES as Title[];

export function featuredTitle(): Title {
  return TITLES.find((title) => title.featured) ?? TITLES[0];
}

/** Same-origin media URL for a fal CDN clip (frame grabs need no CORS). */
export function mediaUrl(rawUrl: string): string {
  return `/api/media?url=${encodeURIComponent(rawUrl)}`;
}
