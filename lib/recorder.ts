"use client";

/**
 * Client half of "save everything". Shots are registered by prompt before
 * they render; when fal returns a clip, lib/fal.ts reports it here and the
 * beat that produced it is looked up by that prompt. Prompts are unique per
 * beat within a session (the spoken line differs), so this needs no change
 * to the stream's render path.
 */

import type { PaletteId } from "./palette";
import type { Beat } from "./translator";

/** One beat within a recorded shot, self-contained. */
export interface ShotMetaBeat {
  /** 1-based beat number within the session — how reel.mjs/whisper find this beat's own split narration (<n>.mp3), regardless of its position in the shot. */
  n: number;
  beat: Beat;
  /** Seconds into the shot's clip this beat's own section starts (0 at 5s/10s; 0/5/10 for a WP8.1 fixed 15s scene shot; audio-derived for a WP8.2 voice-led scene shot). */
  offsetSeconds: number;
  /** WP8.2: seconds into the shot's clip this beat's own section ends (the other half of the boundary compiled into the prompt). Equal to the next beat's offsetSeconds, or the shot's requestedDuration for the last beat. */
  sectionEndSeconds: number;
  /** WP8.2: this beat's own narrated-audio duration in seconds (from ElevenLabs, measured from the actually-cut mp3), or null when voice-led timing was not used for this shot (native voice, or timing unavailable — see the shot-level `timingMethod`). */
  audioDurationSeconds: number | null;
  /** The sentences this beat's `source` indexes, for a self-contained record. */
  sources: string[];
  warnings: string[];
}

export interface ShotMeta {
  session: string;
  /** 1-based number of the shot's first beat within the session. */
  n: number;
  question: string;
  /** One entry at 5s/10s; 2-3 (one scene) at CLIP_SECONDS=15 (WP8.1 §1). */
  beats: ShotMetaBeat[];
  voice: "native" | "saskia";
  chain: "on" | "off";
  translatorVersion: string;
  styleSheetVersion: string;
  /** Versions the timing computation this shot's sections were built with (lib/prompt.ts#TIMING_VERSION) — bumped when computeVoiceLedTiming changes, so cache matching (lib/cache.ts) can't offer a shot timed under the old method as a hit for a new question. */
  timingVersion: string;
  /** WP7: the palette (lib/palette.ts) this shot's ground/chip/ribbon colours were resolved through — null is the unset default. Matched exactly by lib/cache.ts, since a palette change recolours the rendered video without bumping styleSheetVersion. */
  palette: PaletteId | null;
  /** WP8.2: seconds requested of fal for this shot's clip (previously not recorded at all — inferred, wrongly once shots could vary in length, from beat count). */
  requestedDuration: number;
  /** WP8.2 item 6: "voice-led" when section boundaries/duration came from Saskia's own per-beat audio durations; "fixed" when WP8.1's flat 5s-per-beat timing was used instead (native voice, clipSeconds !== 15, or voice-led timing could not be computed for this scene). */
  timingMethod: "voice-led" | "fixed";
  /** WP8.2: which ElevenLabs split path produced the per-beat audio durations this shot's timing is based on, when timingMethod is "voice-led". */
  splitMethod: "timestamps" | "silence-gap" | null;
  /** WP8.2: sum of the beats' own audioDurationSeconds, before the 1.0s air and the clamp to fal's range — null when timingMethod is "fixed". */
  totalNarrationSeconds: number | null;
  /** WP8.2: true when totalNarrationSeconds + 1.0s, rounded up, fell outside fal's accepted range (FAL_DURATION_MIN/MAX, lib/prompt.ts) and requestedDuration had to be clamped. */
  durationClamped: boolean;
  /** WP8.2 follow-up: non-null when this shot is one chained part of a scene that was split across multiple clips because its total narration exceeded SCENE_AUDIO_BUDGET_SECONDS (lib/prompt.ts#splitSceneByAudioBudget) — 1-based `part` of `of` parts, in play order. Null for a scene rendered as a single shot (the common case). */
  sceneSplit: { scene: number; part: number; of: number } | null;
}

export interface ClipInfo {
  prompt: string;
  expandedPrompt: string | null;
  rawUrl: string;
  requestId: string | null;
  endpoint: string;
  chained: boolean;
  seed: number | undefined;
  resolution: string;
  renderMs: number;
  timings: unknown;
  /** WP8.2: the aspect ratio this request asked fal for (style sheet: always 16:9). */
  requestedAspectRatio: string;
  /** WP8.2: whether fal's `aspect_ratio` input field was actually sent with this request — true on the text-to-video (unchained) endpoint, false on image-to-video, which has no such field in fal's schema at all (checked directly against the published API schema, not assumed). */
  aspectRatioParamSent: boolean;
}

const byPrompt = new Map<string, ShotMeta>();

export function registerShot(prompt: string, meta: ShotMeta) {
  byPrompt.set(prompt, meta);
}

async function post(body: unknown) {
  try {
    const res = await fetch("/api/record", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.warn("[recorder] save failed:", res.status);
  } catch (cause) {
    console.warn("[recorder] save failed:", cause instanceof Error ? cause.message : cause);
  }
}

/** Called by lib/fal.ts the moment a clip exists. */
export function onClip(info: ClipInfo) {
  const meta = byPrompt.get(info.prompt);
  if (!meta) return;
  void post({ kind: "clip", ...meta, ...info, renderedAt: new Date().toISOString() });
}

export function recordSession(session: string, manifest: Record<string, unknown>) {
  void post({ kind: "session", session, ...manifest });
}

/** WP5.1: one entry per face-gate check against a beat's rendered clip. */
export interface FaceGateLogEvent {
  /** 1 = first render checked, 2 = the one re-render. */
  attempt: number;
  outcome: "clean" | "rerender" | "dropped" | "gate-error";
  detected: boolean;
  attempts: unknown;
  latencyMs: number;
  /**
   * The checked clip's own metadata, carried here (not just in <n>.json)
   * because a rejected clip's <n>.json gets overwritten by the re-render
   * that follows it — CLAUDE.md rule 7 still wants it saved somewhere.
   */
  clip: {
    expandedPrompt: string | null;
    rawUrl: string;
    requestId: string | null;
    renderMs: number;
  };
}

/** Called by lib/stream.ts after each face-gate check. */
export function logFaceGate(prompt: string, event: FaceGateLogEvent) {
  const meta = byPrompt.get(prompt);
  if (!meta) return;
  void post({ kind: "faceGate", ...meta, ...event, loggedAt: new Date().toISOString() });
}
