import { readFileSync } from "node:fs";
import path from "node:path";
import { readSwitches, recordingsDir } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The WP5 MUSIC=on bed: a low, sparse, loopable track generated once by
 * scripts/music.mts and saved to <RECORDINGS_DIR>/music/bed.mp3 (with its
 * prompt and licence logged alongside it, rule 7) rather than committed to
 * the repo as a binary asset — the player loops it client-side at low
 * volume when MUSIC=on and Saskia is narrating.
 *
 * WP8.1 §4: MUSIC_BED=bed|bed-v2 (lib/config.ts, default "bed") picks
 * between that original track and scripts/music-bed-v2.mts's 2-3 minute,
 * crossfaded-loop-point bed — <RECORDINGS_DIR>/music/bed-v2.mp3, generated
 * alongside bed.mp3, never overwriting it.
 */
export async function GET() {
  const { musicBed } = readSwitches();
  const file = path.join(recordingsDir(), "music", `${musicBed}.mp3`);
  try {
    const bytes = readFileSync(file);
    return new Response(new Uint8Array(bytes), {
      headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=3600" },
    });
  } catch {
    const generator = musicBed === "bed-v2" ? "scripts/music-bed-v2.mts" : "scripts/music.mts";
    return Response.json({ error: `no ${musicBed}.mp3 generated (run npx tsx ${generator})` }, { status: 404 });
  }
}
