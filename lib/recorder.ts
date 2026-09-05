"use client";

/**
 * Client half of "save everything". Shots are registered by prompt before
 * they render; when fal returns a clip, lib/fal.ts reports it here and the
 * beat that produced it is looked up by that prompt. Prompts are unique per
 * beat within a session (the spoken line differs), so this needs no change
 * to the stream's render path.
 */

import type { Beat } from "./translator";

export interface ShotMeta {
  session: string;
  /** 1-based beat number within the session. */
  n: number;
  question: string;
  beat: Beat;
  /** The sentences the beat's `source` indexes, for a self-contained record. */
  sources: string[];
  warnings: string[];
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
