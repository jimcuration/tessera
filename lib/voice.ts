"use client";

/**
 * Saskia: the player narrates each scene's beats (their `delivery` text —
 * the line, with at most one expression tag for the expressive model, WP3
 * §3/§4) with one ElevenLabs request per scene (WP8 §2: a scene, not a
 * line, so Saskia doesn't start every sentence cold), split server-side
 * (app/api/voice) into one track per beat. Alignment is sentence-to-clip:
 * the narration for beat N starts when clip N starts, or when beat N-1's
 * narration finishes if that runs late, so the narration stays continuous.
 * No attempt at tight sync (brief: WP0 §4).
 */

export interface SceneBeat {
  n: number;
  text: string;
}

/** ElevenLabs limits concurrent requests per key; scenes arrive faster than that. */
const MAX_CONCURRENT = 2;
const RETRIES = 2;

function base64ToUrl(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
}

export class Narrator {
  private tracks = new Map<number, Promise<string | null>>();
  private playing: Promise<void> = Promise.resolve();
  private audio: HTMLAudioElement | null = null;
  private controller = new AbortController();
  private alive = true;
  private inFlight = 0;
  private waiting: Array<() => void> = [];

  constructor(private readonly session: string) {}

  private async slot(): Promise<void> {
    if (this.inFlight < MAX_CONCURRENT) {
      this.inFlight += 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.inFlight += 1;
  }

  private release() {
    this.inFlight -= 1;
    this.waiting.shift()?.();
  }

  private async fetchScene(scene: number, beats: SceneBeat[]): Promise<Map<number, string | null>> {
    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      if (!this.alive) return new Map();
      await this.slot();
      try {
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ session: this.session, scene, beats }),
          signal: this.controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { beats: { n: number; audioBase64: string }[] };
          const urls = new Map<number, string | null>();
          for (const b of data.beats) urls.set(b.n, base64ToUrl(b.audioBase64));
          return urls;
        }
        console.warn(`[voice] scene ${scene}: voice ${res.status}${attempt < RETRIES ? ", retrying" : ""}`);
      } catch (cause) {
        if (this.controller.signal.aborted) return new Map();
        console.warn(`[voice] scene ${scene}:`, cause instanceof Error ? cause.message : cause);
      } finally {
        this.release();
      }
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
    return new Map();
  }

  /** Fetch one scene's narration (2-3 beats) in a single request, split per beat by the server. */
  prefetchScene(scene: number, beats: SceneBeat[]) {
    const missing = beats.filter((b) => !this.tracks.has(b.n));
    if (missing.length === 0) return;
    const promise = this.fetchScene(scene, missing);
    for (const b of missing) {
      this.tracks.set(
        b.n,
        promise.then((urls) => urls.get(b.n) ?? null)
      );
    }
  }

  /** Play beat n's line, after the previous line if it is still running. */
  play(n: number) {
    const track = this.tracks.get(n);
    if (!track) return;
    this.playing = this.playing.then(async () => {
      if (!this.alive) return;
      const url = await track;
      if (!url || !this.alive) return;
      const audio = new Audio(url);
      this.audio = audio;
      await new Promise<void>((resolve) => {
        audio.addEventListener("ended", () => resolve(), { once: true });
        audio.addEventListener("error", () => resolve(), { once: true });
        audio.play().catch(() => resolve());
      });
      if (this.audio === audio) this.audio = null;
    });
  }

  /** Interrupt: stop the voice at once and fetch nothing more. */
  stop() {
    this.alive = false;
    this.controller.abort();
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    for (const track of this.tracks.values()) {
      void track.then((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    }
    this.tracks.clear();
  }
}
