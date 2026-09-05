"use client";

/**
 * Saskia: the player narrates each beat's `delivery` text (its line, with
 * at most one expression tag for the expressive model, WP3 §3/§4) with an
 * ElevenLabs track while the clips run wordless. Alignment is
 * sentence-to-clip: the narration for beat N starts when clip N starts, or
 * when beat N-1's narration finishes if that runs late, so the narration
 * stays continuous. No attempt at tight sync (brief: WP0 §4).
 */

/** ElevenLabs limits concurrent requests per key; beats arrive faster than that. */
const MAX_CONCURRENT = 2;
const RETRIES = 2;

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

  private async fetchTrack(n: number, text: string): Promise<string | null> {
    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      if (!this.alive) return null;
      await this.slot();
      try {
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, session: this.session, n }),
          signal: this.controller.signal,
        });
        if (res.ok) return URL.createObjectURL(await res.blob());
        console.warn(`[voice] beat ${n}: voice ${res.status}${attempt < RETRIES ? ", retrying" : ""}`);
      } catch (cause) {
        if (this.controller.signal.aborted) return null;
        console.warn(`[voice] beat ${n}:`, cause instanceof Error ? cause.message : cause);
      } finally {
        this.release();
      }
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
    return null;
  }

  /** Fetch the narration for beat n as soon as the beat is known. */
  prefetch(n: number, text: string) {
    if (this.tracks.has(n)) return;
    this.tracks.set(n, this.fetchTrack(n, text));
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
