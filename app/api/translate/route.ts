import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type NextRequest } from "next/server";
import { readSwitches } from "@/lib/config";
import { getAnswer } from "@/lib/curation";
import {
  deflectionBeat,
  drainNdjson,
  TRANSLATOR_SYSTEM,
  TRANSLATOR_VERSION,
  translatorUserPrompt,
  validateBeat,
  type Beat,
} from "@/lib/translator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The translator endpoint. POST {question} and read NDJSON back:
 *
 *   {"type":"answer", ...}          the matched record: followups, sentences
 *   {"type":"beat", "n":1, ...}     one staged beat (validated, source-bearing)
 *   {"type":"dropped", ...}         a beat the translator rule rejected
 *   {"type":"done", ...}            totals and timing
 *
 * Beats stream as Claude writes them so the first clip renders while the
 * rest are still being written. Translations are cached in
 * data/translations/<sha1 of answer>.json so the same answer stages the
 * same beats across voice/chain runs; TRANSLATE_CACHE=off bypasses it.
 */

const MODEL = "claude-opus-5";
const CACHE_DIR = path.join(process.cwd(), "data", "translations");

interface CachedTranslation {
  translator: string;
  pinned?: boolean;
  question: string;
  beats: Beat[];
  dropped?: unknown[];
  warnings?: string[][];
  model?: string;
  ms?: number;
}

function cacheKey(answer: string): string {
  return createHash("sha1").update(answer).digest("hex");
}

function readCache(key: string): CachedTranslation | null {
  const file = path.join(CACHE_DIR, `${key}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as CachedTranslation;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: CachedTranslation) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(path.join(CACHE_DIR, `${key}.json`), JSON.stringify(value, null, 2));
}

export async function POST(req: NextRequest) {
  let question = "";
  try {
    const body = (await req.json()) as { question?: unknown };
    question = typeof body.question === "string" ? body.question.trim() : "";
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  if (!question) return Response.json({ error: "no question" }, { status: 400 });

  const answer = await getAnswer(question);
  if (!answer) {
    return Response.json({ error: "no captured answer" }, { status: 404 });
  }

  const switches = readSwitches();
  const encoder = new TextEncoder();
  const started = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      send({
        type: "answer",
        question: answer.question,
        kind: answer.kind,
        link: answer.link,
        card: answer.card,
        followups: answer.followups,
        fromSpine: answer.fromSpine,
        sentences: answer.sentences,
        switches: { voice: switches.voice, chain: switches.chain, render: switches.render },
      });

      const kept: Beat[] = [];
      const warnings: string[][] = [];
      const dropped: unknown[] = [];
      let n = 0;
      const emit = (raw: unknown) => {
        const check = validateBeat(raw, answer.sentences);
        if (check.ok && check.beat) {
          n += 1;
          kept.push(check.beat);
          warnings.push(check.warnings);
          send({ type: "beat", n, beat: check.beat, warnings: check.warnings });
        } else {
          dropped.push({ raw, reason: check.dropped });
          console.warn(`[translator] dropped beat (${check.dropped}):`, JSON.stringify(raw).slice(0, 200));
          send({ type: "dropped", raw, reason: check.dropped });
        }
      };

      try {
        if (answer.kind === "deflection" && answer.link) {
          // Built in code: one beat, the link as the headline.
          emit(deflectionBeat(answer.sentences, answer.link));
          send({ type: "done", source: "deflection", beats: n, dropped: dropped.length, ms: Date.now() - started });
          controller.close();
          return;
        }

        const key = cacheKey(answer.answer);
        const cachedRaw = switches.translateCache ? readCache(key) : null;
        // A cache entry written by an earlier translator version is a stale
        // hit, not a match: its beats were validated against that version's
        // rules (e.g. v0.1's 18-word line budget), so it is regenerated live
        // rather than served as if it were v0.2. Pinned exemplars are kept
        // current by hand (data/translations/<hash>.json) for exactly this
        // reason.
        const cached =
          cachedRaw && cachedRaw.translator === TRANSLATOR_VERSION ? cachedRaw : null;
        if (cached && Array.isArray(cached.beats) && cached.beats.length > 0) {
          for (const beat of cached.beats) emit(beat);
          send({
            type: "done",
            source: cached.pinned ? "pinned" : "cache",
            key,
            beats: n,
            dropped: dropped.length,
            ms: Date.now() - started,
          });
          controller.close();
          return;
        }

        if (!(process.env.ANTHROPIC_API_KEY ?? "").trim()) {
          send({ type: "error", error: "ANTHROPIC_API_KEY missing" });
          controller.close();
          return;
        }

        const client = new Anthropic();
        const claude = client.messages.stream({
          model: MODEL,
          max_tokens: 8000,
          output_config: { effort: "medium" },
          system: [
            {
              type: "text",
              text: TRANSLATOR_SYSTEM,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: translatorUserPrompt(answer.question, answer.sentences) }],
        });
        const onAbort = () => claude.abort();
        req.signal.addEventListener("abort", onAbort);

        let buffer = "";
        let firstTokenMs: number | null = null;
        try {
          for await (const event of claude) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              if (firstTokenMs === null) firstTokenMs = Date.now() - started;
              buffer += event.delta.text;
              const { objects, rest } = drainNdjson(buffer);
              buffer = rest;
              for (const obj of objects) emit(obj);
            }
          }
          if (buffer.trim()) {
            const { objects } = drainNdjson(buffer + "\n");
            for (const obj of objects) emit(obj);
          }
        } finally {
          req.signal.removeEventListener("abort", onAbort);
        }

        const final = await claude.finalMessage();
        const ms = Date.now() - started;
        if (kept.length > 0 && !req.signal.aborted) {
          writeCache(key, {
            translator: TRANSLATOR_VERSION,
            question: answer.question,
            beats: kept,
            dropped,
            warnings,
            model: MODEL,
            ms,
          });
        }
        send({
          type: "done",
          source: "live",
          key,
          model: MODEL,
          beats: n,
          dropped: dropped.length,
          firstTokenMs,
          ms,
          usage: final.usage,
          stopReason: final.stop_reason,
        });
      } catch (cause) {
        if (req.signal.aborted) {
          controller.close();
          return;
        }
        const message = cause instanceof Error ? cause.message : "translator failed";
        console.error("[translator]", message);
        send({ type: "error", error: message, beats: n });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
