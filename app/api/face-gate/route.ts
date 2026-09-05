import { type NextRequest } from "next/server";
import { checkRemoteClipForFaces } from "@/lib/faceGate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * WP5.1 face gate. POST {rawUrl} → {detected, attempts, latencyMs}. Called
 * by lib/stream.ts after a clip renders and before it reaches the playback
 * queue. Downloads its own copy of the fal clip (independent of
 * app/api/record's own save, which this route does not touch) so it can
 * seek frames with ffmpeg; the temp copy is removed before returning.
 */

function isFalUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && (url.hostname === "fal.media" || url.hostname.endsWith(".fal.media"));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let rawUrl = "";
  try {
    const body = (await req.json()) as { rawUrl?: unknown };
    rawUrl = typeof body.rawUrl === "string" ? body.rawUrl : "";
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  if (!rawUrl || !isFalUrl(rawUrl)) return Response.json({ error: "bad rawUrl" }, { status: 400 });

  try {
    const result = await checkRemoteClipForFaces(rawUrl);
    return Response.json(result);
  } catch (cause) {
    console.error("[face-gate]", cause instanceof Error ? cause.message : cause);
    return Response.json({ error: "gate failed" }, { status: 500 });
  }
}
