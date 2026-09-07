// WP8.2: one-off probe of fal's actual accepted `duration` range for
// minimax/h3-max-turbo/text-to-video. The published API docs say only
// `duration: integer, default 5` — no min/max/step documented anywhere,
// and the response has no field for the returned duration or aspect ratio,
// so both must be measured from the downloaded clip via ffmpeg. Run once,
// by hand, not part of any npm script; kept for the record (WP8.2-report.md
// cites this file and its output).
//
//   npx tsx scripts/probe-duration.mts

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fal } from "@fal-ai/client";
import { durationOf, FFMPEG } from "./ffmpeg.mjs";

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const FAL_KEY = (process.env.FAL_KEY ?? "").trim();
if (!FAL_KEY) {
  console.error("FAL_KEY missing from .env.local");
  process.exit(1);
}
fal.config({ credentials: FAL_KEY });

const ENDPOINT = "minimax/h3-max-turbo/text-to-video";
// Minimal, cheap, plainly-worded prompt: this probe is about the duration
// and aspect_ratio fields, not visual quality.
const PROMPT =
  "A single plain grey paper card sits on a flat cream background, photographed flat under soft even light. Nothing else happens. Static camera, no motion, no text.";

async function probe(duration: number): Promise<void> {
  const input = {
    prompt: PROMPT,
    duration,
    resolution: "480P",
    aspect_ratio: "16:9",
    prompt_expansion_mode: "balanced",
  };
  const started = Date.now();
  try {
    const { request_id } = await fal.queue.submit(ENDPOINT, { input });
    await fal.queue.subscribeToStatus(ENDPOINT, { requestId: request_id, mode: "polling", pollInterval: 250 });
    const result = await fal.queue.result(ENDPOINT, { requestId: request_id });
    const data = result.data as { video?: { url?: string } };
    const rawUrl = data?.video?.url;
    if (!rawUrl) {
      console.log(`duration=${duration}: FAILED (no video in response), ${Date.now() - started}ms`);
      return;
    }
    const work = path.join(tmpdir(), `tessera-probe-${duration}-${Date.now()}`);
    mkdirSync(work, { recursive: true });
    const mp4 = path.join(work, "clip.mp4");
    const res = await fetch(rawUrl);
    writeFileSync(mp4, Buffer.from(await res.arrayBuffer()));
    const actualDuration = durationOf(mp4);
    // ffmpeg -i's stderr banner includes stream dimensions; pull WxH to
    // derive the actual aspect ratio, since fal returns neither field.
    const probeResult = spawnSync(FFMPEG, ["-hide_banner", "-i", mp4], { encoding: "utf8" });
    const dims = /(\d{2,5})x(\d{2,5})/.exec(probeResult.stderr || "");
    const ratio = dims ? `${dims[1]}x${dims[2]}` : "unknown";
    console.log(
      `duration=${duration}: OK, requested=${duration}s, actual=${actualDuration?.toFixed(2)}s, dims=${ratio}, wall=${Date.now() - started}ms, url=${rawUrl}`
    );
  } catch (cause) {
    console.log(`duration=${duration}: ERROR — ${cause instanceof Error ? cause.message : cause}`);
  }
}

async function main() {
  // Round 1 (2,3,11,13,20,30) found: 2/3 rejected (422), 11/13 accepted,
  // 20/30 rejected (422). Round 2 narrows both boundaries.
  const candidates = [4, 6, 15, 16, 17, 18, 19];
  for (const d of candidates) {
    await probe(d);
  }
}

main();
