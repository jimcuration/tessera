import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type NextRequest } from "next/server";
import { recordingsDir } from "@/lib/config";
import { durationOf } from "../../../scripts/ffmpeg.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Saskia: one ElevenLabs narration per beat's `delivery` text (the beat's
 * line, with at most one expression tag from lib/translator.ts's
 * DELIVERY_TAGS whitelist). The key never leaves the server. POST
 * {text, session?, n?} → audio/mpeg. When session and n are given the
 * track is saved to <RECORDINGS_DIR>/<session>/<n>.mp3, and every request
 * is also logged to <RECORDINGS_DIR>/<session>/voice-<n>.json beside it
 * (CLAUDE.md rule 7, "save everything" — the WP2 settings pass broke this
 * for the settings-comparison reels; this route itself always logged the
 * mp3, but never the request that produced it). RECORDINGS_DIR
 * (lib/config.ts) defaults to a folder shared by every checkout and
 * worktree (CLAUDE.md rule 8).
 */

/** The Curation presenter voice (brief: WP0 §4). */
const VOICE_ID = "QMSGabqYzk8YAneQYYvR";
/** eleven_v3: the current expressive model, the one that honours square-bracket audio tags (WP3 §4). */
const MODEL_ID = "eleven_v3";
const SAFE_SESSION = /^[A-Za-z0-9._-]{1,120}$/;

export async function POST(req: NextRequest) {
  const key = (process.env.ELEVENLABS_API_KEY ?? "").trim();
  if (!key) return Response.json({ error: "ELEVENLABS_API_KEY missing" }, { status: 500 });

  let text = "";
  let session: string | null = null;
  let n: number | null = null;
  try {
    const body = (await req.json()) as { text?: unknown; session?: unknown; n?: unknown };
    text = typeof body.text === "string" ? body.text.trim() : "";
    session = typeof body.session === "string" && SAFE_SESSION.test(body.session) ? body.session : null;
    n = typeof body.n === "number" && Number.isInteger(body.n) && body.n > 0 ? body.n : null;
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  if (!text) return Response.json({ error: "no text" }, { status: 400 });

  // Account default: the WP2 settings pass showed three tuned profiles were
  // audibly indistinguishable (WP2 report §4), so this sends no override —
  // the same profile ("a") that pass tested, not an untested hand-picked one.
  const requested = { model: MODEL_ID, voiceId: VOICE_ID, settings: "account default (no override)", text };

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({ text, model_id: MODEL_ID }),
      signal: req.signal,
      cache: "no-store",
    }
  );
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error("[voice] elevenlabs", upstream.status, detail.slice(0, 200));
    return Response.json({ error: `elevenlabs ${upstream.status}` }, { status: 502 });
  }
  const bytes = new Uint8Array(await upstream.arrayBuffer());

  if (session && n !== null) {
    try {
      const dir = path.join(recordingsDir(), session);
      mkdirSync(dir, { recursive: true });
      const mp3Path = path.join(dir, `${n}.mp3`);
      writeFileSync(mp3Path, bytes);
      let duration: number | null = null;
      try {
        duration = durationOf(mp3Path);
      } catch (cause) {
        console.warn("[voice] could not measure duration:", cause instanceof Error ? cause.message : cause);
      }
      writeFileSync(
        path.join(dir, `voice-${n}.json`),
        JSON.stringify({ ...requested, durationSeconds: duration, requestedAt: new Date().toISOString() }, null, 2)
      );
    } catch (cause) {
      console.warn("[voice] could not save narration:", cause instanceof Error ? cause.message : cause);
    }
  }

  return new Response(bytes, {
    headers: { "content-type": "audio/mpeg", "cache-control": "no-store" },
  });
}
