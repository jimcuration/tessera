// Headless spine/session renderer for WP2 measurement.
//
// The player (components/player.tsx) drives a programme from the browser;
// this script drives the same pipeline (translate -> compile -> fal ->
// record) from Node, hitting this project's own running dev server for
// /api/translate, /api/voice and /api/record so recordings/<session>/ comes
// out byte-for-byte the shape scripts/check.mjs, report.mjs, reel.mjs,
// contact-sheet.mjs and whisper-match.py already expect. Built for WP2
// because two builders were editing this repo at once and the player's
// client-side session state does not survive the other one's Fast Refresh;
// this bypasses the browser entirely. FAL_KEY and ELEVENLABS_API_KEY are
// read from .env.local and used directly (server-side; never logged).
//
//   npx tsx scripts/render.mts --question "..." --voice native|saskia \
//     --chain on|off [--base http://localhost:3100] [--suffix name]
//
// Prints the session id on success.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fal } from "@fal-ai/client";
import { compilePrompt, STYLE_SHEET_VERSION, type Voice } from "../lib/prompt.ts";
import { TRANSLATOR_VERSION, type Beat } from "../lib/translator.ts";
import { ffmpeg } from "./ffmpeg.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

function arg(name: string, fallback: string | null = null): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const question = arg("question");
const voice = arg("voice") as Voice | null;
const chain = arg("chain") as "on" | "off" | null;
const base = arg("base", "http://localhost:3100");
const suffix = arg("suffix");
// Record-keeping only (WP5 §3): MUSIC doesn't change the clip prompt or the
// fal call, only whether the player layers a music bed under the narration
// at playback time, so this flag doesn't branch renderOne — it just tags
// the session so two sessions rendered from identical clips are told apart.
const music = (arg("music", "off") as "on" | "off" | null) ?? "off";
if (
  !question ||
  (voice !== "native" && voice !== "saskia") ||
  (chain !== "on" && chain !== "off") ||
  (music !== "on" && music !== "off")
) {
  console.error(
    'usage: npx tsx scripts/render.mts --question "..." --voice native|saskia --chain on|off [--music on|off] [--base url] [--suffix name]'
  );
  process.exit(1);
}

const FAL_KEY = (process.env.FAL_KEY ?? "").trim();
if (!FAL_KEY) {
  console.error("FAL_KEY missing from .env.local");
  process.exit(1);
}
fal.config({ credentials: FAL_KEY });

const TURBO_T2V = "minimax/h3-max-turbo/text-to-video";
const TURBO_I2V = "minimax/h3-max-turbo/image-to-video";
const SHOT_SECONDS = 5;
const UNCHAINED_PARALLEL = 2;

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

const sessionId = `${stamp()}-${slug(suffix ?? question)}-${voice}-chain-${chain}`;

interface GeneratedClip {
  rawUrl: string;
  ms: number;
  expandedPrompt: string | null;
  requestId: string | null;
  timings: unknown;
}

/** fal occasionally returns a transient "downstream_service_error" 500 from the underlying model; one retry clears most of these (seen in WP3 measurement). */
const GENERATE_RETRIES = 2;

async function generateClip(args: { prompt: string; fromFrame?: string }): Promise<GeneratedClip> {
  const started = performance.now();
  const input: Record<string, unknown> = {
    prompt: args.prompt,
    duration: SHOT_SECONDS,
    resolution: "480P",
    prompt_expansion_mode: "balanced",
  };
  let endpoint = TURBO_T2V;
  if (args.fromFrame) {
    endpoint = TURBO_I2V;
    input.image_url = args.fromFrame;
  } else {
    input.aspect_ratio = "16:9";
  }
  let requestId: string | undefined;
  let result: Awaited<ReturnType<typeof fal.queue.result>> | undefined;
  for (let attempt = 0; attempt <= GENERATE_RETRIES; attempt += 1) {
    try {
      ({ request_id: requestId } = await fal.queue.submit(endpoint, { input }));
      await fal.queue.subscribeToStatus(endpoint, { requestId, mode: "polling", pollInterval: 250 });
      result = await fal.queue.result(endpoint, { requestId });
      break;
    } catch (cause) {
      if (attempt === GENERATE_RETRIES) throw cause;
      console.warn(`[render] fal error, retrying (${attempt + 1}/${GENERATE_RETRIES}):`, cause instanceof Error ? cause.message : cause);
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
  const data = result!.data as { video?: { url?: string }; expanded_prompt?: string | null; timings?: unknown };
  const rawUrl = data?.video?.url;
  if (!rawUrl) throw new Error("no video in fal response");
  return {
    rawUrl,
    ms: Math.round(performance.now() - started),
    expandedPrompt: typeof data.expanded_prompt === "string" ? data.expanded_prompt : null,
    requestId: requestId ?? null,
    timings: data.timings ?? null,
  };
}

/** Grab the clip's last frame as a JPEG data URL (mirrors lib/frames.ts). */
async function lastFrameOf(rawUrl: string): Promise<string> {
  const work = path.join(tmpdir(), `tessera-render-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(work, { recursive: true });
  const mp4 = path.join(work, "clip.mp4");
  const res = await fetch(rawUrl);
  writeFileSync(mp4, Buffer.from(await res.arrayBuffer()));
  const jpg = path.join(work, "last.jpg");
  ffmpeg(["-sseof", "-0.3", "-i", mp4, "-frames:v", "1", "-q:v", "2", jpg]);
  const bytes = readFileSync(jpg);
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

async function post(urlPath: string, body: unknown) {
  const res = await fetch(`${base}${urlPath}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.warn(`[render] POST ${urlPath} -> ${res.status}`);
  return res;
}

async function main() {
  console.log(`[render] session ${sessionId}`);
  const started = Date.now();

  const translateRes = await fetch(`${base}/api/translate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (translateRes.status === 404) {
    console.error("no captured answer for that question");
    process.exit(1);
  }
  if (!translateRes.ok || !translateRes.body) {
    console.error(`translator ${translateRes.status}`);
    process.exit(1);
  }

  let answer: Record<string, unknown> | null = null;
  const beats: { n: number; beat: Beat; warnings: string[] }[] = [];
  const dropped: unknown[] = [];
  let translateSource: string | null = null;
  let translateMs: number | null = null;
  let firstBeatMs: number | null = null;

  const reader = translateRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl = buffer.indexOf("\n");
    while (nl !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) {
        const msg = JSON.parse(line) as Record<string, unknown>;
        if (msg.type === "answer") answer = msg;
        else if (msg.type === "beat") {
          if (firstBeatMs === null) firstBeatMs = Date.now() - started;
          beats.push({ n: Number(msg.n), beat: msg.beat as Beat, warnings: (msg.warnings as string[]) ?? [] });
        } else if (msg.type === "dropped") dropped.push(msg);
        else if (msg.type === "done") {
          translateSource = (msg.source as string) ?? null;
          translateMs = (msg.ms as number) ?? null;
        } else if (msg.type === "error") {
          console.error("[translator]", msg.error);
          process.exit(1);
        }
      }
      nl = buffer.indexOf("\n");
    }
  }
  if (!answer) throw new Error("no answer header from translator");
  console.log(`[render] ${beats.length} beat(s), ${dropped.length} dropped, source=${translateSource}`);

  const sentences = (answer.sentences as string[]) ?? [];
  let previousHandoff: string | null = null;
  let lastFrame: string | undefined;

  async function renderOne({ n, beat, warnings }: { n: number; beat: Beat; warnings: string[] }, fromFrame: string | undefined) {
    const { prompt } = compilePrompt({ beat, voice: voice as Voice, previousHandoff: fromFrame ? previousHandoff : null });
    const clip = await generateClip({ prompt, fromFrame });
    await post("/api/record", {
      kind: "clip",
      session: sessionId,
      n,
      question,
      beat,
      sources: beat.source.map((i) => sentences[i] ?? ""),
      warnings,
      voice,
      chain,
      translatorVersion: TRANSLATOR_VERSION,
      styleSheetVersion: STYLE_SHEET_VERSION,
      prompt,
      expandedPrompt: clip.expandedPrompt,
      rawUrl: clip.rawUrl,
      requestId: clip.requestId,
      endpoint: fromFrame ? TURBO_I2V : TURBO_T2V,
      chained: Boolean(fromFrame),
      seed: undefined,
      resolution: "480P",
      renderMs: clip.ms,
      timings: clip.timings,
    });
    if (voice === "saskia") {
      await post("/api/voice", { text: beat.delivery, session: sessionId, n });
    }
    console.log(`[render] beat ${n} done in ${clip.ms}ms${fromFrame ? " (i2v)" : " (t2v)"}`);
    return clip;
  }

  if (chain === "on") {
    for (const item of beats) {
      const clip = await renderOne(item, lastFrame);
      previousHandoff = item.beat.handoff;
      lastFrame = await lastFrameOf(clip.rawUrl);
    }
  } else {
    let i = 0;
    while (i < beats.length) {
      const batch = beats.slice(i, i + UNCHAINED_PARALLEL);
      await Promise.all(batch.map((item) => renderOne(item, undefined)));
      i += UNCHAINED_PARALLEL;
    }
  }

  await post("/api/record", {
    kind: "session",
    session: sessionId,
    question,
    matchedQuestion: answer.question,
    answerKind: answer.kind,
    link: answer.link,
    followups: answer.followups,
    fromSpine: answer.fromSpine,
    sentences,
    switches: { voice, chain, music, render: "queue" },
    translatorVersion: TRANSLATOR_VERSION,
    styleSheetVersion: STYLE_SHEET_VERSION,
    translateSource,
    translateMs,
    firstBeatMs,
    beats: beats.map((b) => b.beat),
    warnings: beats.map((b) => b.warnings),
    dropped,
    askedAt: new Date(started).toISOString(),
  });

  console.log(`[render] done: recordings/${sessionId}`);
}

main().catch((cause) => {
  console.error("[render] failed:", cause instanceof Error ? cause.stack ?? cause.message : cause);
  process.exit(1);
});
