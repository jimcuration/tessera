// WP8.1 §4: a longer music bed than WP5's 30s bed.mp3 — 2-3 minutes, same
// register (plucked bass, dry drum hits, short marimba phrases, sparse,
// beneath a voice), with its loop point crossfaded so the player's native
// <audio loop> jump from end to start doesn't click. Saved to
// <RECORDINGS_DIR>/music/bed-v2.mp3 (never touches bed.mp3), with the
// prompt and licence logged in bed-v2.json (CLAUDE.md rule 7). Served by
// app/api/music when MUSIC_BED=bed-v2 (lib/config.ts; default "bed").
//
//   npx tsx scripts/music-bed-v2.mts

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { durationOf, ffmpeg } from "./ffmpeg.mjs";

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const key = (process.env.ELEVENLABS_API_KEY ?? "").trim();
if (!key) {
  console.error("ELEVENLABS_API_KEY missing from .env.local");
  process.exit(1);
}

/** Same register as WP5's bed.mp3 (scripts/music.mts), brief WP8.1 §4: "plucked bass, dry drum hits, short marimba phrases". */
const PROMPT =
  "Sparse instrumental underscore for a paper-collage documentary explainer: soft plucked upright bass, occasional dry drum hits (no full kit, no cymbals), and short marimba phrases, warm and understated, gentle even tempo around 92 BPM, no vocals, no melody hooks, wide open space between notes, seamlessly loopable, low mixed level throughout so it can sit under narration.";
/** Brief: "2-3 minutes". ElevenLabs' /v1/music caps a single request below 5 minutes; 2.5 min is comfortably inside that. */
const DURATION_MS = 150_000;
/** Length of the crossfaded wrap segment at the loop point. */
const CROSSFADE_SECONDS = 3;

async function generate(): Promise<{ bytes: Uint8Array; endpoint: string; requestedDurationMs: number }> {
  console.log(`[music-bed-v2] requesting ${DURATION_MS / 1000}s from ElevenLabs music API...`);
  let upstream = await fetch("https://api.elevenlabs.io/v1/music", {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ prompt: PROMPT, music_length_ms: DURATION_MS }),
  });

  let endpoint = "https://api.elevenlabs.io/v1/music";
  let requestedDurationMs = DURATION_MS;
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.warn(`[music-bed-v2] /v1/music -> ${upstream.status}: ${detail.slice(0, 300)}`);
    console.log("[music-bed-v2] falling back to /v1/sound-generation (shorter, capped ~22s)...");
    endpoint = "https://api.elevenlabs.io/v1/sound-generation";
    requestedDurationMs = 22_000;
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text: PROMPT, duration_seconds: 22, prompt_influence: 0.3 }),
    });
  }
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(`elevenlabs failed: ${upstream.status} ${detail.slice(0, 500)}`);
  }
  return { bytes: new Uint8Array(await upstream.arrayBuffer()), endpoint, requestedDurationMs };
}

/**
 * Crossfade the track's own tail into its own head so a native <audio loop>
 * jump from end to start reads as continuous, not a cut: the fade blend
 * becomes the new tail, and the file otherwise plays the original content
 * from just after the head through just before the original tail.
 */
function crossfadeLoopPoint(rawPath: string, outPath: string, crossfadeSeconds: number) {
  const total = durationOf(rawPath);
  if (!total || total <= crossfadeSeconds * 2 + 1) {
    console.warn("[music-bed-v2] track too short to crossfade a loop point; using it as-is");
    ffmpeg(["-i", rawPath, "-acodec", "libmp3lame", "-q:a", "2", outPath]);
    return;
  }
  const headEnd = crossfadeSeconds;
  const tailStart = total - crossfadeSeconds;
  const filter = [
    `[0:a]atrim=0:${headEnd},asetpts=PTS-STARTPTS[head]`,
    `[0:a]atrim=${tailStart}:${total},asetpts=PTS-STARTPTS[tail]`,
    `[tail][head]acrossfade=d=${crossfadeSeconds}:c1=tri:c2=tri[boundary]`,
    `[0:a]atrim=${headEnd}:${tailStart},asetpts=PTS-STARTPTS[middle]`,
    `[middle][boundary]concat=n=2:v=0:a=1[out]`,
  ].join(";");
  ffmpeg(["-i", rawPath, "-filter_complex", filter, "-map", "[out]", "-acodec", "libmp3lame", "-q:a", "2", outPath]);
}

async function main() {
  const { bytes, endpoint, requestedDurationMs } = await generate();

  const work = mkdtempSync(path.join(tmpdir(), "tessera-music-bed-v2-"));
  try {
    const rawPath = path.join(work, "raw.mp3");
    writeFileSync(rawPath, bytes);
    const rawDuration = durationOf(rawPath);

    const recordingsDir = path.resolve(process.cwd(), (process.env.RECORDINGS_DIR ?? "").trim() || "../tessera-recordings");
    const dir = path.join(recordingsDir, "music");
    mkdirSync(dir, { recursive: true });
    const outPath = path.join(dir, "bed-v2.mp3");
    crossfadeLoopPoint(rawPath, outPath, CROSSFADE_SECONDS);
    const finalDuration = durationOf(outPath);
    const finalBytes = readFileSync(outPath).length;

    writeFileSync(
      path.join(dir, "bed-v2.json"),
      JSON.stringify(
        {
          prompt: PROMPT,
          endpoint,
          requestedDurationMs,
          rawDurationSeconds: rawDuration,
          finalDurationSeconds: finalDuration,
          crossfadeSeconds: CROSSFADE_SECONDS,
          bytes: finalBytes,
          licence:
            "Generated via the project's own ElevenLabs account (ELEVENLABS_API_KEY) under ElevenLabs' standard API terms of service; usage rights follow the Curation/CurationAI ElevenLabs subscription plan in effect at generation time, same as the Saskia narration tracks and WP5's bed.mp3. Not a third-party sample or stock track.",
          generatedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
    console.log(`[music-bed-v2] saved ${finalBytes} bytes (${finalDuration?.toFixed(1)}s, ${CROSSFADE_SECONDS}s crossfaded loop point) to ${outPath}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((cause) => {
  console.error("[music-bed-v2] failed:", cause instanceof Error ? cause.stack ?? cause.message : cause);
  process.exit(1);
});
