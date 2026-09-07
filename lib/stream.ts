"use client";

/**
 * The Stream: turns a programme's beats into a sequence of clips.
 *
 *   the translator hands over shots one by one (addShots) as it writes them
 *        │
 *        ▼
 *   shot N generates from shot N-1's last frame while N-1 plays
 *        │  (Turbo renders faster than realtime, so the buffer grows)
 *        ▼
 *   player swaps to the next ready clip the instant the current one ends
 *
 * This is unreel's runtime. The shot queue, render buffer, last-frame chain
 * and the player handshake (peekNext/advance) are unchanged. What changed
 * for Tessera, and only this:
 *   - shots arrive from the translator via addShots()/finish() instead of
 *     the showrunner's refill() batches; there is no cold open, the first
 *     beat is a text-to-video shot;
 *   - CHAIN=on|off replaces the story/chaos title mode;
 *   - a terminal "ended" phase, set when the last shot has played, so the
 *     programme guide can start its auto-continue countdown;
 *   - renderingShot() exposes the beat in flight so the cursor can blink in
 *     its ground colour.
 */

import { generateClip, type GeneratedClip, type Resolution } from "./fal";
import { lastFrameOf } from "./frames";
import { logFaceGate } from "./recorder";
import type { Beat } from "./translator";

/** One beat within a shot, and where its section starts inside the shot's clip. 0 for every 5s/10s shot (one beat each); 0/5/10 for a WP8.1 CLIP_SECONDS=15 scene shot. */
export interface ShotBeat {
  /** 1-based beat number within the session (Saskia's split narration is keyed by this, not by position within the shot). */
  n: number;
  beat: Beat;
  offsetSeconds: number;
}

export interface Shot {
  /** 1-based number of the shot's first beat within the session. */
  n: number;
  /** One beat at 5s/10s; 2-3 beats (one scene) at 15s (WP8.1 §1) — the player treats beats after the first as timestamps within this one clip, not clip swaps. */
  beats: ShotBeat[];
  /** Full compiled clip prompt (style sheet + beat(s) + copy list + audio). */
  prompt: string;
  /** Seconds — the whole shot's clip length (5/10s for one beat, 10/15s for a scene). */
  duration: number;
  /** Chain from the previous shot's last frame (false = hard cut). */
  chain: boolean;
}

export interface ReadyClip {
  index: number;
  shot: Shot;
  videoUrl: string;
  /** Generation wall-clock, ms. */
  renderMs: number;
  duration: number;
  resolution: Resolution;
}

export interface StreamState {
  phase: "starting" | "playing" | "buffering" | "ended" | "error";
  /** Clip on screen. */
  current: ReadyClip | null;
  /** Clips generated and waiting. */
  buffered: number;
  /** Shots handed over but not yet rendered. */
  pending: number;
  /** Total shots rendered so far this session. */
  rendered: number;
  /** Shots that failed to render (logged; the programme skips them). */
  failed: number;
  /** Rolling average render time, ms. */
  avgRenderMs: number | null;
  /** Whether a render is in flight right now. */
  rendering: boolean;
  /** Whether the translator has finished handing over shots. */
  finished: boolean;
  error: string | null;
}

/**
 * WP8: the render buffer target is expressed in seconds of playback held in
 * reserve, not a clip count, so it means the same thing at any CLIP_SECONDS
 * (brief §1) — keep rendering ahead while less than this many seconds of
 * ready-or-rendering clips are on hand. WP8.1: shots can have different
 * durations within one programme (a 2-beat scene is 10s, a 3-beat scene is
 * 15s), so this is tracked as a running total of actual shot durations
 * (`bufferedSeconds`), not `queue.length * a constant`.
 */
const MIN_BUFFER_SECONDS = 10;
/** Unchained programmes render this many hard cuts at once. */
const UNCHAINED_PARALLEL = 2;
/**
 * Render resolution. Measured on Turbo: an 8s shot renders in ~5.0s at
 * 768P but ~2.4s at 480P, and a chained shot also needs ~1.5s to download
 * and grab its last frame before the next can start. Fixed at 480P
 * (CLAUDE.md hard rule 4).
 */
const RESOLUTION: Resolution = "480P";

type Listener = () => void;

export class Stream {
  private state: StreamState;
  private listeners = new Set<Listener>();
  private alive = true;

  private shots: Shot[] = [];
  private nextShotIndex = 0;
  /**
   * Rendered clips waiting to play. Unchained programmes render two at a
   * time, so clips can land out of order; the player only ever takes the
   * shot at `playIndex`, so beats play in the order they were written.
   */
  private queue: ReadyClip[] = [];
  private playIndex = 0;
  private failedShots = new Set<Shot>();
  private lastFrame: string | null = null;
  private clipCounter = 0;
  private shotCounter = 0;
  private inFlight = 0;
  private finished = false;
  private renderTimes: number[] = [];
  private seed = Math.floor(Math.random() * 1_000_000);
  /** WP8.1: seconds of playback either queued (ready) or in flight (rendering); replaces a clip-count buffer since shot duration can vary. */
  private bufferedSeconds = 0;

  constructor(
    private readonly chain: boolean,
    /** WP8: CLIP_SECONDS (lib/config.ts). Informational only — buffering uses each shot's own `duration` (WP8.1: shots can vary in length). */
    private readonly clipSeconds: number = 5,
    /** WP5.1: FACE_GATE=on (lib/config.ts). Default off — see this class's `render()` for why. */
    private readonly faceGate: boolean = false
  ) {
    this.state = {
      phase: "starting",
      current: null,
      buffered: 0,
      pending: 0,
      rendered: 0,
      failed: 0,
      avgRenderMs: null,
      rendering: false,
      finished: false,
      error: null,
    };
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): StreamState => this.state;

  private set(patch: Partial<StreamState>) {
    if (!this.alive) return;
    this.state = {
      ...this.state,
      ...patch,
      buffered: this.queue.length,
      pending: this.shots.length - this.nextShotIndex,
      rendering: this.inFlight > 0,
      finished: this.finished,
    };
    for (const listener of this.listeners) listener();
  }

  /** Begin rendering whatever shots exist; more may arrive via addShots. */
  start() {
    this.pump();
  }

  stop() {
    this.alive = false;
    this.listeners.clear();
  }

  /** The translator hands over shots as it writes them. */
  addShots(shots: Shot[]) {
    if (!this.alive || shots.length === 0) return;
    this.shots.push(...shots);
    this.pump();
  }

  /** No more shots will arrive. */
  finish() {
    if (!this.alive) return;
    this.finished = true;
    if (this.shots.length === 0) {
      this.set({ phase: "ended" });
      return;
    }
    this.set({});
  }

  /**
   * WP9: seed the stream directly from a cache hit, bypassing render()/pump()
   * entirely — every shot is already a playable clip, so there is nothing to
   * render and nothing to buffer. Reuses peekNext()/advance()/skipFailed()
   * unchanged: the player's existing effect that calls advance() once
   * buffered > 0 picks this up exactly like the live path. Purely additive;
   * does not touch render()/pump()/advance() (CLAUDE.md rule 3).
   */
  hydrateFromCache(shots: Shot[], readyClips: ReadyClip[]) {
    if (!this.alive) return;
    this.shots = shots;
    this.nextShotIndex = shots.length;
    this.queue.push(...readyClips);
    this.finished = true;
    this.set({});
  }

  private get isStory() {
    return this.chain;
  }

  private pickResolution(): Resolution {
    return RESOLUTION;
  }

  /** Keep the buffer full. Called after every state change that frees work. */
  private pump() {
    if (!this.alive) return;
    const parallel = this.isStory ? 1 : UNCHAINED_PARALLEL;
    while (
      this.inFlight < parallel &&
      this.bufferedSeconds < MIN_BUFFER_SECONDS &&
      this.nextShotIndex < this.shots.length
    ) {
      // A chained shot is rendering: its last frame is what the next shot
      // must start from, so wait for it. With nothing in flight and no
      // frame (a grab failed), fall back to a hard cut rather than stall.
      if (this.isStory && !this.lastFrame && this.inFlight > 0) break;
      const shot = this.shots[this.nextShotIndex++];
      this.bufferedSeconds += shot.duration;
      void this.render(shot);
    }
    this.set({});
  }

  private async render(shot: Shot) {
    this.inFlight += 1;
    this.set({});
    const fromFrame = shot.chain ? (this.lastFrame ?? undefined) : undefined;
    // While a chained shot renders, nothing else may chain from the stale
    // frame: clear it until this shot's own last frame is known.
    if (shot.chain) this.lastFrame = null;
    const resolution = this.pickResolution();
    try {
      let clip = await generateClip({
        prompt: shot.prompt,
        duration: shot.duration,
        resolution,
        seed: this.seed + this.shotCounter++,
        fromFrame,
      });
      if (!this.alive) return;

      // WP5.1 face gate (FACE_GATE=on, default off — see lib/config.ts):
      // sample the clip before it can reach the queue. A detection
      // re-renders the same shot once; a second detection drops the beat
      // rather than showing it (CLAUDE.md rule 6). Off by default: measured
      // false positives on ordinary approved subjects (coins, paper maps)
      // outweighed real catches in live testing — see WP5.1-handoff.md.
      if (this.faceGate) {
        let gate = await this.runFaceGate(clip);
        if (gate.detected) {
          this.logGate(shot, clip, 1, gate, "rerender");
          clip = await generateClip({
            prompt: shot.prompt,
            duration: shot.duration,
            resolution,
            seed: this.seed + this.shotCounter++,
            fromFrame,
          });
          if (!this.alive) return;
          gate = await this.runFaceGate(clip);
          if (gate.detected) {
            this.logGate(shot, clip, 2, gate, "dropped");
            console.warn(`[stream] beat ${shot.n} dropped: face detected on re-render too`);
            this.failedShots.add(shot);
            this.set({ failed: this.state.failed + 1 });
            this.inFlight -= 1;
            this.pump();
            return;
          }
          this.logGate(shot, clip, 2, gate, gate.ok ? "clean" : "gate-error");
        } else {
          this.logGate(shot, clip, 1, gate, gate.ok ? "clean" : "gate-error");
        }
      }

      const ready: ReadyClip = {
        index: this.clipCounter++,
        shot,
        videoUrl: clip.videoUrl,
        renderMs: clip.ms,
        duration: shot.duration,
        resolution,
      };
      this.noteRender(clip.ms);
      // Playable the instant it exists. The player decides when to swap (at
      // the end of the clip on screen), so a clip landing mid-replay never
      // causes a jump cut.
      this.queue.push(ready);
      this.set({});
      if (shot.chain) {
        // Only the NEXT shot needs this frame, so it is off the critical
        // path of the one that just finished.
        try {
          this.lastFrame = await lastFrameOf(clip.videoUrl);
        } catch {
          this.lastFrame = null;
        }
        if (!this.alive) return;
      }
      this.inFlight -= 1;
      this.set({});
      this.pump();
    } catch (cause) {
      this.inFlight -= 1;
      this.bufferedSeconds = Math.max(0, this.bufferedSeconds - shot.duration);
      if (!this.alive) return;
      console.warn(`[stream] beat ${shot.n} failed to render:`, cause instanceof Error ? cause.message : cause);
      this.failedShots.add(shot);
      this.set({ failed: this.state.failed + 1 });
      if (shot.chain && !this.lastFrame) {
        // Recover continuity by re-grabbing the frame from what is on screen.
        const current = this.state.current;
        if (current) {
          try {
            this.lastFrame = await lastFrameOf(current.videoUrl);
          } catch {
            /* the pump renders a hard cut instead */
          }
        }
      }
      this.pump();
    }
  }

  /**
   * WP5.1: ask /api/face-gate whether this clip shows a recognisable face.
   * Fails open (treated as clean, logged as "gate-error") on any network or
   * server error — a gate outage should not stall the programme, but this
   * is a real gap against CLAUDE.md rule 6 worth Robin/PM's attention;
   * see briefs/WP5.1-handoff.md.
   */
  private async runFaceGate(clip: GeneratedClip): Promise<{ ok: boolean; detected: boolean; attempts: unknown[]; latencyMs: number }> {
    try {
      const res = await fetch("/api/face-gate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rawUrl: clip.rawUrl }),
      });
      if (!res.ok) {
        console.warn(`[stream] face gate request failed (${res.status}); passing clip through unchecked`);
        return { ok: false, detected: false, attempts: [], latencyMs: 0 };
      }
      const result = (await res.json()) as { detected: boolean; attempts: unknown[]; latencyMs: number };
      return { ok: true, ...result };
    } catch (cause) {
      console.warn("[stream] face gate check failed; passing clip through unchecked:", cause instanceof Error ? cause.message : cause);
      return { ok: false, detected: false, attempts: [], latencyMs: 0 };
    }
  }

  private logGate(
    shot: Shot,
    clip: GeneratedClip,
    attempt: number,
    gate: { detected: boolean; attempts: unknown[]; latencyMs: number },
    outcome: "clean" | "rerender" | "dropped" | "gate-error"
  ) {
    logFaceGate(shot.prompt, {
      attempt,
      outcome,
      detected: gate.detected,
      attempts: gate.attempts,
      latencyMs: gate.latencyMs,
      clip: {
        expandedPrompt: clip.expandedPrompt,
        rawUrl: clip.rawUrl,
        requestId: clip.requestId,
        renderMs: clip.ms,
      },
    });
  }

  private noteRender(ms: number) {
    this.renderTimes.push(ms);
    if (this.renderTimes.length > 8) this.renderTimes.shift();
    const avg =
      this.renderTimes.reduce((sum, value) => sum + value, 0) /
      this.renderTimes.length;
    this.set({
      rendered: this.state.rendered + 1,
      avgRenderMs: Math.round(avg),
    });
  }

  /** Skip shots that failed to render; the programme carries on without them. */
  private skipFailed() {
    while (this.playIndex < this.shots.length && this.failedShots.has(this.shots[this.playIndex])) {
      this.playIndex += 1;
    }
  }

  /** The clip that will play next (the next shot in writing order), so the player can preload it. */
  peekNext(): ReadyClip | null {
    this.skipFailed();
    const wanted = this.shots[this.playIndex];
    if (!wanted) return null;
    return this.queue.find((clip) => clip.shot === wanted) ?? null;
  }

  /** The shot most recently sent to render, or null when nothing is in flight. */
  renderingShot(): Shot | null {
    if (this.inFlight === 0) return null;
    return this.shots[this.nextShotIndex - 1] ?? null;
  }

  /**
   * Called by the player when the on-screen clip ends. Returns false when
   * nothing is ready yet, in which case the player holds the last frame
   * and tries again when a clip lands. Once the translator has finished and
   * every shot has played, the phase becomes "ended".
   */
  advance(): boolean {
    if (!this.alive) return false;
    const next = this.peekNext();
    if (next) {
      this.queue.splice(this.queue.indexOf(next), 1);
      this.playIndex += 1;
      this.bufferedSeconds = Math.max(0, this.bufferedSeconds - next.duration);
      this.set({ phase: "playing", current: next });
      this.pump();
      return true;
    }
    this.skipFailed();
    if (this.finished && this.playIndex >= this.shots.length && this.inFlight === 0) {
      this.set({ phase: "ended" });
      return false;
    }
    this.set({ phase: "buffering" });
    this.pump();
    return false;
  }
}
