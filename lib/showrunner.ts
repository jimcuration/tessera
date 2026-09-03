"use client";

/**
 * The Showrunner: one LLM call writes a batch of shot prompts for a title.
 * Story titles get a chained, continuous sequence with an arc; chaos
 * channels get escalating hard cuts. When a batch runs low, the stream asks
 * for the next one, handing back a synopsis so the story continues.
 */

import { extractJson, llm } from "./fal";
import type { Title } from "./catalog";

export interface Shot {
  /** Full video prompt for this shot (style tokens appended). */
  prompt: string;
  /** Scripted spoken line shown as a subtitle, or null for a silent shot. */
  caption: string | null;
  /** Seconds. */
  duration: number;
  /** Chain from the previous shot's last frame (false = hard cut). */
  chain: boolean;
}

export interface Batch {
  episodeTitle: string;
  synopsis: string;
  shots: Shot[];
}

/**
 * Audio grammar. The video model babbles pseudo-speech unless voices are
 * declared wordless, and pronounces a line cleanly ONLY when it is quoted
 * verbatim in the prompt (measured with Whisper on H3 Max). The branch
 * lives in code: prompts with a quoted line get the scripted clause.
 */
const WORDLESS =
  "Sound: ambient environmental audio and cinematic score only; any voices are wordless (breaths, gasps, effort), with no spoken dialogue.";
const SCRIPTED =
  "Sound: ambient environmental audio and cinematic score; the only spoken words are the exact quoted line in this prompt, delivered clearly in English; all other voices are wordless.";
const QUOTED_LINE = /"[^"]{2,}"|“[^”]{2,}”/;

export function soundClause(prompt: string): string {
  return QUOTED_LINE.test(prompt) ? SCRIPTED : WORDLESS;
}

const STORY_SYSTEM = `You are the SHOWRUNNER of a live streaming service where films are rendered by an AI video model one shot at a time, in real time, as the viewer watches. You write the shot list.
Each shot is a short video-generation prompt. Shots CHAIN: every shot starts from the exact last frame of the previous shot, so continuity is carried by the image and your prompt only needs to describe what CHANGES and where the camera goes. Cuts do not exist inside a batch: write one continuous, flowing film.

Return ONLY compact JSON, no markdown fences, exactly this shape:
{"episode_title": string, "synopsis": string, "shots": [{"prompt": string, "caption": string|null}]}

RULES:
- Write exactly the number of shots requested. Together they form a clear dramatic movement with a beginning, escalation, and a turn, and the final shot must END ON A HOOK that the next batch can pick up.
- prompt: 2-3 sentences, under 420 characters. Open with a short clause grounding what is on screen right now (the previous shot's ending), then the action and the world's visible reaction across the shot's seconds, ending on a readable frame: key subjects in view a few paces from camera, never an extreme close-up or total darkness. Something must visibly HAPPEN in every shot; the video model fills quiet prompts with idle drift.
- Recurring characters are described the SAME way every time (name, clothing, one distinguishing feature) so the model keeps them consistent.
- SPEECH IS ALWAYS SCRIPTED: if anyone speaks, the prompt contains their exact words in double quotes (one short line, under 12 words, plain English) using this delivery grammar: the character acts silently, then 'says, "..."', then continues without another word. Never write the word "exactly" next to the line; the model may speak it. Unscripted speech renders as gibberish. Never two speakers in one shot.
- DIALOGUE DENSITY: this is talking cinema, not a silent film. At least every other shot has a spoken line, and the FIRST shot of the batch ALWAYS has one. Lines carry the story: a reveal, a threat, a decision, a question. A wordless shot is a deliberate beat, not a default.
- caption: the quoted spoken line verbatim when the shot has one, else null. Never invent a caption without a quoted line in the prompt.
- Never mention cameras as equipment, the AI, the viewer, or the service. Never quote dialogue you did not write into the prompt.
- synopsis: under 60 words, present tense, the story so far INCLUDING this batch, as completed facts, so the next batch can continue it.`;

const CHAOS_SYSTEM = `You are the SHOWRUNNER of a live brainrot channel on a streaming service where every shot is rendered by an AI video model in real time. You write escalating, absurd, hilarious shot prompts. Shots are HARD CUTS: each is a self-contained video prompt that must fully describe its own scene, subject, and look.

Return ONLY compact JSON, no markdown fences, exactly this shape:
{"episode_title": string, "synopsis": string, "shots": [{"prompt": string, "caption": string|null}]}

RULES:
- Write exactly the number of shots requested. Each shot is ONE clear absurd gag that a viewer gets in two seconds, and the batch escalates: bigger, weirder, more committed, never repeating a gag.
- prompt: 2-3 sentences, under 420 characters, fully self-contained: who, where, what happens, in what visual style. Concrete physical comedy over abstract weirdness. Something must visibly HAPPEN across the shot.
- Keep the channel's premise and cast consistent across shots, described the same way every time.
- SPEECH IS ALWAYS SCRIPTED: if anyone speaks, the prompt contains their exact words in double quotes (one short punchy line, under 10 words, plain English) using this delivery grammar: the character acts silently, then 'says, "..."', then continues without another word. Never write the word "exactly" next to the line; the model may speak it. Unscripted speech renders as gibberish. Never two speakers in one shot.
- DIALOGUE DENSITY: at least every other shot has a line (a deadpan anchor read, a shouted verdict, a confession), and the FIRST shot of the batch ALWAYS has one. The line is often the punchline.
- caption: the quoted spoken line verbatim when the shot has one, else null.
- Never mention cameras as equipment, the AI, the viewer, or the service.
- synopsis: under 40 words, what has aired so far, so the next batch keeps escalating instead of repeating.`;

function parseBatch(raw: string, title: Title, seconds: number): Batch {
  const parsed = JSON.parse(extractJson(raw)) as {
    episode_title?: unknown;
    synopsis?: unknown;
    shots?: unknown;
  };
  const chain = title.mode === "story";
  const shots: Shot[] = [];
  if (Array.isArray(parsed.shots)) {
    for (const entry of parsed.shots) {
      if (!entry || typeof entry !== "object") continue;
      const raw = entry as { prompt?: unknown; caption?: unknown };
      let prompt =
        typeof raw.prompt === "string" ? raw.prompt.trim().slice(0, 480) : "";
      if (!prompt) continue;
      let caption =
        typeof raw.caption === "string" && raw.caption.trim()
          ? raw.caption.trim().slice(0, 120).replace(/^["“]|["”]$/g, "")
          : null;
      if (caption && !QUOTED_LINE.test(prompt)) {
        // The LLM wrote a line but forgot the quotes (or used single ones).
        // Without a quoted line the model babbles, so put the line back in
        // the delivery grammar rather than silencing the shot.
        const bare = prompt.indexOf(caption);
        prompt =
          bare !== -1
            ? `${prompt.slice(0, bare)}"${caption}"${prompt.slice(bare + caption.length)}`
            : `${prompt.replace(/[.!?]?\s*$/, ".")} A character says, "${caption}" and continues without another word.`;
      }
      // Belt and braces: "says exactly" tends to get spoken aloud.
      prompt = prompt.replace(/\bsays exactly\b/gi, "says,").replace(/\bexactly,?\s+(?=["“])/gi, "");
      if (!QUOTED_LINE.test(prompt)) caption = null;
      shots.push({
        prompt: `${prompt} ${soundClause(prompt)} ${title.style}`,
        caption,
        duration: seconds,
        chain,
      });
    }
  }
  if (shots.length === 0) throw new Error("showrunner returned no shots");
  return {
    episodeTitle:
      typeof parsed.episode_title === "string" && parsed.episode_title.trim()
        ? parsed.episode_title.trim().slice(0, 80)
        : title.title,
    synopsis:
      typeof parsed.synopsis === "string" ? parsed.synopsis.trim().slice(0, 600) : "",
    shots,
  };
}

export async function writeBatch(args: {
  title: Title;
  /** Story so far; empty for the first batch. */
  synopsis: string;
  count: number;
  /** Seconds per shot. */
  seconds: number;
  /** What is on screen as the batch begins (the cold open / last shot). */
  onScreen: string;
  /** First batch of the session: short, and it must open with a voice. */
  opening?: boolean;
}): Promise<Batch> {
  const { title } = args;
  const system = title.mode === "story" ? STORY_SYSTEM : CHAOS_SYSTEM;
  const prompt =
    `TITLE: ${title.title}\n` +
    `LOGLINE: ${title.logline}\n` +
    `PREMISE: ${title.premise}\n` +
    `VISUAL STYLE (already appended to every prompt, do not repeat it): ${title.style}\n` +
    (args.synopsis
      ? `STORY SO FAR: ${args.synopsis}\n`
      : "STORY SO FAR: nothing yet; this is the opening.\n") +
    `ON SCREEN RIGHT NOW: ${args.onScreen}\n` +
    (args.opening
      ? `This is a SHORT opening batch: the viewer has watched a silent cold open and is waiting to hear someone speak. Shot 1 continues directly from what is on screen and contains a spoken line.\n`
      : "") +
    `Each shot runs ${args.seconds} seconds. Write exactly ${args.count} shots.`;
  const request = () =>
    llm({
      systemPrompt: system,
      prompt,
      maxTokens: Math.min(2400, 200 + args.count * 220),
      temperature: title.mode === "chaos" ? 0.95 : 0.8,
    }).then((output) => parseBatch(output, title, args.seconds));
  // The opening shot is on the critical path and LLM latency has a long
  // tail (2s typical, 10s sometimes). Race two identical requests and take
  // whichever parses first; the loser costs a fraction of a cent.
  if (args.opening) return Promise.any([request(), request()]);
  return request();
}
