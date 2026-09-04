import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Saskia: one ElevenLabs narration per beat line. The key never leaves the
 * server. POST {text, session?, n?} → audio/mpeg. When session and n are
 * given the track is also saved to recordings/<session>/<n>.mp3.
 */

/** The Curation presenter voice (brief: WP0 §4). */
const VOICE_ID = "QMSGabqYzk8YAneQYYvR";
const MODEL_ID = "eleven_multilingual_v2";
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

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true },
      }),
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
      const dir = path.join(process.cwd(), "recordings", session);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, `${n}.mp3`), bytes);
    } catch (cause) {
      console.warn("[voice] could not save narration:", cause instanceof Error ? cause.message : cause);
    }
  }

  return new Response(bytes, {
    headers: { "content-type": "audio/mpeg", "cache-control": "no-store" },
  });
}
