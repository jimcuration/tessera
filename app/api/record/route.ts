import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Save everything (CLAUDE.md hard rule 7). Every clip, its beat, its prompt
 * and fal's expanded_prompt go to recordings/<session>/<n>.{mp4,json}; the
 * session's manifest (question, sentences, beats kept and dropped, switches,
 * timings) goes to recordings/<session>/session.json.
 *
 *   POST {kind:"clip", session, n, rawUrl, ...meta}   writes n.json and n.mp4
 *   POST {kind:"session", session, ...manifest}       writes session.json
 */

const SAFE_SESSION = /^[A-Za-z0-9._-]{1,120}$/;

function isFalUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && (url.hostname === "fal.media" || url.hostname.endsWith(".fal.media"));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const session = typeof body.session === "string" && SAFE_SESSION.test(body.session) ? body.session : null;
  if (!session) return Response.json({ error: "bad session" }, { status: 400 });
  const dir = path.join(process.cwd(), "recordings", session);
  mkdirSync(dir, { recursive: true });

  if (body.kind === "session") {
    const { kind: _kind, ...manifest } = body;
    void _kind;
    writeFileSync(path.join(dir, "session.json"), JSON.stringify({ ...manifest, savedAt: new Date().toISOString() }, null, 2));
    return Response.json({ ok: true, file: `recordings/${session}/session.json` });
  }

  if (body.kind === "clip") {
    const n = typeof body.n === "number" && Number.isInteger(body.n) && body.n > 0 ? body.n : null;
    if (n === null) return Response.json({ error: "bad n" }, { status: 400 });
    const { kind: _kind, ...meta } = body;
    void _kind;
    writeFileSync(path.join(dir, `${n}.json`), JSON.stringify({ ...meta, savedAt: new Date().toISOString() }, null, 2));
    const rawUrl = typeof body.rawUrl === "string" ? body.rawUrl : "";
    let saved = false;
    if (rawUrl && isFalUrl(rawUrl)) {
      try {
        const upstream = await fetch(rawUrl, { cache: "no-store" });
        if (upstream.ok) {
          writeFileSync(path.join(dir, `${n}.mp4`), new Uint8Array(await upstream.arrayBuffer()));
          saved = true;
        } else {
          console.warn(`[record] clip ${n}: upstream ${upstream.status}`);
        }
      } catch (cause) {
        console.warn(`[record] clip ${n}:`, cause instanceof Error ? cause.message : cause);
      }
    }
    return Response.json({ ok: true, mp4: saved, file: `recordings/${session}/${n}.json` });
  }

  return Response.json({ error: "unknown kind" }, { status: 400 });
}
