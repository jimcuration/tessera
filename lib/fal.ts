"use client";

import { fal } from "@fal-ai/client";
import { onClip } from "./recorder";

// FAL_KEY never reaches the browser: all traffic rides the server proxy.
fal.config({ proxyUrl: "/api/fal/proxy" });

export { fal };

/** MiniMax H3 Max Turbo: faster than realtime, which is the whole trick. */
export const TURBO_T2V = "minimax/h3-max-turbo/text-to-video";
export const TURBO_I2V = "minimax/h3-max-turbo/image-to-video";

export type Resolution = "480P" | "768P";

export interface GeneratedClip {
  /** Same-origin proxied URL, safe for playback and canvas grabs. */
  videoUrl: string;
  /** Raw fal CDN URL. */
  rawUrl: string;
  /** Wall-clock generation time, ms. */
  ms: number;
  /** The prompt after fal's rewriter, as sent to the model. */
  expandedPrompt: string | null;
  requestId: string | null;
}

interface InFlight {
  endpoint: string;
  controller: AbortController;
}

/** Requests submitted and not yet finished, so an interrupt can cancel them. */
const inFlight = new Map<string, InFlight>();

/**
 * Cancel every render in flight. Called when the viewer interrupts: the
 * stream that owned them is already stopped, so their results would be
 * discarded anyway; cancelling stops paying for them. Returns how many.
 */
export function cancelInFlight(): number {
  let count = 0;
  for (const [requestId, { endpoint, controller }] of inFlight) {
    count += 1;
    controller.abort();
    void fal.queue.cancel(endpoint, { requestId }).catch(() => {
      /* already running or finished: nothing to cancel */
    });
  }
  inFlight.clear();
  return count;
}

/**
 * Generate one shot. With `fromFrame` the shot chains from that image
 * (continuity); without it, it is a text-to-video hard cut.
 *
 * Uses the queue API rather than fal.subscribe so the request id is known
 * and the render can be cancelled. Prompt expansion is always "balanced":
 * the style sheet is written for the rewriter, and the report reads which
 * lines survive in `expanded_prompt`.
 */
export async function generateClip(args: {
  prompt: string;
  duration: number;
  resolution?: Resolution;
  seed?: number;
  fromFrame?: string;
}): Promise<GeneratedClip> {
  const started = performance.now();
  const resolution = args.resolution ?? "480P";
  const input: Record<string, unknown> = {
    prompt: args.prompt,
    duration: args.duration,
    resolution,
    prompt_expansion_mode: "balanced",
  };
  if (args.seed !== undefined) input.seed = args.seed;
  let endpoint = TURBO_T2V;
  // WP8.2: fal's image-to-video schema has no `aspect_ratio` input field at
  // all (checked against the published API schema, not assumed) — only
  // text-to-video accepts it. A chained (i2v) shot's aspect ratio is
  // whatever the model does with the input frame; recorded, not requested.
  const aspectRatioParamSent = !args.fromFrame;
  if (args.fromFrame) {
    endpoint = TURBO_I2V;
    input.image_url = args.fromFrame;
  } else {
    input.aspect_ratio = "16:9";
  }

  const controller = new AbortController();
  const { request_id: requestId } = await fal.queue.submit(endpoint, { input });
  inFlight.set(requestId, { endpoint, controller });
  try {
    const aborted = new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () => reject(new Error("render cancelled")), { once: true });
    });
    // Tight polling: every 250ms of lag is 250ms the buffer does not grow.
    await Promise.race([
      fal.queue.subscribeToStatus(endpoint, {
        requestId,
        mode: "polling",
        pollInterval: 250,
        abortSignal: controller.signal,
      }),
      aborted,
    ]);
    if (controller.signal.aborted) throw new Error("render cancelled");
    const result = await fal.queue.result(endpoint, { requestId, abortSignal: controller.signal });
    const data = result.data as {
      video?: { url?: string };
      expanded_prompt?: string | null;
      timings?: unknown;
    };
    const rawUrl = data?.video?.url;
    if (!rawUrl) throw new Error("no video in response");
    const ms = Math.round(performance.now() - started);
    const clip: GeneratedClip = {
      videoUrl: `/api/media?url=${encodeURIComponent(rawUrl)}`,
      rawUrl,
      ms,
      expandedPrompt: typeof data.expanded_prompt === "string" ? data.expanded_prompt : null,
      requestId,
    };
    onClip({
      prompt: args.prompt,
      expandedPrompt: clip.expandedPrompt,
      rawUrl,
      requestId,
      endpoint,
      chained: Boolean(args.fromFrame),
      seed: args.seed,
      resolution,
      renderMs: ms,
      timings: data.timings ?? null,
      requestedAspectRatio: "16:9",
      aspectRatioParamSent,
    });
    return clip;
  } finally {
    inFlight.delete(requestId);
  }
}
