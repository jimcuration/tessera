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
import { compilePrompt, compileScenePrompt, computeVoiceLedTiming, sceneOffsetSeconds, splitSceneByAudioBudget, STYLE_SHEET_VERSION, type SceneSection } from "./prompt";
import { registerShot, recordSession } from "./recorder";
import { createRenderer } from "./render";
import type { ReadyClip, Stream, Shot } from "./stream";
import { TRANSLATOR_VERSION, type Beat } from "./translator";
import { Narrator } from "./voice";
import type { AudioSwitch, CacheSwitch, ChainSwitch, ClipSeconds, FaceGateSwitch, RenderSwitch, VoiceSwitch } from "./config";

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
  /** WP8: Saskia is generated per scene, not per line (brief §2) — beats of the scene in progress, held until the next beat's scene number changes or the translation ends. Only used at 5s/10s (WP8.2: at 15s, flushVideoScene below handles narration itself, since it needs the durations before it can compile the prompt). */
  private sceneBuffer: { scene: number; beats: { n: number; text: string }[] } | null = null;
  /** WP8.1 §1: at CLIP_SECONDS=15, one shot is a whole scene — beats of the scene in progress, held the same way as sceneBuffer above but carrying full Beat objects for compileScenePrompt. Unused at 5s/10s. */
  private videoSceneBuffer: { scene: number; items: { n: number; beat: Beat; warnings: string[] }[] } | null = null;
  private previousHandoff: string | null = null;
  private streamStarted = false;
  /**
   * WP8.2: scenes must dispatch to `stream` in the order they were
   * translated, but `flushVideoScene` is now async (it awaits Saskia's
   * audio before it can compute voice-led timing) — scene N+1's beats can
   * finish buffering, and its ElevenLabs round-trip can resolve, before
   * scene N's does. This chain serializes only the flush functions
   * themselves (audio fetch + compile + dispatch), not the render pipeline
   * (`stream` renders whatever it's handed independently, in its own time),
   * so it costs cross-scene latency in the narration fetch only, not in
   * video render throughput.
   */
  private flushChain: Promise<void> = Promise.resolve();

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
   * WP8.1 §1 / WP8.2: take the buffered scene's 2-3 beats off the buffer and
   * queue their compile+dispatch on `flushChain` so scenes still reach
   * `stream.addShots` in translation order even though the work in between
   * (awaiting Saskia's audio) is now async. Only used at CLIP_SECONDS=15 —
   * at 5s/10s each beat is dispatched immediately instead (see the "beat"
   * case in run()).
   */
  private queueFlushVideoScene(voice: SessionSwitches["voice"], chain: SessionSwitches["chain"]) {
    const buffered = this.videoSceneBuffer;
    this.videoSceneBuffer = null;
    if (!buffered || buffered.items.length === 0) return;
    this.flushChain = this.flushChain.then(() => this.flushVideoScene(buffered, voice, chain)).catch((cause) => {
      console.error(`[session] scene ${buffered.scene} failed to stage:`, cause instanceof Error ? cause.message : cause);
    });
  }

  private async flushVideoScene(
    buffered: { scene: number; items: { n: number; beat: Beat; warnings: string[] }[] },
    voice: SessionSwitches["voice"],
    chain: SessionSwitches["chain"]
  ) {
    // WP8.2 items 1-3: for Saskia, generate this scene's narration first —
    // and wait for it — so the video prompt's section timecodes and the
    // clip's own requested duration come from the beats' real audio
    // lengths, not a fixed 5s-per-beat guess. Native voice has no separate
    // narration track to time against (the video model speaks the line
    // itself), so it keeps WP8.1's fixed timing unchanged.
    let groups: { n: number; beat: Beat; warnings: string[] }[][] = [buffered.items];
    let timingMethod: "voice-led" | "fixed" = "fixed";
    let splitMethod: "timestamps" | "silence-gap" | null = null;
    let durationsByGroup: (number | null)[][] = [buffered.items.map(() => null)];

    if (voice === "saskia" && this.narrator) {
      const sceneBeatsForAudio = buffered.items.map((it) => ({ n: it.n, text: it.beat.delivery }));
      const result = await this.narrator.prefetchScene(buffered.scene, sceneBeatsForAudio);
      const durations = buffered.items.map((it) => result.beats.get(it.n)?.durationSeconds ?? null);
      if (durations.every((d): d is number => typeof d === "number" && d > 0)) {
        splitMethod = result.splitMethod;
        timingMethod = "voice-led";
        // WP8.2 follow-up: a scene whose own narration exceeds
        // SCENE_AUDIO_BUDGET_SECONDS is split at a beat boundary into two
        // (or more, recursively) chained clips instead of one clip whose
        // requested duration would otherwise have to be clamped to
        // FAL_DURATION_MAX — the clamp cascade WP8.2's own report found.
        groups = splitSceneByAudioBudget(buffered.items, durations);
        let cursor = 0;
        durationsByGroup = groups.map((g) => {
          const slice = durations.slice(cursor, cursor + g.length);
          cursor += g.length;
          return slice;
        });
        if (groups.length > 1) {
          console.info(
            `[session] scene ${buffered.scene}: narration ${durations.reduce((s, d) => s + d, 0).toFixed(1)}s exceeds budget, split into ${groups.length} chained clips (${groups.map((g) => g.length).join("+")} beats)`
          );
        }
      } else {
        console.warn(`[session] scene ${buffered.scene}: Saskia audio durations unavailable, falling back to fixed 5s-per-beat timing`);
      }
    }

    for (let gi = 0; gi < groups.length; gi += 1) {
      const groupItems = groups[gi];
      const groupBeats = groupItems.map((it) => it.beat);
      const durations = durationsByGroup[gi];

      let sections: SceneSection[] | undefined;
      let requestedDuration = groupBeats.length * 5;
      let totalNarrationSeconds: number | null = null;
      let durationClamped = false;

      if (timingMethod === "voice-led" && durations.every((d): d is number => typeof d === "number" && d > 0)) {
        const timing = computeVoiceLedTiming(durations);
        sections = timing.sections;
        requestedDuration = timing.requestedDuration;
        totalNarrationSeconds = timing.totalNarrationSeconds;
        durationClamped = timing.clamped;
      }

      const { prompt } = compileScenePrompt({ beats: groupBeats, voice, previousHandoff: this.previousHandoff, sections, clipSeconds: requestedDuration });
      this.previousHandoff = groupBeats[groupBeats.length - 1].handoff;
      const offsets = sections ? sections.map((s) => s.start) : groupBeats.map((_, i) => sceneOffsetSeconds(i));
      const ends = sections ? sections.map((s) => s.end) : groupBeats.map((_, i) => sceneOffsetSeconds(i) + 5);
      const shot: Shot = {
        n: groupItems[0].n,
        beats: groupItems.map((it, i) => ({ n: it.n, beat: it.beat, offsetSeconds: offsets[i] })),
        prompt,
        duration: requestedDuration,
        chain: chain === "on",
      };
      registerShot(prompt, {
        session: this.id,
        n: shot.n,
        question: this.state.answer?.question ?? this.state.question,
        beats: groupItems.map((it, i) => ({
          n: it.n,
          beat: it.beat,
          offsetSeconds: offsets[i],
          sectionEndSeconds: ends[i],
          audioDurationSeconds: durations[i] ?? null,
          sources: it.beat.source.map((idx) => this.state.answer?.sentences[idx] ?? ""),
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
        sceneSplit: groups.length > 1 ? { scene: buffered.scene, part: gi + 1, of: groups.length } : null,
      });
      this.stream?.addShots([shot]);
      if (!this.streamStarted) {
        this.streamStarted = true;
        this.stream?.start();
      }
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
  private async tryCache(switches: SessionSwitches, signal: AbortSignal, narratorMuted: boolean): Promise<boolean> {
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
    if (switches.voice === "saskia") {
      this.narrator = new Narrator(this.id);
      this.narrator.muted = narratorMuted;
    }
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
    const config = (await configRes.json()) as SessionSwitches & { missing: string[]; cache: CacheSwitch; audio: AudioSwitch };
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
    // WP9: AUDIO=off (default on) mutes narration playback only — read
    // once here and applied to whichever Narrator gets constructed below
    // (cache-hit or live path). Never affects rendering/recording.
    const narratorMuted = config.audio === "off";

    // WP9: CACHE=on|off (default on) — a complete recording matching this
    // question, these switches and the current translator/style-sheet
    // versions plays back from RECORDINGS_DIR instead of rendering live.
    // Placed here (rather than the very first thing in run(), which is
    // where the WP9 brief puts it) so the FAL_KEY/ELEVENLABS_API_KEY
    // secrets checks above still run first — see briefs/WP9-handoff.md for
    // why that ordering was kept.
    if (config.cache !== "off") {
      const hit = await this.tryCache(switches, signal, narratorMuted);
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
    if (switches.voice === "saskia") {
      this.narrator = new Narrator(this.id);
      this.narrator.muted = narratorMuted;
    }
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
            // beat starts a new scene (or at "done" for the last scene).
            // WP8.2: narration for this scene is now generated (and
            // awaited) inside flushVideoScene itself, ahead of compiling
            // the prompt, so there's no separate sceneBuffer/flushScene
            // step for this path any more (see the else branch below).
            if (this.videoSceneBuffer && this.videoSceneBuffer.scene !== beat.scene) {
              this.queueFlushVideoScene(switches.voice, switches.chain);
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
                  sectionEndSeconds: switches.clipSeconds,
                  audioDurationSeconds: null,
                  sources: beat.source.map((i) => this.state.answer?.sentences[i] ?? ""),
                  warnings,
                },
              ],
              voice: switches.voice,
              chain: switches.chain,
              translatorVersion: TRANSLATOR_VERSION,
              styleSheetVersion: STYLE_SHEET_VERSION,
              requestedDuration: switches.clipSeconds,
              timingMethod: "fixed",
              splitMethod: null,
              totalNarrationSeconds: null,
              durationClamped: false,
              sceneSplit: null,
            });
            this.stream?.addShots([shot]);
            if (!this.streamStarted) {
              this.streamStarted = true;
              this.stream?.start();
            }

            // WP8: Saskia's narration is generated per scene, not per line
            // (brief §2), for the 5s/10s per-beat path only — buffer this
            // beat and flush the scene the moment the next beat starts a
            // new one (or at "done" for the last scene). At 15s scene mode
            // (the `if` branch above), flushVideoScene handles narration
            // generation itself (WP8.2).
            if (this.narrator) {
              if (this.sceneBuffer && this.sceneBuffer.scene !== beat.scene) this.flushScene();
              if (!this.sceneBuffer) this.sceneBuffer = { scene: beat.scene, beats: [] };
              this.sceneBuffer.beats.push({ n, text: beat.delivery });
            }
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
    if (switches.clipSeconds === 15) {
      this.queueFlushVideoScene(switches.voice, switches.chain);
      // WP8.2: the last scene's flush is now async (it awaits Saskia's
      // audio before dispatching) — wait for the whole chain to drain
      // before telling `stream` no more shots are coming, or `finish()`
      // could mark the programme "ended" before the final shot ever
      // reaches `addShots`.
      await this.flushChain;
    } else {
      this.flushScene();
    }

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
