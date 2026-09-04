// WP2 §3: a short settings pass on Saskia. Re-narrates one already-rendered
// saskia/chain-on session's six lines three times, each with different
// ElevenLabs voice_settings (starting from the account's defaults, then
// lower stability / higher style in two steps), and cuts each into a reel
// against the SAME video clips so only the voice changes between them.
// Video is the expensive part (fal, ~$0.125/clip); this reuses one render.
//
//   npx tsx scripts/saskia-settings.mts --session recordings/<dir> \
//     --out-prefix recordings/reels/spine-saskia-v0.2
//
// Writes <out-prefix>-{a,b,c}.mp4.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { durationOf, ffmpeg, hasAudio } from "./ffmpeg.mjs";

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

function arg(name: string, fallback: string | null = null): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const sessionDir = arg("session");
const outPrefix = arg("out-prefix", "recordings/reels/spine-saskia-v0.2");
if (!sessionDir || !existsSync(sessionDir)) {
  console.error("usage: npx tsx scripts/saskia-settings.mts --session recordings/<dir> [--out-prefix path]");
  process.exit(1);
}

const KEY = (process.env.ELEVENLABS_API_KEY ?? "").trim();
if (!KEY) {
  console.error("ELEVENLABS_API_KEY missing from .env.local");
  process.exit(1);
}
const VOICE_ID = "QMSGabqYzk8YAneQYYvR";
const MODEL_ID = "eleven_multilingual_v2";

interface Profile {
  key: string;
  label: string;
  voiceSettings: Record<string, unknown> | null;
}
const PROFILES: Profile[] = [
  { key: "a", label: "account defaults (no override)", voiceSettings: null },
  { key: "b", label: "stability 0.35, style 0.35, similarity 0.8", voiceSettings: { stability: 0.35, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true } },
  { key: "c", label: "stability 0.2, style 0.6, similarity 0.8", voiceSettings: { stability: 0.2, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true } },
];

const clips = readdirSync(sessionDir)
  .filter((f) => /^\d+\.mp4$/.test(f))
  .map((f) => ({ n: parseInt(f), file: path.join(sessionDir, f) }))
  .sort((a, b) => a.n - b.n);
if (clips.length === 0) {
  console.error("no clips in", sessionDir);
  process.exit(1);
}
const lines = new Map<number, string>();
for (const clip of clips) {
  const rec = JSON.parse(readFileSync(path.join(sessionDir, `${clip.n}.json`), "utf8"));
  lines.set(clip.n, rec.beat.line);
}

async function synth(text: string, voiceSettings: Record<string, unknown> | null): Promise<Buffer> {
  const body: Record<string, unknown> = { text, model_id: MODEL_ID };
  if (voiceSettings) body.voice_settings = voiceSettings;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`elevenlabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

function buildReel(work: string, out: string, mp3Dir: string) {
  const list = path.join(work, "list.txt");
  writeFileSync(list, clips.map((c) => `file '${path.resolve(c.file).replace(/'/g, "'\\''")}'`).join("\n"));
  const joined = path.join(work, "joined.mp4");
  ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);

  let clipStart = 0;
  let narrationEnd = 0;
  const tracks: { file: string; startMs: number }[] = [];
  for (const clip of clips) {
    const mp3 = path.join(mp3Dir, `${clip.n}.mp3`);
    const clipLength = durationOf(clip.file) ?? 5;
    if (existsSync(mp3)) {
      const start = Math.max(clipStart, narrationEnd);
      const length = durationOf(mp3) ?? 0;
      tracks.push({ file: mp3, startMs: Math.round(start * 1000) });
      narrationEnd = start + length;
    }
    clipStart += clipLength;
  }
  const total = Math.max(clipStart, narrationEnd);
  const inputs = ["-i", joined, ...tracks.flatMap((t) => ["-i", t.file])];
  const bed = hasAudio(joined) ? "[0:a]volume=0.5[bed];" : `anullsrc=r=44100:cl=stereo,atrim=0:${total}[bed];`;
  const delayed = tracks.map((t, i) => `[${i + 1}:a]adelay=${t.startMs}|${t.startMs}[n${i}]`).join(";");
  const mixInputs = `[bed]${tracks.map((_, i) => `[n${i}]`).join("")}`;
  const filter = `${bed}${delayed};${mixInputs}amix=inputs=${tracks.length + 1}:duration=longest:normalize=0[a]`;
  mkdirSync(path.dirname(out), { recursive: true });
  ffmpeg([
    ...inputs,
    "-filter_complex", filter,
    "-map", "0:v", "-map", "[a]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k",
    "-vf", `tpad=stop_mode=clone:stop_duration=${Math.max(0, total - clipStart).toFixed(2)}`,
    "-t", String(total.toFixed(2)),
    out,
  ]);
  return total;
}

async function main() {
  for (const profile of PROFILES) {
    console.log(`[saskia-settings] profile ${profile.key}: ${profile.label}`);
    const work = path.join(tmpdir(), `tessera-saskia-${profile.key}-${Date.now()}`);
    mkdirSync(work, { recursive: true });
    for (const clip of clips) {
      const text = lines.get(clip.n)!;
      const bytes = await synth(text, profile.voiceSettings);
      writeFileSync(path.join(work, `${clip.n}.mp3`), bytes);
      console.log(`  beat ${clip.n}: ${bytes.length} bytes`);
    }
    const out = `${outPrefix}-${profile.key}.mp4`;
    const total = buildReel(work, out, work);
    console.log(`  -> ${out} (${total.toFixed(1)}s)`);
    rmSync(work, { recursive: true, force: true });
  }
}
main().catch((cause) => {
  console.error("[saskia-settings] failed:", cause instanceof Error ? cause.stack ?? cause.message : cause);
  process.exit(1);
});
