import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { normalise } from "./curation";
import type { ChainSwitch, ClipSeconds, VoiceSwitch } from "./config";
import type { Beat } from "./translator";
import type { Resolution } from "./fal";

/**
 * WP9: matches a question + the current runtime switches + the current
 * translator/style-sheet/timing versions against RECORDINGS_DIR's saved sessions,
 * and checks that a match is actually complete (every beat has a shot clip,
 * and, under Saskia, its own split narration) before it is offered as a
 * cache hit. Server-only (uses node:fs) — imported by
 * app/api/cache/lookup/route.ts and by scripts/cache.mts, which run the
 * exact same completeness check this module uses for playback so "what's
 * cached" and "what actually plays from cache" never disagree.
 *
 * "Palette" isn't a separate switch anywhere in this codebase — the style
 * sheet's ground palette is versioned by STYLE_SHEET_VERSION (lib/prompt.ts)
 * itself, so a palette change already invalidates the cache by invalidating
 * that version. See briefs/WP9-handoff.md for this interpretation, flagged
 * there for Robin/PM to confirm against the WP9 brief's literal wording.
 */

const SAFE_ID = /^[A-Za-z0-9._-]{1,120}$/;
const SHOT_FILE_RE = /^(\d+)\.json$/;

interface SessionJson {
  matchedQuestion?: string;
  switches?: { voice?: string; chain?: string; clipSeconds?: number };
  translatorVersion?: string;
  styleSheetVersion?: string;
  timingVersion?: string;
  beats?: Beat[];
  savedAt?: string;
}

interface ShotBeatJson {
  n: number;
  beat: Beat;
  offsetSeconds: number;
}

interface ShotJson {
  n: number;
  beats: ShotBeatJson[];
  resolution?: string;
}

export interface CachedShot {
  /** 1-based number of the shot's first beat within the session — also its filename stem. */
  n: number;
  beats: ShotBeatJson[];
  /** Derived from the beat count and the matched clipSeconds switch (WP9 handoff §3: no shot JSON carries its own duration field). */
  duration: number;
  resolution: Resolution;
  mp4File: string;
}

export interface CachedProgramme {
  sessionId: string;
  /** The session's flat beat list, in order (session.json's own `beats`). */
  beats: Beat[];
  shots: CachedShot[];
}

export interface FindCacheInput {
  recordingsDir: string;
  /** The resolved answer's own question (answer.question from getAnswer()), not the typed question. */
  matchedQuestion: string;
  voice: VoiceSwitch;
  chain: ChainSwitch;
  clipSeconds: ClipSeconds;
  translatorVersion: string;
  styleSheetVersion: string;
  timingVersion: string;
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function listShotFiles(dir: string): { n: number; file: string }[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const out: { n: number; file: string }[] = [];
  for (const name of names) {
    const m = SHOT_FILE_RE.exec(name);
    if (m) out.push({ n: Number(m[1]), file: name });
  }
  return out.sort((a, b) => a.n - b.n);
}

/**
 * A recording directory is a complete, playable programme when every beat
 * 1..expectedBeatCount is covered by some shot file's own `beats` list, that
 * shot's own <n>.mp4 exists, and — under Saskia — every beat number also has
 * its own <n>.mp3 (split narration). Exported so scripts/cache.mts runs the
 * exact same check used at playback time.
 */
export function isCompleteRecording(dir: string, expectedBeatCount: number, voice: VoiceSwitch): boolean {
  if (expectedBeatCount <= 0) return false;
  const shotFiles = listShotFiles(dir);
  if (shotFiles.length === 0) return false;

  const covered = new Set<number>();
  for (const { n, file } of shotFiles) {
    const shot = readJson<ShotJson>(path.join(dir, file));
    if (!shot || !Array.isArray(shot.beats) || shot.beats.length === 0) continue;
    if (!existsSync(path.join(dir, `${n}.mp4`))) continue;
    for (const b of shot.beats) {
      if (typeof b?.n === "number") covered.add(b.n);
    }
  }
  for (let n = 1; n <= expectedBeatCount; n += 1) {
    if (!covered.has(n)) return false;
  }
  if (voice === "saskia") {
    for (let n = 1; n <= expectedBeatCount; n += 1) {
      if (!existsSync(path.join(dir, `${n}.mp3`))) return false;
    }
  }
  return true;
}

interface MatchedSession {
  dir: string;
  sessionId: string;
  session: SessionJson;
}

/** Every recorded session directory whose session.json matches the given question/switches/versions, most-recently-recorded first. Matching alone — completeness is checked separately (isCompleteRecording) since a builder may want to list in-progress recordings too. */
export function listMatchingSessions(input: FindCacheInput): MatchedSession[] {
  let names: string[];
  try {
    names = readdirSync(input.recordingsDir);
  } catch {
    return [];
  }
  const wanted = normalise(input.matchedQuestion);
  const matches: MatchedSession[] = [];
  for (const name of names) {
    // Skip the shared music/ folder and anything not a safe session id.
    if (name === "music" || !SAFE_ID.test(name)) continue;
    const dir = path.join(input.recordingsDir, name);
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    const sessionFile = path.join(dir, "session.json");
    if (!existsSync(sessionFile)) continue;
    const session = readJson<SessionJson>(sessionFile);
    if (!session || !session.matchedQuestion) continue;
    if (normalise(session.matchedQuestion) !== wanted) continue;
    if (session.switches?.voice !== input.voice) continue;
    if (session.switches?.chain !== input.chain) continue;
    if (session.switches?.clipSeconds !== input.clipSeconds) continue;
    if (session.translatorVersion !== input.translatorVersion) continue;
    if (session.styleSheetVersion !== input.styleSheetVersion) continue;
    if (session.timingVersion !== input.timingVersion) continue;
    matches.push({ dir, sessionId: name, session });
  }
  matches.sort((a, b) => {
    const ta = a.session.savedAt ? Date.parse(a.session.savedAt) : 0;
    const tb = b.session.savedAt ? Date.parse(b.session.savedAt) : 0;
    return tb - ta;
  });
  return matches;
}

/** The most recent complete cached programme matching input, or null. */
export function findCachedProgramme(input: FindCacheInput): CachedProgramme | null {
  for (const { dir, sessionId, session } of listMatchingSessions(input)) {
    const beats = Array.isArray(session.beats) ? session.beats : [];
    if (beats.length === 0) continue;
    if (!isCompleteRecording(dir, beats.length, input.voice)) continue;

    const shots: CachedShot[] = [];
    for (const { n, file } of listShotFiles(dir)) {
      const shot = readJson<ShotJson>(path.join(dir, file));
      if (!shot || !Array.isArray(shot.beats) || shot.beats.length === 0) continue;
      if (!existsSync(path.join(dir, `${n}.mp4`))) continue;
      const duration = input.clipSeconds === 15 ? shot.beats.length * 5 : input.clipSeconds;
      const resolution: Resolution = shot.resolution === "768P" ? "768P" : "480P";
      shots.push({
        n,
        beats: shot.beats.map((b) => ({ n: b.n, beat: b.beat, offsetSeconds: b.offsetSeconds })),
        duration,
        resolution,
        mp4File: `${n}.mp4`,
      });
    }
    if (shots.length === 0) continue;

    return { sessionId, beats, shots };
  }
  return null;
}
