import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { type NextRequest } from "next/server";
import { recordingsDir } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * WP9: serves one cached clip or narration track for playback, from
 * RECORDINGS_DIR/<session>/<file> only. Same safe-session pattern as
 * app/api/record/route.ts; file is restricted to "<digits>.mp4" or
 * "<digits>.mp3" (a shot's own clip, or one beat's split narration) — never
 * session.json, a face-gate log, or anything else in the directory. The
 * resolved path is also checked to stay inside recordingsDir() as defence
 * in depth beyond the regexes. Range requests are supported (for scrubbing)
 * by slicing the file in memory rather than a true streamed read — these
 * clips are a few MB at most, so this is simple and reliable; see
 * briefs/WP9-handoff.md for why a full node:stream pipe wasn't used
 * instead. Long-lived cache-control: these files never change once
 * recorded.
 */

const SAFE_SESSION = /^[A-Za-z0-9._-]{1,120}$/;
const SAFE_FILE = /^\d+\.(mp4|mp3)$/;

function contentType(file: string): string {
  return file.endsWith(".mp3") ? "audio/mpeg" : "video/mp4";
}

export async function GET(req: NextRequest) {
  const session = req.nextUrl.searchParams.get("session") ?? "";
  const file = req.nextUrl.searchParams.get("file") ?? "";
  if (!SAFE_SESSION.test(session) || !SAFE_FILE.test(file)) {
    return new Response("bad request", { status: 400 });
  }

  const base = path.resolve(recordingsDir());
  const full = path.resolve(base, session, file);
  if (full !== path.join(base, session, file) || !full.startsWith(base + path.sep)) {
    return new Response("bad path", { status: 400 });
  }
  if (!existsSync(full)) return new Response("not found", { status: 404 });

  let buffer: Buffer;
  try {
    buffer = readFileSync(full);
  } catch {
    return new Response("not found", { status: 404 });
  }

  const headers = new Headers({
    "content-type": contentType(file),
    "cache-control": "public, max-age=31536000, immutable",
    "accept-ranges": "bytes",
  });

  const range = req.headers.get("range");
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m && (m[1] || m[2])) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? Math.min(parseInt(m[2], 10), buffer.length - 1) : buffer.length - 1;
      if (start >= 0 && start <= end && end < buffer.length) {
        const chunk = buffer.subarray(start, end + 1);
        headers.set("content-range", `bytes ${start}-${end}/${buffer.length}`);
        headers.set("content-length", String(chunk.length));
        return new Response(new Uint8Array(chunk), { status: 206, headers });
      }
    }
  }

  headers.set("content-length", String(buffer.length));
  return new Response(new Uint8Array(buffer), { status: 200, headers });
}
