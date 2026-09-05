import path from "node:path";

/**
 * The runtime switches, read from the environment on every request so a
 * change to .env.local takes effect on the next question, no code change.
 *
 *   VOICE=native|saskia    native: the video model speaks the line (audio
 *                          block A); saskia: wordless clips (audio block B)
 *                          with an ElevenLabs narration layered in the player.
 *   CHAIN=on|off           on: image-to-video from the previous clip's last
 *                          frame; off: text-to-video every clip.
 *   RENDER=queue|director  queue: the unreel shot queue (built in WP0);
 *                          director: not implemented in WP0.
 *   THEATRE=on|off         on: the player renders inside the console frame
 *                          (WP4); off: plain full-width 16:9 player. Always
 *                          off below 900px viewport width regardless.
 *   MUSIC=on|off           WP5: on layers a low, looping music bed under
 *                          Saskia's narration in the player, ducked well
 *                          under the voice; off (default) is silent — the
 *                          clip's own audio block stays wordless either way.
 *
 * Server-only. The client fetches the resolved values from /api/config.
 */

export type VoiceSwitch = "native" | "saskia";
export type ChainSwitch = "on" | "off";
export type RenderSwitch = "queue" | "director";
export type TheatreSwitch = "on" | "off";
export type MusicSwitch = "on" | "off";

export interface Switches {
  voice: VoiceSwitch;
  chain: ChainSwitch;
  render: RenderSwitch;
  theatre: TheatreSwitch;
  music: MusicSwitch;
  /** Whether translations are served from data/translations when present. */
  translateCache: boolean;
}

function pick<T extends string>(raw: string | undefined, allowed: T[], fallback: T): T {
  const value = (raw ?? "").trim().toLowerCase();
  return (allowed as string[]).includes(value) ? (value as T) : fallback;
}

export function readSwitches(): Switches {
  return {
    // Saskia is the default voice (WP2, D20): native was silent 1 clip in
    // 6 and its voice drifted across clips; Saskia is one voice id, always.
    voice: pick<VoiceSwitch>(process.env.VOICE, ["native", "saskia"], "saskia"),
    chain: pick<ChainSwitch>(process.env.CHAIN, ["on", "off"], "on"),
    render: pick<RenderSwitch>(process.env.RENDER, ["queue", "director"], "queue"),
    theatre: pick<TheatreSwitch>(process.env.THEATRE, ["on", "off"], "on"),
    music: pick<MusicSwitch>(process.env.MUSIC, ["on", "off"], "off"),
    translateCache: pick(process.env.TRANSLATE_CACHE, ["on", "off"], "on") === "on",
  };
}

/** Which secrets are present, never their values. */
export function missingSecrets(): string[] {
  const wanted = ["FAL_KEY", "ELEVENLABS_API_KEY", "ANTHROPIC_API_KEY"];
  return wanted.filter((name) => !(process.env[name] ?? "").trim());
}

/**
 * Where every clip, prompt and expanded_prompt is saved (CLAUDE.md rule 7).
 * Defaults to a folder shared by every checkout and worktree — one
 * checkout per session (rule 8) otherwise means each session's recordings
 * land in its own, disconnected `recordings/` and never see the others'.
 * RECORDINGS_DIR may be absolute or relative; relative is resolved against
 * this process's cwd (the checkout root), so the default `../tessera-recordings`
 * lands in the same sibling folder from the main checkout and from every
 * `../tessera-<wp>` worktree alongside it.
 */
export function recordingsDir(): string {
  const raw = (process.env.RECORDINGS_DIR ?? "").trim() || "../tessera-recordings";
  return path.resolve(process.cwd(), raw);
}
