import { type NextRequest } from "next/server";
import { findCachedProgramme } from "@/lib/cache";
import { readSwitches, recordingsDir } from "@/lib/config";
import { getAnswer } from "@/lib/curation";
import { STYLE_SHEET_VERSION, TIMING_VERSION } from "@/lib/prompt";
import { TRANSLATOR_VERSION } from "@/lib/translator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * WP9 cached playback lookup. POST {question} → resolves the answer the
 * same way /api/translate does (getAnswer), reads the current switches, and
 * asks lib/cache.ts for a matching, complete recording. A hit returns
 * everything lib/programme.ts's Session needs to hydrate playback without
 * touching fal: the answer header (same shape as /api/translate's "answer"
 * message), the flat beats array, and per-shot descriptors with URLs built
 * against /api/recording. {hit:false} (404) otherwise.
 */
export async function POST(req: NextRequest) {
  let question = "";
  try {
    const body = (await req.json()) as { question?: unknown };
    question = typeof body.question === "string" ? body.question.trim() : "";
  } catch {
    return Response.json({ hit: false, error: "bad request" }, { status: 400 });
  }
  if (!question) return Response.json({ hit: false }, { status: 404 });

  const answer = await getAnswer(question);
  if (!answer) return Response.json({ hit: false }, { status: 404 });

  const switches = readSwitches();
  const cached = findCachedProgramme({
    recordingsDir: recordingsDir(),
    matchedQuestion: answer.question,
    voice: switches.voice,
    chain: switches.chain,
    clipSeconds: switches.clipSeconds,
    translatorVersion: TRANSLATOR_VERSION,
    styleSheetVersion: STYLE_SHEET_VERSION,
    timingVersion: TIMING_VERSION,
    palette: switches.palette,
  });
  if (!cached) return Response.json({ hit: false }, { status: 404 });

  const session = cached.sessionId;
  const recordingUrl = (file: string) => `/api/recording?session=${encodeURIComponent(session)}&file=${encodeURIComponent(file)}`;

  return Response.json({
    hit: true,
    sessionId: session,
    answer: {
      question: answer.question,
      kind: answer.kind,
      link: answer.link,
      card: answer.card,
      followups: answer.followups,
      fromSpine: answer.fromSpine,
      sentences: answer.sentences,
    },
    beats: cached.beats,
    shots: cached.shots.map((shot) => ({
      n: shot.n,
      duration: shot.duration,
      resolution: shot.resolution,
      videoUrl: recordingUrl(shot.mp4File),
      beats: shot.beats.map((b) => ({
        n: b.n,
        beat: b.beat,
        offsetSeconds: b.offsetSeconds,
        audioUrl: switches.voice === "saskia" ? recordingUrl(`${b.n}.mp3`) : null,
      })),
    })),
  });
}
