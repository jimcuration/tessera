import { readFileSync } from "node:fs";
import path from "node:path";
import { recordingsDir } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The WP5 MUSIC=on bed: a low, sparse, loopable track generated once by
 * scripts/music.mts and saved to <RECORDINGS_DIR>/music/bed.mp3 (with its
 * prompt and licence logged alongside it, rule 7) rather than committed to
 * the repo as a binary asset — the player loops it client-side at low
 * volume when MUSIC=on and Saskia is narrating.
 */
export async function GET() {
  const file = path.join(recordingsDir(), "music", "bed.mp3");
  try {
    const bytes = readFileSync(file);
    return new Response(new Uint8Array(bytes), {
      headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=3600" },
    });
  } catch {
    return Response.json({ error: "no music bed generated (run scripts/music.mts)" }, { status: 404 });
  }
}
