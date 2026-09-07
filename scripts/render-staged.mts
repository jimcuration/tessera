// WP6.1: headless renderer for a hand-authored beats file, bypassing the
// translator entirely.
//
// scripts/render.mts drives /api/translate (Claude, or its cache) to get
// beats; WP6.1 needs to render six PM-authored beats verbatim instead, to
// test whether reference-length `action` text (~150 words vs. our usual
// ~30) makes the model deliver reference-grade compositional density. This
// script loads those beats directly from a JSON file (the standard beat
// shape used by data/translations/*.json) and skips the translate step,
// while still fetching the real captured answer's `sentences` from
// lib/curation.ts so the session record and validateBeat's source-index
// bounds check are meaningful. Otherwise identical to render.mts: same fal
// calls, same /api/record and /api/voice posts, same recording shape, so
// scripts/check.mjs, report.mjs, reel.mjs, contact-sheet.mjs all work on
// its output unchanged.
//
//   npx tsx scripts/render-staged.mts --beats data/translations/spine-staged.json \
//     --voice saskia --chain on|off [--music on|off] [--palette a|b|c] [--base http://localhost:3100] [--suffix name]
//
// WP7: --palette (default a) selects lib/palette.ts's colour system for the
// compiled prompt; the session id and every recorded clip/session carry it
// so three same-beats runs at different palettes don't collide or get
// confused after the fact.
//
// Prints the session id on success.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fal } from "@fal-ai/client";
import { compilePrompt, STYLE_SHEET_VERSION, type Voice } from "../lib/prompt.ts";
import { getAnswer } from "../lib/curation.ts";
import { TRANSLATOR_VERSION, validateBeat, type Beat } from "../lib/translator.ts";
import { PALETTE_IDS, type PaletteId } from "../lib/palette.ts";
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

const beatsFile = arg("beats");
const voice = arg("voice") as Voice | null;
const chain = arg("chain") as "on" | "off" | null;
const base = arg("base", "http://localhost:3100");
const suffix = arg("suffix");
const music = (arg("music", "off") as "on" | "off" | null) ?? "off";
const palette = (arg("palette", "a") as PaletteId | null) ?? "a";
if (
  !beatsFile ||
  (voice !== "native" && voice !== "saskia") ||
  (chain !== "on" && chain !== "off") ||
  (music !== "on" && music !== "off") ||
  !PALETTE_IDS.includes(palette)
) {
  console.error(
    'usage: npx tsx scripts/render-staged.mts --beats data/translations/spine-staged.json --voice native|saskia --chain on|off [--music on|off] [--palette a|b|c] [--base url] [--suffix name]'
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

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

const sessionId = `${stamp()}-${slug(suffix ?? path.basename(beatsFile, ".json"))}-${voice}-chain-${chain}-palette-${palette}`;

interface GeneratedClip {
  rawUrl: string;
  ms: number;
  expandedPrompt: string | null;
  requestId: string | null;
  timings: unknown;
}

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
      console.warn(`[render-staged] fal error, retrying (${attempt + 1}/${GENERATE_RETRIES}):`, cause instanceof Error ? cause.message : cause);
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

async function lastFrameOf(rawUrl: string): Promise<string> {
  const work = path.join(tmpdir(), `tessera-render-staged-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
  if (!res.ok) console.warn(`[render-staged] POST ${urlPath} -> ${res.status}`);
  return res;
}

async function main() {
  console.log(`[render-staged] session ${sessionId}`);

  const file = JSON.parse(readFileSync(path.resolve(beatsFile), "utf8")) as {
    question: string;
    beats: unknown[];
  };
  const answer = await getAnswer(file.question);
  if (!answer) {
    console.error(`no captured answer for "${file.question}" (lib/curation.ts)`);
    process.exit(1);
  }
  const sentences = answer.sentences;

  const beats: { n: number; beat: Beat; warnings: string[] }[] = [];
  const dropped: unknown[] = [];
  file.beats.forEach((raw, i) => {
    const check = validateBeat(raw, sentences);
    if (check.ok && check.beat) {
      beats.push({ n: i + 1, beat: check.beat, warnings: check.warnings });
      if (check.warnings.length) {
        console.warn(`[render-staged] beat ${i + 1} warnings: ${check.warnings.join("; ")}`);
      }
    } else {
      dropped.push({ raw, reason: check.dropped });
      console.error(`[render-staged] beat ${i + 1} DROPPED by validateBeat: ${check.dropped}`);
    }
  });
  if (beats.length === 0) {
    console.error("[render-staged] no valid beats to render");
    process.exit(1);
  }
  console.log(`[render-staged] ${beats.length} beat(s) loaded from ${beatsFile}, ${dropped.length} dropped`);

  let previousHandoff: string | null = null;
  let lastFrame: string | undefined;

  async function renderOne({ n, beat, warnings }: { n: number; beat: Beat; warnings: string[] }, fromFrame: string | undefined) {
    const { prompt } = compilePrompt({ beat, voice: voice as Voice, previousHandoff: fromFrame ? previousHandoff : null, palette });
    const clip = await generateClip({ prompt, fromFrame });
    await post("/api/record", {
      kind: "clip",
      session: sessionId,
      n,
      question: file.question,
      beat,
      sources: beat.source.map((i) => sentences[i] ?? ""),
      warnings,
      voice,
      chain,
      palette,
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
    console.log(`[render-staged] beat ${n} done in ${clip.ms}ms${fromFrame ? " (i2v)" : " (t2v)"}`);
    return clip;
  }

  if (chain === "on") {
    for (const item of beats) {
      const clip = await renderOne(item, lastFrame);
      previousHandoff = item.beat.handoff;
      lastFrame = await lastFrameOf(clip.rawUrl);
    }
  } else {
    for (const item of beats) {
      await renderOne(item, undefined);
    }
  }

  await post("/api/record", {
    kind: "session",
    session: sessionId,
    question: file.question,
    matchedQuestion: answer.question,
    answerKind: answer.kind,
    link: answer.link,
    followups: answer.followups,
    fromSpine: answer.fromSpine,
    sentences,
    switches: { voice, chain, music, palette, render: "queue" },
    translatorVersion: TRANSLATOR_VERSION,
    styleSheetVersion: STYLE_SHEET_VERSION,
    translateSource: "staged",
    beatsFile,
    beats: beats.map((b) => b.beat),
    warnings: beats.map((b) => b.warnings),
    dropped,
    askedAt: new Date().toISOString(),
  });

  console.log(`[render-staged] done: ${sessionId}`);
}

main().catch((cause) => {
  console.error("[render-staged] failed:", cause instanceof Error ? cause.stack ?? cause.message : cause);
  process.exit(1);
});
