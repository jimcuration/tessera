import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { type NextRequest } from "next/server";
import { recordingsDir } from "@/lib/config";
import { durationOf, ffmpeg, silenceGapMidpoints } from "../../../scripts/ffmpeg.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Saskia: one ElevenLabs narration per SCENE (2-3 beats' `delivery` text —
 * each beat's line, with at most one expression tag from
 * lib/translator.ts's DELIVERY_TAGS whitelist), split into one track per
 * beat (WP8 §2: a scene, not a line, so Saskia doesn't start every sentence
 * cold). The key never leaves the server.
 *
 *   POST {session, scene, beats: [{n, text}, ...]}
 *   → {ok, splitMethod: "timestamps"|"silence-gap", beats: [{n, audioBase64, durationSeconds}]}
 *
 * Split points come from ElevenLabs' character-level alignment
 * (`with-timestamps`) when available: the cut after beat i is the end time
 * of that beat's last character in the concatenated scene text. If the
 * model doesn't return usable alignment (or the with-timestamps request
 * fails), this falls back to ffmpeg silence-gap detection, picking the
 * silence closest to each beat boundary's expected (proportional) time.
 * Either way every beat's split mp3 is saved to
 * <RECORDINGS_DIR>/<session>/<n>.mp3 (unchanged path, so scripts/reel.mjs
 * and the WP2 report tooling need no change), the whole scene's audio to
 * <session>/scene-<scene>.mp3, and the request (model, settings, full
 * scene text, per-beat text, split method, cut times, alignment when
 * present) to <session>/voice-scene-<scene>.json (CLAUDE.md rule 7).
 * RECORDINGS_DIR (lib/config.ts) defaults to a folder shared by every
 * checkout and worktree (CLAUDE.md rule 8).
 */

/** The Curation presenter voice (brief: WP0 §4). */
const VOICE_ID = "QMSGabqYzk8YAneQYYvR";
/** eleven_v3: the current expressive model, the one that honours square-bracket audio tags (WP3 §4). */
const MODEL_ID = "eleven_v3";
const SAFE_SESSION = /^[A-Za-z0-9._-]{1,120}$/;
/** Beats are joined with a single space; each beat's own text already ends in sentence punctuation. */
const SEPARATOR = " ";

interface InBeat {
  n: number;
  text: string;
}

interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

function parseBody(body: unknown): { session: string | null; scene: number | null; beats: InBeat[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const session = typeof b.session === "string" && SAFE_SESSION.test(b.session) ? b.session : null;
  const scene = typeof b.scene === "number" && Number.isInteger(b.scene) ? b.scene : null;
  const rawBeats = Array.isArray(b.beats) ? b.beats : [];
  const beats: InBeat[] = rawBeats
    .map((raw) => {
      const r = raw as Record<string, unknown>;
      const n = typeof r?.n === "number" ? r.n : Number.parseInt(String(r?.n), 10);
      const text = typeof r?.text === "string" ? r.text.trim() : "";
      return { n, text };
    })
    .filter((b) => Number.isInteger(b.n) && b.n > 0 && b.text.length > 0);
  return { session, scene, beats };
}

/** Cut points (seconds) after each beat but the last, from character-level alignment. null on any failure. */
function cutsFromAlignment(alignment: Alignment, beats: InBeat[]): number[] | null {
  const chars = alignment.characters;
  const ends = alignment.character_end_times_seconds;
  if (!Array.isArray(chars) || !Array.isArray(ends) || chars.length === 0 || ends.length !== chars.length) {
    return null;
  }
  // Cumulative character length of the concatenated scene text, up to and including beat i.
  const cumulative: number[] = [];
  let running = 0;
  for (let i = 0; i < beats.length; i += 1) {
    if (i > 0) running += SEPARATOR.length;
    running += beats[i].text.length;
    cumulative.push(running);
  }
  const cuts: number[] = [];
  for (let i = 0; i < beats.length - 1; i += 1) {
    const charIndex = Math.min(cumulative[i], chars.length) - 1;
    if (charIndex < 0 || charIndex >= ends.length || !Number.isFinite(ends[charIndex])) return null;
    cuts.push(ends[charIndex]);
  }
  // Cuts must be strictly increasing and inside the clip; anything else means
  // the alignment didn't line up with our own concatenation (e.g. the model
  // silently dropped or rewrote characters), so the caller should fall back.
  for (let i = 1; i < cuts.length; i += 1) {
    if (!(cuts[i] > cuts[i - 1])) return null;
  }
  return cuts;
}

/** Fallback: nearest silence-gap midpoint to each boundary's expected (proportional, by text length) time. */
function cutsFromSilence(mp3Path: string, beats: InBeat[], totalDuration: number): number[] {
  const mids = silenceGapMidpoints(mp3Path);
  const totalChars = beats.reduce((sum, b, i) => sum + b.text.length + (i > 0 ? SEPARATOR.length : 0), 0);
  let running = 0;
  const cuts: number[] = [];
  for (let i = 0; i < beats.length - 1; i += 1) {
    if (i > 0) running += SEPARATOR.length;
    running += beats[i].text.length;
    const expected = (running / totalChars) * totalDuration;
    const nearest = mids.length
      ? mids.reduce((best, m) => (Math.abs(m - expected) < Math.abs(best - expected) ? m : best), mids[0])
      : expected;
    // Never let a fallback cut run backwards past the previous one.
    cuts.push(Math.max(nearest, (cuts[i - 1] ?? 0) + 0.1));
  }
  return cuts;
}

export async function POST(req: NextRequest) {
  const key = (process.env.ELEVENLABS_API_KEY ?? "").trim();
  if (!key) return Response.json({ error: "ELEVENLABS_API_KEY missing" }, { status: 500 });

  let session: string | null;
  let scene: number | null;
  let beats: InBeat[];
  try {
    ({ session, scene, beats } = parseBody(await req.json()));
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  if (beats.length === 0) return Response.json({ error: "no beats" }, { status: 400 });
  beats.sort((a, b) => a.n - b.n);

  const sceneText = beats.map((b) => b.text).join(SEPARATOR);
  // Account default: the WP2 settings pass showed three tuned profiles were
  // audibly indistinguishable (WP2 report §4), so this sends no override —
  // the same profile ("a") that pass tested, not an untested hand-picked one.
  const settings = "account default (no override)";

  let audioBytes: Uint8Array;
  let splitMethod: "timestamps" | "silence-gap";
  let alignment: Alignment | null = null;
  let alignmentNote: string | null = null;

  const withTimestamps = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ text: sceneText, model_id: MODEL_ID }),
      signal: req.signal,
      cache: "no-store",
    }
  );

  if (withTimestamps.ok) {
    const data = (await withTimestamps.json()) as { audio_base64?: string; alignment?: Alignment };
    if (!data.audio_base64) {
      return Response.json({ error: "elevenlabs with-timestamps: no audio in response" }, { status: 502 });
    }
    audioBytes = Uint8Array.from(Buffer.from(data.audio_base64, "base64"));
    alignment = data.alignment ?? null;
    splitMethod = alignment ? "timestamps" : "silence-gap";
    if (!alignment) alignmentNote = "with-timestamps returned no alignment";
  } else {
    const detail = await withTimestamps.text().catch(() => "");
    console.warn(`[voice] elevenlabs with-timestamps ${withTimestamps.status}, falling back to plain + silence-gap split:`, detail.slice(0, 200));
    alignmentNote = `with-timestamps failed: ${withTimestamps.status}`;
    const plain = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text: sceneText, model_id: MODEL_ID }),
      signal: req.signal,
      cache: "no-store",
    });
    if (!plain.ok) {
      const detail2 = await plain.text().catch(() => "");
      console.error("[voice] elevenlabs", plain.status, detail2.slice(0, 200));
      return Response.json({ error: `elevenlabs ${plain.status}` }, { status: 502 });
    }
    audioBytes = new Uint8Array(await plain.arrayBuffer());
    splitMethod = "silence-gap";
  }

  const work = mkdtempSync(path.join(tmpdir(), "tessera-voice-"));
  let outBeats: { n: number; audioBase64: string; durationSeconds: number | null }[] = [];
  let cutTimes: number[] = [];
  try {
    const sceneMp3 = path.join(work, "scene.mp3");
    writeFileSync(sceneMp3, audioBytes);
    const totalDuration = durationOf(sceneMp3) ?? 0;

    if (beats.length === 1) {
      cutTimes = [];
    } else if (splitMethod === "timestamps" && alignment) {
      const fromAlignment = cutsFromAlignment(alignment, beats);
      if (fromAlignment) {
        cutTimes = fromAlignment;
      } else {
        splitMethod = "silence-gap";
        alignmentNote = "alignment present but did not line up with the beat texts; fell back";
      }
    }
    if (splitMethod === "silence-gap" && beats.length > 1) {
      cutTimes = cutsFromSilence(sceneMp3, beats, totalDuration);
    }

    let start = 0;
    for (let i = 0; i < beats.length; i += 1) {
      const end = i < cutTimes.length ? cutTimes[i] : totalDuration;
      const segPath = path.join(work, `${beats[i].n}.mp3`);
      if (beats.length === 1) {
        writeFileSync(segPath, audioBytes);
      } else {
        ffmpeg(["-i", sceneMp3, "-ss", start.toFixed(3), "-to", Math.max(end, start + 0.05).toFixed(3), "-acodec", "libmp3lame", "-q:a", "2", segPath]);
      }
      const bytes = readFileSync(segPath);
      outBeats.push({ n: beats[i].n, audioBase64: bytes.toString("base64"), durationSeconds: durationOf(segPath) });
      start = end;
    }

    if (session) {
      try {
        const dir = path.join(recordingsDir(), session);
        mkdirSync(dir, { recursive: true });
        const sceneLabel = scene ?? "x";
        writeFileSync(path.join(dir, `scene-${sceneLabel}.mp3`), audioBytes);
        for (const ob of outBeats) {
          writeFileSync(path.join(dir, `${ob.n}.mp3`), Buffer.from(ob.audioBase64, "base64"));
        }
        writeFileSync(
          path.join(dir, `voice-scene-${sceneLabel}.json`),
          JSON.stringify(
            {
              model: MODEL_ID,
              voiceId: VOICE_ID,
              settings,
              scene,
              beats: beats.map((b) => ({ n: b.n, text: b.text })),
              sceneText,
              durationSeconds: totalDuration,
              splitMethod,
              splitNote: alignmentNote,
              cutTimes,
              alignment,
              requestedAt: new Date().toISOString(),
            },
            null,
            2
          )
        );
      } catch (cause) {
        console.warn("[voice] could not save narration:", cause instanceof Error ? cause.message : cause);
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  return Response.json({ ok: true, splitMethod, beats: outBeats });
}
