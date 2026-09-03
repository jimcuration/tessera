"use client";

/**
 * The Stream: turns a title into an endless sequence of clips.
 *
 *   cold open (pre-generated preview) plays immediately
 *        │  showrunner writes a SHORT first batch (fast), then a full one
 *        ▼
 *   shot N generates from shot N-1's last frame while N-1 plays
 *        │  (Turbo renders faster than realtime, so the buffer grows)
 *        ▼
 *   player swaps to the next ready clip the instant the current one ends
 *
 * Story titles chain every shot (continuity = the frame). Chaos channels
 * hard-cut, so their shots generate in parallel.
 */

import { generateClip, type Resolution } from "./fal";
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
  /** Native render resolution; null for the pre-generated cold open. */
  resolution: Resolution | null;
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
  /** Whether the showrunner is writing right now. */
  writing: boolean;
  error: string | null;
}

const SHOT_SECONDS_STORY = 8;
const SHOT_SECONDS_CHAOS = 5;
/**
 * Batch sizes cascade: 1 shot, then 4, then 10 from there on. The LLM
 * takes ~2s for one shot and ~10s for ten, and the first live shot must be
 * rendered before the 6s cold open ends. One shot gets rendering started
 * at ~2s; the 4-shot batch lands while it renders; the 10-shot batches
 * stay far ahead once the buffer exists.
 */
const BATCH_SIZES = [1, 4, 10];
/** Ask for the next batch when this many shots remain unrendered. */
const REFILL_AT = 3;
/** Keep at most this many rendered clips waiting. */
const MAX_BUFFER = 3;
/** Chaos channels render this many hard cuts at once. */
const CHAOS_PARALLEL = 2;
/**
 * Render resolution. Measured on Turbo: an 8s shot renders in ~5.0s at
 * 768P but ~2.4s at 480P, and a story shot also needs ~1.5s to download
 * and grab its last frame before the next can start. At 768P the chain
 * barely keeps pace with playback; at 480P the buffer fills in two shots.
 * Fixed at 480P for now; flip to "768P" (or make it adaptive on
 * queue.length) once the chain has more headroom.
 */
const RESOLUTION: Resolution = "480P";

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
  private shotCounter = 0;
  private inFlight = 0;
  private writing = false;
  private renderTimes: number[] = [];
  private batches = 0;
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
      writing: false,
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
      writing: this.writing,
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

  private get isStory() {
    return this.title.mode === "story";
  }

  private async openCold() {
    try {
      // The showrunner starts writing the moment Play is pressed; it does
      // not wait for the cold open to load or for its frame grab.
      const firstBatch = this.refill();

      let videoUrl: string;
      if (this.asset) {
        // The pre-generated preview IS the cold open: instant playback, and
        // the first live shot chains from its last frame.
        videoUrl = mediaUrl(this.asset.preview);
        const cold: ReadyClip = {
          index: this.clipCounter++,
          videoUrl,
          caption: null,
          renderMs: null,
          duration: this.asset.previewSeconds,
          resolution: null,
        };
        this.set({ phase: "playing", current: cold });
      } else {
        // No catalog built: render the cold open live.
        const resolution = this.pickResolution();
        const clip = await generateClip({
          prompt: this.title.previewPrompt,
          duration: this.seconds(),
          resolution,
          seed: this.seed,
        });
        if (!this.alive) return;
        videoUrl = clip.videoUrl;
        const cold: ReadyClip = {
          index: this.clipCounter++,
          videoUrl,
          caption: null,
          renderMs: clip.ms,
          duration: this.seconds(),
          resolution,
        };
        this.noteRender(clip.ms);
        this.set({ phase: "playing", current: cold });
      }

      if (this.isStory) {
        try {
          this.lastFrame = await lastFrameOf(videoUrl);
        } catch {
          // Continuity is nice to have; the first shot becomes a hard cut.
          this.lastFrame = null;
        }
        if (!this.alive) return;
      }
      await firstBatch;
      this.pump();
    } catch (cause) {
      this.set({
        phase: "error",
        error: cause instanceof Error ? cause.message : "The stream failed to start.",
      });
    }
  }

  private seconds() {
    return this.isStory ? SHOT_SECONDS_STORY : SHOT_SECONDS_CHAOS;
  }

  private pickResolution(): Resolution {
    return RESOLUTION;
  }

  /** Ask the showrunner for more shots. */
  private async refill() {
    if (this.writing) return;
    this.writing = true;
    this.set({});
    const count = BATCH_SIZES[Math.min(this.batches, BATCH_SIZES.length - 1)];
    try {
      const batch = await writeBatch({
        title: this.title,
        synopsis: this.synopsis,
        count,
        seconds: this.seconds(),
        onScreen: this.lastOnScreen,
        opening: this.synopsis === "",
      });
      if (!this.alive) return;
      this.synopsis = batch.synopsis;
      this.shots.push(...batch.shots);
      this.batches += 1;
      this.writing = false;
      this.set({ episodeTitle: batch.episodeTitle });
    } catch {
      // A failed batch is not fatal: the pump retries on the next tick.
      this.writing = false;
      this.set({});
    }
  }

  /** Keep the buffer full. Called after every state change that frees work. */
  private pump() {
    if (!this.alive) return;
    const remaining = this.shots.length - this.nextShotIndex;
    if (remaining <= REFILL_AT && !this.writing) {
      void this.refill().then(() => this.pump());
    }
    const parallel = this.isStory ? 1 : CHAOS_PARALLEL;
    while (
      this.inFlight < parallel &&
      this.queue.length + this.inFlight < MAX_BUFFER &&
      this.nextShotIndex < this.shots.length
    ) {
      // A chained shot is rendering: its last frame is what the next shot
      // must start from, so wait for it. With nothing in flight and no
      // frame (a grab failed), fall back to a hard cut rather than stall.
      if (this.isStory && !this.lastFrame && this.inFlight > 0) break;
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
    const resolution = this.pickResolution();
    try {
      const clip = await generateClip({
        prompt: shot.prompt,
        duration: shot.duration,
        resolution,
        seed: this.seed + this.shotCounter++,
        fromFrame,
        expand: !shot.chain && !shot.caption,
      });
      if (!this.alive) return;
      const ready: ReadyClip = {
        index: this.clipCounter++,
        videoUrl: clip.videoUrl,
        caption: shot.caption,
        renderMs: clip.ms,
        duration: shot.duration,
        resolution,
      };
      this.noteRender(clip.ms);
      this.lastOnScreen = shot.prompt;
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
            /* the pump renders a hard cut instead */
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

  /**
   * Called by the player when the on-screen clip ends. Returns false when
   * nothing is ready yet, in which case the player replays the current clip
   * (a loop beats a spinner) and tries again at its end.
   */
  advance(): boolean {
    if (!this.alive) return false;
    const next = this.queue.shift();
    if (next) {
      this.set({ phase: "playing", current: next });
      this.pump();
      return true;
    }
    this.set({ phase: "buffering" });
    this.pump();
    return false;
  }
}
