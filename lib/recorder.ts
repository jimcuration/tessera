"use client";

/**
 * Client half of "save everything". Shots are registered by prompt before
 * they render; when fal returns a clip, lib/fal.ts reports it here and the
 * beat that produced it is looked up by that prompt. Prompts are unique per
 * beat within a session (the spoken line differs), so this needs no change
 * to the stream's render path.
 */

import type { Beat } from "./translator";

/** One beat within a recorded shot, self-contained. */
export interface ShotMetaBeat {
  /** 1-based beat number within the session — how reel.mjs/whisper find this beat's own split narration (<n>.mp3), regardless of its position in the shot. */
  n: number;
  beat: Beat;
  /** Seconds into the shot's clip this beat's own section starts (0 at 5s/10s; 0/5/10 for a WP8.1 15s scene shot). */
  offsetSeconds: number;
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
