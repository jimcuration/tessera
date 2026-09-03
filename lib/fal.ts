"use client";

import { fal } from "@fal-ai/client";

// FAL_KEY never reaches the browser: all traffic rides the server proxy.
fal.config({ proxyUrl: "/api/fal/proxy" });

export { fal };

/** MiniMax H3 Max Turbo: faster than realtime, which is the whole trick. */
export const TURBO_T2V = "minimax/h3-max-turbo/text-to-video";
export const TURBO_I2V = "minimax/h3-max-turbo/image-to-video";
/** Text LLM router used by the showrunner. */
export const LLM_ENDPOINT = "openrouter/router";
export const LLM_MODEL = "google/gemini-2.5-flash";

export type Resolution = "480P" | "768P";

export interface GeneratedClip {
  /** Same-origin proxied URL, safe for playback and canvas grabs. */
  videoUrl: string;
  /** Raw fal CDN URL. */
  rawUrl: string;
  /** Wall-clock generation time, for the on-screen render badge. */
  ms: number;
}

/**
 * Generate one shot. With `fromFrame` the shot chains from that image
 * (continuity); without it, it is a text-to-video hard cut.
 */
export async function generateClip(args: {
  prompt: string;
  duration: number;
  resolution?: Resolution;
  seed?: number;
  fromFrame?: string;
  /** Prompt enrichment: chained shots keep our grammar verbatim. */
  expand?: boolean;
}): Promise<GeneratedClip> {
  const started = performance.now();
  const input: Record<string, unknown> = {
    prompt: args.prompt,
    duration: args.duration,
    resolution: args.resolution ?? "768P",
    prompt_expansion_mode: args.expand === false ? "disabled" : "balanced",
  };
  if (args.seed !== undefined) input.seed = args.seed;
  let endpoint = TURBO_T2V;
  if (args.fromFrame) {
    endpoint = TURBO_I2V;
    input.image_url = args.fromFrame;
  } else {
    input.aspect_ratio = "16:9";
  }
  // Tight polling: every 250ms of lag is 250ms the buffer does not grow.
  const result = await fal.subscribe(endpoint, { input, pollInterval: 250 });
  const data = result.data as { video?: { url?: string } };
  const rawUrl = data?.video?.url;
  if (!rawUrl) throw new Error("no video in response");
  return {
    videoUrl: `/api/media?url=${encodeURIComponent(rawUrl)}`,
    rawUrl,
    ms: Math.round(performance.now() - started),
  };
}

/** One text-LLM turn; returns the raw output string. */
export async function llm(args: {
  systemPrompt: string;
  prompt: string;
  maxTokens: number;
  temperature?: number;
}): Promise<string> {
  const result = await fal.subscribe(LLM_ENDPOINT, {
    input: {
      model: LLM_MODEL,
      system_prompt: args.systemPrompt,
      prompt: args.prompt,
      temperature: args.temperature ?? 0.8,
      max_tokens: args.maxTokens,
    },
    pollInterval: 250,
  });
  return (result.data as { output?: string }).output ?? "";
}

/** Extract the first {...} JSON object from an LLM reply. */
export function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON in reply");
  return text.slice(start, end + 1);
}
