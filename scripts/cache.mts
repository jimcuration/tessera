// WP9: lists what's cached, and pre-renders whatever isn't, for every
// record in data/diginex.json under the CURRENT effective switches
// (VOICE/CHAIN/CLIP_SECONDS, same defaults lib/config.ts#readSwitches
// uses) and the current TRANSLATOR_VERSION/STYLE_SHEET_VERSION.
//
// This is an ORCHESTRATOR, not a fal-calling script: it uses lib/cache.ts's
// own completeness/match check directly (so "what's cached" here and "what
// plays from cache" in the running app never disagree), then shells out to
// scripts/render.mts — the existing headless renderer — against a RUNNING
// dev server for anything missing. It never starts a server itself.
//
//   npm run cache
//   npx tsx scripts/cache.mts [--base http://localhost:3909] \
//     [--voice native|saskia] [--chain on|off] [--clip-seconds 5|10|15]
//
// Switches default to .env.local's own VOICE/CHAIN/CLIP_SECONDS unless
// overridden on the command line. Start a dev server first (npm run dev,
// or this worktree's own .claude/launch.json "tessera-wp9" entry on 3909)
// — this script fails fast with a clear message if --base isn't reachable.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { findCachedProgramme, type FindCacheInput } from "../lib/cache.ts";
import { STYLE_SHEET_VERSION } from "../lib/prompt.ts";
import { TRANSLATOR_VERSION } from "../lib/translator.ts";

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

function arg(name: string, fallback: string | null = null): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const base = arg("base", "http://localhost:3909") as string;
const voiceRaw = arg("voice", process.env.VOICE ?? "saskia");
const voice = voiceRaw === "native" ? "native" : "saskia";
const chainRaw = arg("chain", process.env.CHAIN ?? "on");
const chain = chainRaw === "off" ? "off" : "on";
const clipSecondsRaw = arg("clip-seconds", process.env.CLIP_SECONDS ?? "15");
const clipSeconds = clipSecondsRaw === "5" ? 5 : clipSecondsRaw === "10" ? 10 : 15;

const recordingsDirPath = path.resolve(
  process.cwd(),
  (process.env.RECORDINGS_DIR ?? "").trim() || "../tessera-recordings"
);

interface FixtureRecord {
  question: string;
}
interface Fixture {
  records: FixtureRecord[];
}
const fixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "data", "diginex.json"), "utf8")
) as Fixture;

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function serverUp(): Promise<boolean> {
  try {
    const res = await fetch(`${base}/api/config`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

function lookup(question: string): ReturnType<typeof findCachedProgramme> {
  const input: FindCacheInput = {
    recordingsDir: recordingsDirPath,
    matchedQuestion: question,
    voice,
    chain,
    clipSeconds,
    translatorVersion: TRANSLATOR_VERSION,
    styleSheetVersion: STYLE_SHEET_VERSION,
  };
  return findCachedProgramme(input);
}

async function main() {
  console.log(
    `[cache] voice=${voice} chain=${chain} clip-seconds=${clipSeconds} translator=${TRANSLATOR_VERSION} style-sheet=${STYLE_SHEET_VERSION}`
  );
  console.log(`[cache] recordings dir: ${recordingsDirPath}`);

  type Row = { question: string; status: "cached" | "missing" | "rendered" | "failed"; sessionId?: string };
  const rows: Row[] = fixture.records.map((r) => {
    const hit = lookup(r.question);
    return { question: r.question, status: hit ? "cached" : "missing", sessionId: hit?.sessionId };
  });

  console.log("\n[cache] status:");
  for (const row of rows) {
    const label = row.status === "cached" ? "cached " : "missing";
    console.log(`  ${label}  ${truncate(row.question, 62)}${row.sessionId ? `  (${row.sessionId})` : ""}`);
  }

  const missing = rows.filter((r) => r.status === "missing");
  if (missing.length === 0) {
    console.log("\n[cache] everything is cached for these switches/versions.");
    return;
  }

  console.log(`\n[cache] ${missing.length} of ${rows.length} record(s) missing; checking dev server at ${base}...`);
  const up = await serverUp();
  if (!up) {
    console.error(
      `[cache] no dev server reachable at ${base}. Start one first (npm run dev, or this worktree's own .claude/launch.json "tessera-wp9" entry), then rerun npm run cache.`
    );
    process.exitCode = 1;
    return;
  }

  let rendered = 0;
  let failed = 0;
  for (const row of missing) {
    console.log(`\n[cache] rendering: ${row.question}`);
    // WP9: the question reaches render.mts through a temp file
    // (--question-file), not a raw CLI argument. Found live: a question
    // containing a shell metacharacter ("...given the M&A spend?" — cmd.exe
    // reads bare `&` as a command separator) or a character npm's own arg
    // parser rejects (an em dash) silently mangled the call on Windows
    // under `shell: true` (one case even ran to completion against the
    // WRONG question, resolved by getAnswer's fuzzy matcher, rather than
    // failing loudly) — see briefs/WP9-handoff.md. `shell: true` is still
    // needed here: without it, spawning the platform's "npx.cmd"/"npx" shim
    // directly fails with EINVAL on Windows. A file path never contains a
    // shell metacharacter this script itself introduces, so the two issues
    // don't recombine.
    const tmpDir = mkdtempSync(path.join(tmpdir(), "tessera-cache-"));
    const questionFile = path.join(tmpDir, "question.txt");
    writeFileSync(questionFile, row.question, "utf8");
    let result;
    try {
      result = spawnSync(
        "npx",
        [
          "tsx",
          "scripts/render.mts",
          "--question-file",
          questionFile,
          "--voice",
          voice,
          "--chain",
          chain,
          "--clip-seconds",
          String(clipSeconds),
          "--base",
          base,
          "--suffix",
          `cache-${slug(row.question)}`,
        ],
        { stdio: "inherit", shell: true }
      );
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    if (result.error || result.status !== 0) {
      console.error(`[cache] render failed for: ${row.question}`, result.error ?? `exit ${result.status}`);
      row.status = "failed";
      failed += 1;
      continue;
    }
    const hit = lookup(row.question);
    if (hit) {
      row.status = "rendered";
      row.sessionId = hit.sessionId;
      rendered += 1;
      console.log(`[cache] cached: ${hit.sessionId}`);
    } else {
      row.status = "failed";
      failed += 1;
      console.error(`[cache] rendered but still incomplete (check face-gate drops / partial upload): ${row.question}`);
    }
  }

  const alreadyCached = rows.length - missing.length;
  console.log(
    `\n[cache] summary: ${alreadyCached} already cached, ${rendered} newly rendered, ${failed} failed, ${rows.length} total.`
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((cause) => {
  console.error("[cache] failed:", cause instanceof Error ? cause.stack ?? cause.message : cause);
  process.exit(1);
});
