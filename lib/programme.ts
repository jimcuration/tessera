"use client";

/**
 * A Session is one question's programme: ask → translate → stage → play.
 *
 * It fetches the runtime switches, streams beats from the translator
 * endpoint, compiles each into a clip prompt and hands it to the renderer
 * the moment it exists, so the first clip renders while later beats are
 * still being written. Interrupting (cancel) aborts the translation, stops
 * the stream and cancels every render in flight; the player keeps the last
 * picture up until the next session's first clip exists.
 */

import { cancelInFlight } from "./fal";
import { compilePrompt, compileScenePrompt, STYLE_SHEET_VERSION } from "./prompt";
import { registerShot, recordSession } from "./recorder";
import { createRenderer } from "./render";
import type { ReadyClip, Stream, Shot } from "./stream";
import { TRANSLATOR_VERSION, type Beat } from "./translator";
import { Narrator } from "./voice";
import type { CacheSwitch, ChainSwitch, ClipSeconds, FaceGateSwitch, RenderSwitch, VoiceSwitch } from "./config";

export interface AnswerHeader {
  question: string;
  kind: "answer" | "deflection";
  link: string | null;
  card: Record<string, unknown> | null;
  followups: string[];
  fromSpine: boolean;
  sentences: string[];
}

export interface SessionSwitches {
  voice: VoiceSwitch;
  chain: ChainSwitch;
  render: RenderSwitch;
  faceGate: FaceGateSwitch;
  clipSeconds: ClipSeconds;
}

/** WP9: the shape POST /api/cache/lookup returns on a hit. */
interface CacheLookupShotBeat {
  n: number;
  beat: Beat;
  offsetSeconds: number;
  audioUrl: string | null;
}
interface CacheLookupShot {
  n: number;
  duration: number;
  resolution: "480P" | "768P";
  videoUrl: string;
  beats: CacheLookupShotBeat[];
}
interface CacheLookupResponse {
  hit: boolean;
  sessionId?: string;
  answer?: AnswerHeader;
  beats?: Beat[];
  shots?: CacheLookupShot[];
}

export type SessionStatus =
  | "starting"
  | "translating"
  | "staging"
  | "done"
  | "none"
  | "error";

export interface SessionState {
  id: string;
  question: string;
  status: SessionStatus;
  answer: AnswerHeader | null;
  switches: SessionSwitches | null;
  beats: Beat[];
  dropped: number;
  error: string | null;
}

type Listener = () => void;

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export class Session {
  private state: SessionState;
  private listeners = new Set<Listener>();
  private controller = new AbortController();
  private alive = true;
  private askedAt = performance.now();
  private firstBeatMs: number | null = null;
  private warnings: string[][] = [];
  private droppedRaw: unknown[] = [];
  /** WP8: Saskia is generated per scene, not per line (brief §2) — beats of the scene in progress, held until the next beat's scene number changes or the translation ends. */
  private sceneBuffer: { scene: number; beats: { n: number; text: string }[] } | null = null;
  /** WP8.1 §1: at CLIP_SECONDS=15, one shot is a whole scene — beats of the scene in progress, held the same way as sceneBuffer above but carrying full Beat objects for compileScenePrompt. Unused at 5s/10s. */
  private videoSceneBuffer: { scene: number; items: { n: number; beat: Beat; warnings: string[] }[] } | null = null;
  private previousHandoff: string | null = null;
  private streamStarted = false;

  stream: Stream | null = null;
  narrator: Narrator | null = null;

  constructor(question: string) {
    this.state = {
      id: `${stamp()}-${slug(question) || "question"}`,
      question,
      status: "starting",
      answer: null,
      switches: null,
      beats: [],
      dropped: 0,
      error: null,
    };
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): SessionState => this.state;

  get id() {
    return this.state.id;
  }

  private set(patch: Partial<SessionState>) {
    if (!this.alive) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  start() {
    void this.run().catch((cause) => {
      if (!this.alive || this.controller.signal.aborted) return;
      this.fail(cause instanceof Error ? cause.message : "the programme failed to start");
    });
  }

  /** Interrupt: nothing from this session reaches the screen after this. */
  cancel() {
    this.alive = false;
    this.controller.abort();
    this.stream?.stop();
    this.narrator?.stop();
    const cancelled = cancelInFlight();
    if (cancelled > 0) console.info(`[session] cancelled ${cancelled} render(s) in flight`);
    this.listeners.clear();
  }

  private fail(error: string) {
    console.error("[session]", error);
    this.stream?.stop();
    this.set({ status: "error", error });
  }

  /** Hand the buffered scene's beats to the narrator as one request. */
  private flushScene() {
    const buffered = this.sceneBuffer;
    this.sceneBuffer = null;
    if (buffered && buffered.beats.length > 0) {
      this.narrator?.prefetchScene(buffered.scene, buffered.beats);
    }
  }

  /**
   * WP8.1 §1: compile the buffered scene's 2-3 beats into one shot (one
   * fal request, one clip) and hand it to the stream. Only used at
   * CLIP_SECONDS=15 — at 5s/10s each beat is dispatched immediately
   * instead (see the "beat" case in run()).
   */
  private flushVideoScene(voice: SessionSwitches["voice"], chain: SessionSwitches["chain"]) {
    const buffered = this.videoSceneBuffer;
    this.videoSceneBuffer = null;
    if (!buffered || buffered.items.length === 0) return;
    const beats = buffered.items.map((it) => it.beat);
    const { prompt } = compileScenePrompt({ beats, voice, previousHandoff: this.previousHandoff });
    this.previousHandoff = beats[beats.length - 1].handoff;
    const shot: Shot = {
      n: buffered.items[0].n,
      beats: buffered.items.map((it, i) => ({ n: it.n, beat: it.beat, offsetSeconds: i * 5 })),
      prompt,
      duration: beats.length * 5,
      chain: chain === "on",
    };
    registerShot(prompt, {
      session: this.id,
      n: shot.n,
      question: this.state.answer?.question ?? this.state.question,
      beats: buffered.items.map((it, i) => ({
        n: it.n,
        beat: it.beat,
        offsetSeconds: i * 5,
        sources: it.beat.source.map((idx) => this.state.answer?.sentences[idx] ?? ""),
        warnings: it.warnings,
      })),
      voice,
      chain,
      translatorVersion: TRANSLATOR_VERSION,
      styleSheetVersion: STYLE_SHEET_VERSION,
    });
    this.stream?.addShots([shot]);
    if (!this.streamStarted) {
      this.streamStarted = true;
      this.stream?.start();
    }
  }

  /**
   * WP9: ask /api/cache/lookup for a complete recording matching this
   * question and these switches; if there's a hit, hydrate the stream (and
   * narrator, under Saskia) straight from the recorded files and return
   * true — the caller returns immediately without touching /api/translate
   * or fal at all. Returns false to fall through to the live render path
   * (no hit, or the lookup itself failed — a cache outage never blocks the
   * programme). Does not call recordSession(): replaying a cache hit is not
   * a new recording, so this does not write a duplicate session under
   * RECORDINGS_DIR (see briefs/WP9-handoff.md).
   */
  private async tryCache(switches: SessionSwitches, signal: AbortSignal): Promise<boolean> {
    let data: CacheLookupResponse;
    try {
      const res = await fetch("/api/cache/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: this.state.question }),
        signal,
      });
      if (!this.alive) return true;
      if (!res.ok) return false;
      data = (await res.json()) as CacheLookupResponse;
    } catch (cause) {
      if (this.controller.signal.aborted) return true;
      console.warn("[session] cache lookup failed, rendering live:", cause instanceof Error ? cause.message : cause);
      return false;
    }
    if (!data.hit || !data.sessionId || !data.answer || !data.beats || !data.shots || data.shots.length === 0) {
      return false;
    }

    this.set({ answer: data.answer, beats: data.beats });

    let stream: Stream;
    try {
      stream = createRenderer(switches.render, {
        chain: switches.chain === "on",
        faceGate: switches.faceGate === "on",
        clipSeconds: switches.clipSeconds,
      });
    } catch (cause) {
      this.fail(cause instanceof Error ? cause.message : "renderer unavailable");
      return true;
    }
    this.stream = stream;
    if (switches.voice === "saskia") this.narrator = new Narrator(this.id);
    this.set({});

    const shots: Shot[] = data.shots.map((s) => ({
      n: s.n,
      beats: s.beats.map((b) => ({ n: b.n, beat: b.beat, offsetSeconds: b.offsetSeconds })),
      // No prompt was re-fetched for a cache hit; hydrateFromCache never
      // renders, so this is never read except in passing (debug logs).
      prompt: "",
      duration: s.duration,
      chain: switches.chain === "on",
    }));
    const readyClips: ReadyClip[] = data.shots.map((s, i) => ({
      index: i,
      shot: shots[i],
      videoUrl: s.videoUrl,
      renderMs: 0,
      duration: s.duration,
      resolution: s.resolution,
    }));

    if (this.narrator) {
      for (const s of data.shots) {
        for (const b of s.beats) {
          if (b.audioUrl) this.narrator.useCachedTrack(b.n, b.audioUrl);
        }
      }
    }

    stream.hydrateFromCache(shots, readyClips);
    for (const clip of readyClips) {
      console.info(`[session] beat ${clip.shot.n}: source: cache (${data.sessionId})`);
    }
    this.set({ status: "done" });
    return true;
  }

  private async run() {
    const signal = this.controller.signal;

    const configRes = await fetch("/api/config", { cache: "no-store", signal });
    const config = (await configRes.json()) as SessionSwitches & { missing: string[]; cache: CacheSwitch };
    if (!this.alive) return;
    if (config.missing.includes("FAL_KEY")) {
      this.fail("FAL_KEY is missing from .env.local");
      return;
    }
    if (config.voice === "saskia" && config.missing.includes("ELEVENLABS_API_KEY")) {
      this.fail("ELEVENLABS_API_KEY is missing from .env.local");
      return;
    }
    const switches: SessionSwitches = {
      voice: config.voice,
      chain: config.chain,
      render: config.render,
      faceGate: config.faceGate,
      clipSeconds: config.clipSeconds,
    };
    // Session ids carry the switches so recordings compare cleanly.
    this.state = {
      ...this.state,
      id: `${this.state.id}-${switches.voice}-chain-${switches.chain}`,
    };
    this.set({ switches });

    // WP9: CACHE=on|off (default on) — a complete recording matching this
    // question, these switches and the current translator/style-sheet
    // versions plays back from RECORDINGS_DIR instead of rendering live.
    // Placed here (rather than the very first thing in run(), which is
    // where the WP9 brief puts it) so the FAL_KEY/ELEVENLABS_API_KEY
    // secrets checks above still run first — see briefs/WP9-handoff.md for
    // why that ordering was kept.
    if (config.cache !== "off") {
      const hit = await this.tryCache(switches, signal);
      if (!this.alive) return;
      if (hit) return;
    }

    let stream: Stream;
    try {
      stream = createRenderer(switches.render, {
        chain: switches.chain === "on",
        faceGate: switches.faceGate === "on",
        clipSeconds: switches.clipSeconds,
      });
    } catch (cause) {
      this.fail(cause instanceof Error ? cause.message : "renderer unavailable");
      return;
    }
    this.stream = stream;
    if (switches.voice === "saskia") this.narrator = new Narrator(this.id);
    // Listeners re-read `stream` on every notification: tell them it exists.
    this.set({});

    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: this.state.question }),
      signal,
    });
    if (!this.alive) return;
    if (res.status === 404) {
      this.set({ status: "none" });
      return;
    }
    if (!res.ok || !res.body) {
      this.fail(`translator ${res.status}`);
      return;
    }
    this.set({ status: "translating" });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let translateMs: number | null = null;
    let translateSource: string | null = null;

    const handle = (msg: Record<string, unknown>) => {
      switch (msg.type) {
        case "answer": {
          const answer: AnswerHeader = {
            question: String(msg.question ?? this.state.question),
            kind: msg.kind === "deflection" ? "deflection" : "answer",
            link: typeof msg.link === "string" ? msg.link : null,
            card: (msg.card as Record<string, unknown> | null) ?? null,
            followups: Array.isArray(msg.followups) ? (msg.followups as string[]) : [],
            fromSpine: Boolean(msg.fromSpine),
            sentences: Array.isArray(msg.sentences) ? (msg.sentences as string[]) : [],
          };
          this.set({ answer });
          break;
        }
        case "beat": {
          const beat = msg.beat as Beat;
          const n = Number(msg.n);
          const warnings = Array.isArray(msg.warnings) ? (msg.warnings as string[]) : [];
          if (this.firstBeatMs === null) this.firstBeatMs = Math.round(performance.now() - this.askedAt);
          this.warnings.push(warnings);

          if (switches.clipSeconds === 15) {
            // WP8.1 §1: one shot = one whole scene. Buffer this beat;
            // dispatch the scene as one fal request the moment the next
            // beat starts a new scene (or at "done" for the last scene) —
            // mirrors the Saskia scene buffer below.
            if (this.videoSceneBuffer && this.videoSceneBuffer.scene !== beat.scene) {
              this.flushVideoScene(switches.voice, switches.chain);
            }
            if (!this.videoSceneBuffer) this.videoSceneBuffer = { scene: beat.scene, items: [] };
            this.videoSceneBuffer.items.push({ n, beat, warnings });
          } else {
            const { prompt } = compilePrompt({ beat, voice: switches.voice, previousHandoff: this.previousHandoff, clipSeconds: switches.clipSeconds });
            this.previousHandoff = beat.handoff;
            const shot: Shot = {
              n,
              beats: [{ n, beat, offsetSeconds: 0 }],
              prompt,
              duration: switches.clipSeconds,
              chain: switches.chain === "on",
            };
            registerShot(prompt, {
              session: this.id,
              n,
              question: this.state.answer?.question ?? this.state.question,
              beats: [
                {
                  n,
                  beat,
                  offsetSeconds: 0,
                  sources: beat.source.map((i) => this.state.answer?.sentences[i] ?? ""),
                  warnings,
                },
              ],
              voice: switches.voice,
              chain: switches.chain,
              translatorVersion: TRANSLATOR_VERSION,
              styleSheetVersion: STYLE_SHEET_VERSION,
            });
            this.stream?.addShots([shot]);
            if (!this.streamStarted) {
              this.streamStarted = true;
              this.stream?.start();
            }
          }

          // WP8: Saskia's narration is generated per scene, not per line
          // (brief §2): buffer this beat and flush the scene the moment the
          // next beat starts a new one (or at "done" for the last scene).
          if (this.narrator) {
            if (this.sceneBuffer && this.sceneBuffer.scene !== beat.scene) this.flushScene();
            if (!this.sceneBuffer) this.sceneBuffer = { scene: beat.scene, beats: [] };
            this.sceneBuffer.beats.push({ n, text: beat.delivery });
          }
          this.set({ status: "staging", beats: [...this.state.beats, beat] });
          break;
        }
        case "dropped": {
          this.droppedRaw.push(msg);
          console.warn("[translator] beat dropped:", msg.reason, msg.raw);
          this.set({ dropped: this.state.dropped + 1 });
          break;
        }
        case "done": {
          translateMs = typeof msg.ms === "number" ? msg.ms : null;
          translateSource = typeof msg.source === "string" ? msg.source : null;
          break;
        }
        case "error": {
          this.fail(String(msg.error ?? "translator failed"));
          break;
        }
        default:
          break;
      }
    };

    while (this.alive) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf("\n");
      while (nl !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) {
          try {
            handle(JSON.parse(line) as Record<string, unknown>);
          } catch {
            console.warn("[session] bad line from translator:", line.slice(0, 120));
          }
        }
        nl = buffer.indexOf("\n");
      }
    }
    if (!this.alive) return;
    if (this.state.status === "error") return;
    if (switches.clipSeconds === 15) this.flushVideoScene(switches.voice, switches.chain);
    this.flushScene();

    stream.finish();
    this.set({ status: "done" });
    recordSession(this.id, {
      question: this.state.question,
      matchedQuestion: this.state.answer?.question ?? null,
      answerKind: this.state.answer?.kind ?? null,
      link: this.state.answer?.link ?? null,
      followups: this.state.answer?.followups ?? [],
      fromSpine: this.state.answer?.fromSpine ?? false,
      sentences: this.state.answer?.sentences ?? [],
      switches,
      translatorVersion: TRANSLATOR_VERSION,
      styleSheetVersion: STYLE_SHEET_VERSION,
      translateSource,
      translateMs,
      firstBeatMs: this.firstBeatMs,
      beats: this.state.beats,
      warnings: this.warnings,
      dropped: this.droppedRaw,
      askedAt: new Date(Date.now() - (performance.now() - this.askedAt)).toISOString(),
    });
  }
}
