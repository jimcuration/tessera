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
//     --chain on|off [--clip-seconds 5|10|15] [--base http://localhost:3100] [--suffix name]
//
// --clip-seconds controls this script's own fal request duration and the
// compiled prompt's stated duration; it does NOT change what the translator
// writes — that is the dev server's own CLIP_SECONDS env (lib/config.ts),
// read server-side by /api/translate. To render a 10s (or 15s) programme,
// start the dev server with a matching CLIP_SECONDS first and pass the same
// value here so the two agree (mismatch is a builder error the record's
// switches makes visible, not something this script can detect on its own).
//
// WP8.1 §1: at --clip-seconds 15, one shot is a whole SCENE (2-3 beats),
// one fal request (compileScenePrompt), one record written with `beats`
// (plural) carrying every beat's own offsetSeconds — mirrors
// lib/programme.ts's Session#flushVideoScene for the live app.
//
// Prints the session id on success.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fal } from "@fal-ai/client";
import { checkRemoteClipForFaces } from "../lib/faceGate.ts";
import { compilePrompt, compileScenePrompt, computeVoiceLedTiming, sceneOffsetSeconds, splitSceneByAudioBudget, STYLE_SHEET_VERSION, type SceneSection, type Voice } from "../lib/prompt.ts";
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

// WP9: --question-file reads the question from a file instead of the raw
// CLI argument. scripts/cache.mts (WP9's orchestrator) shells out to this
// script and found that a question containing a shell metacharacter (a
// live example: "...given the M&A spend?" — cmd.exe reads bare `&` as a
// command separator) or a character npm's own arg parser rejects (an
// em dash) silently mangles or aborts the whole call on Windows, however
// carefully the argv array is built, because the failure happens inside
// cmd.exe's/npm's own command-line parsing, not in this script. Passing
// the question by file sidesteps shell quoting entirely. --question stays
// exactly as it was for direct CLI use.
const questionFile = arg("question-file");
const question = questionFile ? readFileSync(questionFile, "utf8").trim() : arg("question");
const voice = arg("voice") as Voice | null;
const chain = arg("chain") as "on" | "off" | null;
const base = arg("base", "http://localhost:3100");
const suffix = arg("suffix");
// Record-keeping only (WP5 §3): MUSIC doesn't change the clip prompt or the
// fal call, only whether the player layers a music bed under the narration
// at playback time, so this flag doesn't branch renderOne — it just tags
// the session so two sessions rendered from identical clips are told apart.
const music = (arg("music", "off") as "on" | "off" | null) ?? "off";
// WP5.1, off by default: see lib/config.ts's FACE_GATE header comment.
const faceGate = (arg("face-gate", "off") as "on" | "off" | null) ?? "off";
const clipSecondsRaw = arg("clip-seconds", "5");
const clipSeconds = clipSecondsRaw === "15" ? 15 : clipSecondsRaw === "10" ? 10 : 5;
if (
  !question ||
  (voice !== "native" && voice !== "saskia") ||
  (chain !== "on" && chain !== "off") ||
  (music !== "on" && music !== "off") ||
  (faceGate !== "on" && faceGate !== "off") ||
  (clipSecondsRaw !== "5" && clipSecondsRaw !== "10" && clipSecondsRaw !== "15")
) {
  console.error(
    'usage: npx tsx scripts/render.mts --question "..." --voice native|saskia --chain on|off [--clip-seconds 5|10|15] [--music on|off] [--face-gate on|off] [--base url] [--suffix name]'
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
const SHOT_SECONDS = clipSeconds;
const UNCHAINED_PARALLEL = 2;

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

const sessionId = `${stamp()}-${slug(suffix ?? question)}-${voice}-chain-${chain}-${clipSeconds}s`;

interface GeneratedClip {
  rawUrl: string;
  ms: number;
  expandedPrompt: string | null;
  requestId: string | null;
  timings: unknown;
}

/** fal occasionally returns a transient "downstream_service_error" 500 from the underlying model; one retry clears most of these (seen in WP3 measurement). */
const GENERATE_RETRIES = 2;

async function generateClip(args: { prompt: string; fromFrame?: string; duration?: number }): Promise<GeneratedClip> {
  const started = performance.now();
  const input: Record<string, unknown> = {
    prompt: args.prompt,
    duration: args.duration ?? SHOT_SECONDS,
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

  /**
   * WP5.1: gate-check one rendered clip and log the check. Returns the
   * outcome so the caller can decide whether to re-render or drop — mirrors
   * lib/stream.ts's runFaceGate/logGate, since this script is a separate
   * render path (see this file's header) that bypasses lib/stream.ts
   * entirely and so needs its own copy of the same enforcement.
   */
  async function gateCheck(
    n: number,
    beat: Beat,
    clip: GeneratedClip,
    attempt: number
  ): Promise<{ detected: boolean; ok: boolean }> {
    let gate: { ok: boolean; detected: boolean; attempts: unknown[]; latencyMs: number };
    try {
      gate = { ok: true, ...(await checkRemoteClipForFaces(clip.rawUrl)) };
    } catch (cause) {
      console.warn(`[render] beat ${n}: face gate failed, passing through unchecked:`, cause instanceof Error ? cause.message : cause);
      gate = { ok: false, detected: false, attempts: [], latencyMs: 0 };
    }
    const outcome = gate.detected ? (attempt === 1 ? "rerender" : "dropped") : gate.ok ? "clean" : "gate-error";
    await post("/api/record", {
      kind: "faceGate",
      session: sessionId,
      n,
      beat,
      attempt,
      outcome,
      detected: gate.detected,
      attempts: gate.attempts,
      latencyMs: gate.latencyMs,
      clip: { expandedPrompt: clip.expandedPrompt, rawUrl: clip.rawUrl, requestId: clip.requestId, renderMs: clip.ms },
    });
    return { detected: gate.detected, ok: gate.ok };
  }

  async function renderOne({ n, beat, warnings }: { n: number; beat: Beat; warnings: string[] }, fromFrame: string | undefined): Promise<GeneratedClip | null> {
    const { prompt } = compilePrompt({ beat, voice: voice as Voice, previousHandoff: fromFrame ? previousHandoff : null, clipSeconds: clipSeconds === 15 ? 5 : clipSeconds });
    let clip = await generateClip({ prompt, fromFrame });
    if (faceGate === "on") {
      let gate = await gateCheck(n, beat, clip, 1);
      if (gate.detected) {
        console.warn(`[render] beat ${n}: face detected, re-rendering`);
        clip = await generateClip({ prompt, fromFrame });
        gate = await gateCheck(n, beat, clip, 2);
        if (gate.detected) {
          console.warn(`[render] beat ${n}: face detected on re-render too, dropping beat`);
          return null;
        }
      }
    }


    await post("/api/record", {
      kind: "clip",
      session: sessionId,
      n,
      question,
      beats: [
        {
          n,
          beat,
          offsetSeconds: 0,
          sectionEndSeconds: clipSeconds,
          audioDurationSeconds: null,
          sources: beat.source.map((i) => sentences[i] ?? ""),
          warnings,
        },
      ],
      voice,
      chain,
      translatorVersion: TRANSLATOR_VERSION,
      styleSheetVersion: STYLE_SHEET_VERSION,
      requestedDuration: clipSeconds,
      timingMethod: "fixed",
      splitMethod: null,
      totalNarrationSeconds: null,
      durationClamped: false,
      sceneSplit: null,
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
      requestedAspectRatio: "16:9",
      aspectRatioParamSent: !fromFrame,
    });
    console.log(`[render] beat ${n} done in ${clip.ms}ms${fromFrame ? " (i2v)" : " (t2v)"}`);
    return clip;
  }

  // WP8.2: per-beat narrated-audio duration and per-scene split method,
  // populated by the Saskia loop below (which runs ahead of any video
  // render), so renderScene can compute voice-led section timing instead
  // of WP8.1's fixed 5s-per-beat guess.
  const audioDurationByBeat = new Map<number, number | null>();
  const splitMethodByScene = new Map<number, "timestamps" | "silence-gap">();

  // WP8.1 §1 / WP8.2: at 15s, one shot is a whole scene (compileScenePrompt),
  // one fal request whose duration and section timecodes come from the
  // scene's own narrated-audio durations when available (voice-led,
  // WP8.2), falling back to WP8.1's fixed `items.length * 5` seconds
  // otherwise (native voice, or narration unavailable) — mirrors
  // lib/programme.ts's Session#flushVideoScene for the live app.
  async function renderScene(
    items: { n: number; beat: Beat; warnings: string[] }[],
    fromFrame: string | undefined,
    splitInfo: { part: number; of: number } | null = null
  ): Promise<GeneratedClip | null> {
    const sceneBeats = items.map((it) => it.beat);
    const durations = items.map((it) => audioDurationByBeat.get(it.n) ?? null);
    let sections: SceneSection[] | undefined;
    let requestedDuration = sceneBeats.length * 5;
    let timingMethod: "voice-led" | "fixed" = "fixed";
    let splitMethod: "timestamps" | "silence-gap" | null = null;
    let totalNarrationSeconds: number | null = null;
    let durationClamped = false;
    if (voice === "saskia" && durations.every((d): d is number => typeof d === "number" && d > 0)) {
      const timing = computeVoiceLedTiming(durations);
      sections = timing.sections;
      requestedDuration = timing.requestedDuration;
      totalNarrationSeconds = timing.totalNarrationSeconds;
      durationClamped = timing.clamped;
      timingMethod = "voice-led";
      splitMethod = splitMethodByScene.get(items[0].beat.scene) ?? null;
    } else if (voice === "saskia") {
      console.warn(`[render] scene ${items[0].beat.scene}: Saskia audio durations unavailable, falling back to fixed 5s-per-beat timing`);
    }
    const { prompt } = compileScenePrompt({
      beats: sceneBeats,
      voice: voice as Voice,
      previousHandoff: fromFrame ? previousHandoff : null,
      sections,
      clipSeconds: requestedDuration,
    });
    const offsets = sections ? sections.map((s) => s.start) : sceneBeats.map((_, i) => sceneOffsetSeconds(i));
    const ends = sections ? sections.map((s) => s.end) : sceneBeats.map((_, i) => sceneOffsetSeconds(i) + 5);
    const duration = requestedDuration;
    const aspectRatioParamSent = !fromFrame;
    let clip = await generateClip({ prompt, fromFrame, duration });
    if (faceGate === "on") {
      // WP5.1's gate is per-beat (logs against one beat's own record); a
      // scene shot has no single beat to attribute a face hit to, so this
      // logs it against the scene's first beat — good enough for "does
      // this clip need a re-render", which is all a scene shot needs here.
      const first = items[0];
      let gate = await gateCheck(first.n, first.beat, clip, 1);
      if (gate.detected) {
        console.warn(`[render] scene ${first.beat.scene}: face detected, re-rendering`);
        clip = await generateClip({ prompt, fromFrame, duration });
        gate = await gateCheck(first.n, first.beat, clip, 2);
        if (gate.detected) {
          console.warn(`[render] scene ${first.beat.scene}: face detected on re-render too, dropping scene`);
          return null;
        }
      }
    }
    await post("/api/record", {
      kind: "clip",
      session: sessionId,
      n: items[0].n,
      question,
      beats: items.map((it, i) => ({
        n: it.n,
        beat: it.beat,
        offsetSeconds: offsets[i],
        sectionEndSeconds: ends[i],
        audioDurationSeconds: durations[i],
        sources: it.beat.source.map((idx) => sentences[idx] ?? ""),
        warnings: it.warnings,
      })),
      voice,
      chain,
      translatorVersion: TRANSLATOR_VERSION,
      styleSheetVersion: STYLE_SHEET_VERSION,
      requestedDuration,
      timingMethod,
      splitMethod,
      totalNarrationSeconds,
      durationClamped,
      sceneSplit: splitInfo ? { scene: items[0].beat.scene, part: splitInfo.part, of: splitInfo.of } : null,
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
      requestedAspectRatio: "16:9",
      aspectRatioParamSent,
    });
    console.log(
      `[render] scene ${items[0].beat.scene}${splitInfo ? ` part ${splitInfo.part}/${splitInfo.of}` : ""} (beats ${items.map((it) => it.n).join(",")}) done in ${clip.ms}ms${fromFrame ? " (i2v)" : " (t2v)"}, ${duration}s (${timingMethod})`
    );
    return clip;
  }

  // WP8 §2: Saskia is generated per scene (2-3 beats in one ElevenLabs
  // request, split server-side), not per line. All beats are already known
  // at this point (the translation above ran to completion), so this runs
  // once, ahead of the video renders below, one scene at a time. WP8.2:
  // each beat's own durationSeconds (measured server-side from the
  // actually-cut mp3, same for either split method) is kept in
  // audioDurationByBeat so renderScene can compute voice-led timing.
  if (voice === "saskia") {
    const scenes = new Map<number, { n: number; text: string }[]>();
    for (const { n, beat } of beats) {
      const list = scenes.get(beat.scene) ?? [];
      list.push({ n, text: beat.delivery });
      scenes.set(beat.scene, list);
    }
    for (const [scene, sceneBeats] of scenes) {
      const res = await post("/api/voice", { session: sessionId, scene, beats: sceneBeats });
      if (res.ok) {
        const data = (await res.json()) as {
          splitMethod: "timestamps" | "silence-gap";
          beats: { n: number; durationSeconds: number | null }[];
        };
        splitMethodByScene.set(scene, data.splitMethod);
        for (const b of data.beats) audioDurationByBeat.set(b.n, b.durationSeconds);
        console.log(`[render] scene ${scene}: ${sceneBeats.length} beat(s) narrated (${data.splitMethod} split)`);
      }
    }
  }

  if (clipSeconds === 15) {
    // Group into scenes, in beat order (a scene is always a run of
    // consecutive beats — lib/translator.ts#validateProgramme).
    const scenes: { n: number; beat: Beat; warnings: string[] }[][] = [];
    for (const item of beats) {
      const last = scenes[scenes.length - 1];
      if (last && last[0].beat.scene === item.beat.scene) last.push(item);
      else scenes.push([item]);
    }

    // WP8.2 follow-up: split a scene into two (or more) chained render
    // units when its own narration exceeds SCENE_AUDIO_BUDGET_SECONDS —
    // the clamp cascade WP8.2's own report found. Flattened up front so
    // both the chained (sequential) and unchained (batched) dispatch below
    // treat a split scene's parts exactly like any other render unit.
    const renderUnits: { items: { n: number; beat: Beat; warnings: string[] }[]; splitInfo: { part: number; of: number } | null }[] = [];
    for (const items of scenes) {
      const durations = items.map((it) => audioDurationByBeat.get(it.n) ?? null);
      const groups =
        voice === "saskia" && durations.every((d): d is number => typeof d === "number" && d > 0)
          ? splitSceneByAudioBudget(items, durations)
          : [items];
      if (groups.length > 1) {
        const total = (durations as number[]).reduce((s, d) => s + d, 0);
        console.log(`[render] scene ${items[0].beat.scene}: narration ${total.toFixed(1)}s exceeds budget, split into ${groups.length} chained clips (${groups.map((g) => g.length).join("+")} beats)`);
      }
      for (let gi = 0; gi < groups.length; gi += 1) {
        renderUnits.push({ items: groups[gi], splitInfo: groups.length > 1 ? { part: gi + 1, of: groups.length } : null });
      }
    }

    if (chain === "on") {
      for (const { items, splitInfo } of renderUnits) {
        const clip = await renderScene(items, lastFrame, splitInfo);
        if (clip) {
          previousHandoff = items[items.length - 1].beat.handoff;
          lastFrame = await lastFrameOf(clip.rawUrl);
        } else {
          console.warn(`[render] scene ${items[0].beat.scene} dropped (face gate); continuing from previous frame`);
        }
      }
    } else {
      let i = 0;
      while (i < renderUnits.length) {
        const batch = renderUnits.slice(i, i + UNCHAINED_PARALLEL);
        await Promise.all(batch.map(({ items, splitInfo }) => renderScene(items, undefined, splitInfo)));
        i += UNCHAINED_PARALLEL;
      }
    }
  } else if (chain === "on") {
    for (const item of beats) {
      const clip = await renderOne(item, lastFrame);
      if (clip) {
        previousHandoff = item.beat.handoff;
        lastFrame = await lastFrameOf(clip.rawUrl);
      } else {
        console.warn(`[render] beat ${item.n} dropped (face gate); continuing from previous frame`);
      }
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
    switches: { voice, chain, music, faceGate, render: "queue", clipSeconds },
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
