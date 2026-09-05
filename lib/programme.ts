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
import { compilePrompt, STYLE_SHEET_VERSION } from "./prompt";
import { registerShot, recordSession } from "./recorder";
import { createRenderer } from "./render";
import type { Stream, Shot } from "./stream";
import { TRANSLATOR_VERSION, type Beat } from "./translator";
import { Narrator } from "./voice";
import type { ChainSwitch, RenderSwitch, VoiceSwitch } from "./config";

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

const SHOT_SECONDS = 5;

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

  private async run() {
    const signal = this.controller.signal;

    const configRes = await fetch("/api/config", { cache: "no-store", signal });
    const config = (await configRes.json()) as SessionSwitches & { missing: string[] };
    if (!this.alive) return;
    if (config.missing.includes("FAL_KEY")) {
      this.fail("FAL_KEY is missing from .env.local");
      return;
    }
    if (config.voice === "saskia" && config.missing.includes("ELEVENLABS_API_KEY")) {
      this.fail("ELEVENLABS_API_KEY is missing from .env.local");
      return;
    }
    const switches: SessionSwitches = { voice: config.voice, chain: config.chain, render: config.render };
    // Session ids carry the switches so recordings compare cleanly.
    this.state = {
      ...this.state,
      id: `${this.state.id}-${switches.voice}-chain-${switches.chain}`,
    };
    this.set({ switches });

    let stream: Stream;
    try {
      stream = createRenderer(switches.render, { chain: switches.chain === "on" });
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
    let previousHandoff: string | null = null;
    let translateMs: number | null = null;
    let translateSource: string | null = null;
    let started = false;

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
          const { prompt } = compilePrompt({ beat, voice: switches.voice, previousHandoff });
          previousHandoff = beat.handoff;
          const shot: Shot = {
            n,
            beat,
            prompt,
            duration: SHOT_SECONDS,
            chain: switches.chain === "on",
          };
          registerShot(prompt, {
            session: this.id,
            n,
            question: this.state.answer?.question ?? this.state.question,
            beat,
            sources: beat.source.map((i) => this.state.answer?.sentences[i] ?? ""),
            warnings,
            voice: switches.voice,
            chain: switches.chain,
            translatorVersion: TRANSLATOR_VERSION,
            styleSheetVersion: STYLE_SHEET_VERSION,
          });
          this.narrator?.prefetch(n, beat.delivery);
          this.set({ status: "staging", beats: [...this.state.beats, beat] });
          stream.addShots([shot]);
          if (!started) {
            started = true;
            stream.start();
          }
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
