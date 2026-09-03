"use client";

/**
 * The Stream: turns a title into an endless sequence of clips.
 *
 *   cold open (pre-generated preview) plays immediately
 *        │  showrunner writes a batch of shots
 *        ▼
 *   shot N generates from shot N-1's last frame while N-1 plays
 *        │  (Turbo renders faster than realtime, so the buffer grows)
 *        ▼
 *   player swaps to the next ready clip the instant the current one ends
 *
 * Story titles chain every shot (continuity = the frame). Chaos channels
 * hard-cut, so their shots generate in parallel.
 */

import { generateClip } from "./fal";
import { lastFrameOf } from "./frames";
import { mediaUrl, type ManifestEntry, type Title } from "./catalog";
import { writeBatch, type Shot } from "./showrunner";

export interface ReadyClip {
  index: number;
  videoUrl: string;
  caption: string | null;
  /** Generation wall-clock, ms; null for the pre-generated cold open. */
  renderMs: number | null;
  duration: number;
}

export interface StreamState {
  phase: "starting" | "playing" | "buffering" | "error";
  title: Title;
  episodeTitle: string;
  /** Clip on screen. */
  current: ReadyClip | null;
  /** Clips generated and waiting. */
  buffered: number;
  /** Shots written by the showrunner but not yet rendered. */
  pending: number;
  /** Total shots rendered so far this session. */
  rendered: number;
  /** Rolling average render time, ms. */
  avgRenderMs: number | null;
  /** Whether a render is in flight right now. */
  rendering: boolean;
  error: string | null;
}

const SHOT_SECONDS_STORY = 8;
const SHOT_SECONDS_CHAOS = 5;
const BATCH_SIZE = 10;
/** Ask for the next batch when this many shots remain unrendered. */
const REFILL_AT = 3;
/** Keep at most this many rendered clips waiting. */
const MAX_BUFFER = 3;
/** Chaos channels render this many hard cuts at once. */
const CHAOS_PARALLEL = 2;

type Listener = () => void;

export class Stream {
  private state: StreamState;
  private listeners = new Set<Listener>();
  private alive = true;

  private shots: Shot[] = [];
  private nextShotIndex = 0;
  private queue: ReadyClip[] = [];
  private synopsis = "";
  private lastFrame: string | null = null;
  private lastOnScreen: string;
  private clipCounter = 0;
  private inFlight = 0;
  private writing = false;
  private renderTimes: number[] = [];
  private seed = Math.floor(Math.random() * 1_000_000);

  constructor(
    private readonly title: Title,
    private readonly asset: ManifestEntry | null
  ) {
    this.lastOnScreen = title.previewPrompt;
    this.state = {
      phase: "starting",
      title,
      episodeTitle: title.title,
      current: null,
      buffered: 0,
      pending: 0,
      rendered: 0,
      avgRenderMs: null,
      rendering: false,
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
    };
    for (const listener of this.listeners) listener();
  }

  /** Begin: cold open + first batch + first renders. */
  start() {
    void this.openCold();
  }

  stop() {
    this.alive = false;
    this.listeners.clear();
  }

  private async openCold() {
    try {
      if (this.asset) {
        // The pre-generated preview IS the cold open: instant playback, and
        // the first live shot chains from its last frame.
        const videoUrl = mediaUrl(this.asset.preview);
        const cold: ReadyClip = {
          index: this.clipCounter++,
          videoUrl,
          caption: null,
          renderMs: null,
          duration: this.asset.previewSeconds,
        };
        this.set({ phase: "playing", current: cold });
        if (this.title.mode === "story") {
          this.lastFrame = await lastFrameOf(videoUrl);
        }
      } else {
        // No catalog built: render the cold open live.
        const clip = await generateClip({
          prompt: this.title.previewPrompt,
          duration: this.seconds(),
          seed: this.seed,
        });
        if (!this.alive) return;
        const cold: ReadyClip = {
          index: this.clipCounter++,
          videoUrl: clip.videoUrl,
          caption: null,
          renderMs: clip.ms,
          duration: this.seconds(),
        };
        this.noteRender(clip.ms);
        this.set({ phase: "playing", current: cold });
        if (this.title.mode === "story") {
          this.lastFrame = await lastFrameOf(clip.videoUrl);
        }
      }
      if (!this.alive) return;
      await this.refill();
      this.pump();
    } catch (cause) {
      this.set({
        phase: "error",
        error: cause instanceof Error ? cause.message : "The stream failed to start.",
      });
    }
  }

  private seconds() {
    return this.title.mode === "story" ? SHOT_SECONDS_STORY : SHOT_SECONDS_CHAOS;
  }

  /** Ask the showrunner for more shots. */
  private async refill() {
    if (this.writing) return;
    this.writing = true;
    try {
      const batch = await writeBatch({
        title: this.title,
        synopsis: this.synopsis,
        count: BATCH_SIZE,
        seconds: this.seconds(),
        onScreen: this.lastOnScreen,
      });
      if (!this.alive) return;
      this.synopsis = batch.synopsis;
      this.shots.push(...batch.shots);
      this.set({ episodeTitle: batch.episodeTitle });
    } catch {
      // A failed batch is not fatal: the pump retries on the next tick.
    } finally {
      this.writing = false;
    }
  }

  /** Keep the buffer full. Called after every state change that frees work. */
  private pump() {
    if (!this.alive) return;
    const remaining = this.shots.length - this.nextShotIndex;
    if (remaining <= REFILL_AT && !this.writing) {
      void this.refill().then(() => this.pump());
    }
    const parallel = this.title.mode === "story" ? 1 : CHAOS_PARALLEL;
    while (
      this.inFlight < parallel &&
      this.queue.length + this.inFlight < MAX_BUFFER &&
      this.nextShotIndex < this.shots.length
    ) {
      // Story shots need the previous last frame; wait for it.
      if (this.title.mode === "story" && !this.lastFrame) break;
      const shot = this.shots[this.nextShotIndex++];
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
    try {
      const clip = await generateClip({
        prompt: shot.prompt,
        duration: shot.duration,
        seed: this.seed + this.clipCounter,
        fromFrame,
        expand: !shot.chain,
      });
      if (!this.alive) return;
      const ready: ReadyClip = {
        index: this.clipCounter++,
        videoUrl: clip.videoUrl,
        caption: shot.caption,
        renderMs: clip.ms,
        duration: shot.duration,
      };
      this.noteRender(clip.ms);
      this.lastOnScreen = shot.prompt;
      if (shot.chain) {
        this.lastFrame = await lastFrameOf(clip.videoUrl);
        if (!this.alive) return;
      }
      this.queue.push(ready);
      this.inFlight -= 1;
      if (this.state.phase === "buffering") this.advance();
      else this.set({});
      this.pump();
    } catch {
      this.inFlight -= 1;
      if (!this.alive) return;
      if (shot.chain && !this.lastFrame) {
        // Recover continuity by re-grabbing the frame from what is on screen.
        const current = this.state.current;
        if (current) {
          try {
            this.lastFrame = await lastFrameOf(current.videoUrl);
          } catch {
            /* the next pump will render a hard cut instead */
          }
        }
      }
      this.pump();
    }
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

  /** The clip that will play next, so the player can preload it. */
  peekNext(): ReadyClip | null {
    return this.queue[0] ?? null;
  }

  /** Called by the player when the on-screen clip ends. */
  advance() {
    if (!this.alive) return;
    const next = this.queue.shift();
    if (next) {
      this.set({ phase: "playing", current: next });
    } else {
      this.set({ phase: "buffering" });
    }
    this.pump();
  }
}
