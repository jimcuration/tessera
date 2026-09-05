// WP3 §5: two Saskia reels that isolate the effect of expression tags.
// Re-narrates one already-rendered saskia/chain-on session's lines twice —
// once as plain `line` text, once as `delivery` (line plus the translator's
// expression tags) — both on the expressive model (eleven_v3, no
// voice_settings override, matching app/api/voice/route.ts), and cuts each
// into a reel against the SAME video clips so only the narration changes.
// Video is the expensive part (fal, ~$0.125/clip); this reuses one render.
// Unlike scripts/saskia-settings.mts (WP2), this writes a JSON log of every
// ElevenLabs request beside the reel (WP2 review flagged that gap).
//
//   npx tsx scripts/saskia-delivery.mts --session recordings/<dir> \
//     --out-prefix recordings/reels/spine-saskia-v0.3
//
// Writes <out-prefix>-plain.mp4, <out-prefix>-tagged.mp4, and
// <out-prefix>-requests.json.

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
const outPrefix = arg("out-prefix", "recordings/reels/spine-saskia-v0.3");
if (!sessionDir || !existsSync(sessionDir)) {
  console.error("usage: npx tsx scripts/saskia-delivery.mts --session recordings/<dir> [--out-prefix path]");
  process.exit(1);
}

const KEY = (process.env.ELEVENLABS_API_KEY ?? "").trim();
if (!KEY) {
  console.error("ELEVENLABS_API_KEY missing from .env.local");
  process.exit(1);
}
const VOICE_ID = "QMSGabqYzk8YAneQYYvR";
const MODEL_ID = "eleven_v3";

interface Variant {
  key: "plain" | "tagged";
  label: string;
  textOf: (beat: Record<string, unknown>) => string;
}
const VARIANTS: Variant[] = [
  { key: "plain", label: "line, no expression tags", textOf: (b) => String(b.line) },
  { key: "tagged", label: "delivery, with the translator's expression tags", textOf: (b) => String(b.delivery ?? b.line) },
];

const clips = readdirSync(sessionDir)
  .filter((f) => /^\d+\.mp4$/.test(f))
  .map((f) => ({ n: parseInt(f), file: path.join(sessionDir, f) }))
  .sort((a, b) => a.n - b.n);
if (clips.length === 0) {
  console.error("no clips in", sessionDir);
  process.exit(1);
}
const beats = new Map<number, Record<string, unknown>>();
for (const clip of clips) {
  const rec = JSON.parse(readFileSync(path.join(sessionDir, `${clip.n}.json`), "utf8"));
  beats.set(clip.n, rec.beat);
}

async function synth(text: string): Promise<Buffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: MODEL_ID }),
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
  const requestLog: unknown[] = [];
  for (const variant of VARIANTS) {
    console.log(`[saskia-delivery] variant ${variant.key}: ${variant.label}`);
    const work = path.join(tmpdir(), `tessera-saskia-delivery-${variant.key}-${Date.now()}`);
    mkdirSync(work, { recursive: true });
    for (const clip of clips) {
      const beat = beats.get(clip.n)!;
      const text = variant.textOf(beat);
      const bytes = await synth(text);
      writeFileSync(path.join(work, `${clip.n}.mp3`), bytes);
      const duration = durationOf(path.join(work, `${clip.n}.mp3`));
      requestLog.push({
        variant: variant.key,
        n: clip.n,
        model: MODEL_ID,
        voiceId: VOICE_ID,
        settings: "account default (no override)",
        text,
        durationSeconds: duration,
        requestedAt: new Date().toISOString(),
      });
      console.log(`  beat ${clip.n}: ${bytes.length} bytes, ${duration ?? "?"}s — "${text}"`);
    }
    const out = `${outPrefix}-${variant.key}.mp4`;
    const total = buildReel(work, out, work);
    console.log(`  -> ${out} (${total.toFixed(1)}s)`);
    rmSync(work, { recursive: true, force: true });
  }
  const logPath = `${outPrefix}-requests.json`;
  mkdirSync(path.dirname(logPath), { recursive: true });
  writeFileSync(logPath, JSON.stringify(requestLog, null, 2));
  console.log(`[saskia-delivery] request log -> ${logPath}`);
}
main().catch((cause) => {
  console.error("[saskia-delivery] failed:", cause instanceof Error ? cause.stack ?? cause.message : cause);
  process.exit(1);
});
