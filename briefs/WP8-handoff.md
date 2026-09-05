# WP8 — Handoff

Worktree `../tessera-wp8`, branch `wp8`, off `main` at `5420f1b`. Do not mark acceptance criteria as passed — see `briefs/WP8-report.md`'s closing section for what was measured against each one; this doc is what was built and how to run it.

## What was built

**1. `CLIP_SECONDS=5|10` as a config switch.**

- `lib/config.ts`: new `ClipSeconds` type and `Switches.clipSeconds`, read from `process.env.CLIP_SECONDS` (default 5), served by `/api/config` like every other switch.
- `lib/translator.ts`: `maxLineWords(clipSeconds)` (12 at 5s, 22 at 10s) replaces the hardcoded `MAX_LINE_WORDS`; `validateBeat` and `deflectionBeat` take an optional `clipSeconds` param (default 5, so every existing call site not yet updated keeps 5s behaviour). `TRANSLATOR_SYSTEM` (a constant) became `translatorSystem(clipSeconds)` (a function): at 10s, rule 5 changes to "one or two short sentences, 22 words" and rule 9 gains the internal-cut instruction — write `action` as `"[0-5s] ... [5-10s] ..."`, the second half either continuing the first half's movement or cutting once to a second composition. `TRANSLATOR_SYSTEM` is kept as `translatorSystem(5)` for anything not clip-length-aware.
- `app/api/translate/route.ts`: reads `switches.clipSeconds`, passes it to `translatorSystem`/`validateBeat`/`deflectionBeat`, and threads it through the translation cache. **Cache key**: 5s keeps the original `sha1(answer)` key untouched (every pinned exemplar in `data/translations/` still resolves — verified: the pinned spine question still serves `source: "pinned"` after this change); 10s gets its own `sha1("10s\n"+answer)` namespace so a 5s and 10s translation of the same answer never collide. A cached entry also now carries `clipSeconds`; the cache-validity check requires it to match the current switch (a file with no `clipSeconds` field reads as 5, so old files aren't invalidated).
- `lib/prompt.ts`: `compilePrompt`/`beatBlock` take an optional `clipSeconds` (default 5). At 10s, one line is added to the **beat block** (not the numbered style sheet — see "Scope calls" below): `"Duration: this shot is exactly 10 seconds, not 5 (overrides the style sheet's stated length above)."` Verified in every 10s prompt sent; verified the actual rendered clips came back at ~10.1s (ffmpeg `durationOf`) vs ~5.2s at the default.
- `lib/programme.ts` / `scripts/render.mts`: `SHOT_SECONDS`/`shot.duration` now come from the switch instead of a hardcoded `5`.
- `lib/stream.ts` / `lib/render.ts`: `Stream` takes a `clipSeconds` constructor arg; the render buffer (`MAX_BUFFER` clips) became `MIN_BUFFER_SECONDS = 10` (queue length × clip length ≥ 10s of playback held ahead), per brief §1. This is the one change to `lib/stream.ts`'s buffer logic, explicitly authorized by this brief (CLAUDE.md rule 3 otherwise forbids it).
- `scripts/check.mjs`: mirrors `maxLineWords`, reads `clipSeconds` from a session's `session.json` (`switches.clipSeconds`) or a cached translation's own `clipSeconds` field (both default 5).

**2. Saskia per scene, not per line.**

- `app/api/voice/route.ts` — rewritten. New contract: `POST {session, scene, beats: [{n, text}]}` → one ElevenLabs request for the whole scene's concatenated text, split server-side into one track per beat, returned as `{ok, splitMethod, beats: [{n, audioBase64, durationSeconds}]}`.
  - Primary split: ElevenLabs' `with-timestamps` endpoint, character-level alignment. The cut after beat *i* is the alignment's `character_end_times_seconds` at the character index where beat *i*'s text ends in the concatenated scene text (beats joined with a single space). Verified working in every one of 21 scene requests across the render campaign, including with `eleven_v3`'s inline `[bracket]` audio tags in the text.
  - Fallback: `scripts/ffmpeg.mjs#silenceGapMidpoints` (new — ffmpeg `silencedetect`, must run outside the shared `ffmpeg()` wrapper because that wrapper sets `-loglevel error` which would swallow silencedetect's own log lines) picks the silence gap nearest each beat boundary's expected (text-length-proportional) position. Used automatically when `with-timestamps` fails or returns no alignment. Verified independently against one real scene (found a midpoint 40ms from the timestamps-derived cut) but **never exercised by an actual failure** in this campaign — see "Untested" below.
  - Every scene request is saved: the full scene mp3 (`<session>/scene-<n>.mp3`), each split beat mp3 (`<session>/<n>.mp3` — same filename as before, so `scripts/reel.mjs`, `scripts/whisper-match.py` etc. need no change), and a `voice-scene-<n>.json` log (model, voice, settings, per-beat text, `sceneText`, `splitMethod`, `cutTimes`, the raw `alignment` when present).
  - Single-beat "scenes" (the two lone-beat scenes seen in one live translation, §7 of the report) are handled without cutting: the whole scene mp3 is used as-is.
- `lib/voice.ts` (`Narrator`): `prefetch(n, text)` replaced by `prefetchScene(scene, beats)` — one request per scene, decodes the returned base64 tracks into object URLs, same `tracks` map and `play(n)`/`stop()` as before.
- `lib/programme.ts` (`Session`): buffers beats by `scene` as they stream from the translator; flushes (calls `narrator.prefetchScene`) the moment the next beat starts a new scene, and once more when the translator stream ends (for the last scene). Verified live in the browser (see below) — Saskia narration played correctly, beat by beat, for a full 9-beat 10s programme with no code changes to `play()`/`onStarted` in `components/player.tsx`.
- `scripts/render.mts` (headless renderer): groups all beats by scene once translation completes and posts one `/api/voice` request per scene, before the video render loop (was: one request per beat, interleaved with rendering).

**3. New verification and reporting.**

- `scripts/saskia-split-check.py` (new) — independent of however the split was made: Whisper-transcribes each beat's own split `<n>.mp3`, scores recall against that beat's own `delivery` text, and separately checks for a run of 2+ consecutive words unique to a *neighbouring* beat's line (evidence of a bad cut). Writes `<session>/saskia-split-check.json`; `npm run split-check <session>` runs it. Run against all 5 render-campaign sessions: 0 of 44 beats showed a neighbour's words (report §4).
- `scripts/report.mjs` — added: render/playback ratio (p50, max) per session and pooled by clip length; an approximate time-to-first-frame (`firstBeatMs` + first clip's `renderMs`, explicitly labelled as an estimate from recorded fields, not a browser paint measurement); words-per-line mean; a nominal seam-count-per-minute (external cuts = clip count − 1, plus one internal cut per clip at 10s, explicitly labelled nominal since whether the internal cut reads as a cut is a visual call); a Saskia-scenes summary (request count, split method) per session; a `saskia-split-check.json` summary line when present; and a closing cross-session table + acceptance-criterion-2 read-out when more than one clip length is passed on the command line.

## How to run it

```
CLIP_SECONDS=5|10 in .env.local (or the shell), then `npm run dev` (restart required — it is read once at process start like every switch already documented in lib/config.ts; editing .env.local alone did not take effect on a running dev server in testing here, contrary to the file's own comment about "no code change" — see Untested/Notes below)

npx tsx scripts/render.mts --question "..." --voice saskia --chain on --clip-seconds 5|10 [--music on] [--base http://localhost:PORT] [--suffix name]
  — --clip-seconds only affects THIS script's own fal duration/prompt; the dev server's own CLIP_SECONDS (translator word budget, internal-cut instruction) must already match, or the translation and the video will disagree.

npm run check [recordings/<session> | data/translations/<hash>.json]   — now clip-length aware
npm run split-check recordings/<session> [--model medium]              — Whisper split verification (new)
npm run report recordings/<session> [recordings/<session> ...]         — now reports ratio, words/line, time-to-first-frame, seams/min, split method; add a cross-session summary when given sessions of different clip lengths
node scripts/reel.mjs recordings/<session> --out recordings/reels/name.mp4 --narration --music ../tessera-recordings/music/bed.mp3   — unchanged, works because split beat mp3s still land at <session>/<n>.mp3
```

## Findings (full detail in `briefs/WP8-report.md`)

- 10s p50 render/playback ratio: **0.38** (target ≤ 0.6), across 4 sessions / 38 ten-second clips. Two outlier clips (8-9s wall clock) were queue variance, same pattern WP0 found at 5s.
- Saskia per-scene generation + split: **0 of 44 beats** across 5 sessions showed a neighbour's words on independent Whisper verification; ElevenLabs' `with-timestamps` succeeded on all 21 scene requests (the silence-gap fallback path exists and was unit-verified but never triggered by a real failure).
- 10s spine played through **in the app** (not just the headless script) via the Browser tool: 9/9 beats swapped at `readyState` 3 or 4, no blank-frame or stall warnings, clean transition to the "ended" auto-continue state.
- One pre-existing translator-adherence issue found (not caused by WP8, not fixed by WP8 — out of this brief's scope): the live-catalysts 10s translation produced two one-beat scenes, violating the 2-3-beat scene rule that `npm run check`'s `checkProgramme` already enforces as a report-time (not runtime) check.
- Style-sheet line 10 ("16:9, 5 seconds...") survives at 0/6 (5s) and 0-1/9-10 (10s) in `expanded_prompt` — equally near-zero at both lengths, so not something WP8's beat-block duration line caused; worth flagging to whoever next touches the style sheet (WP7's territory) since WP0 measured 7/18 for this same line.

## Untested / not verified

- **The silence-gap fallback split path** (`cutsFromSilence` in `app/api/voice/route.ts`, `silenceGapMidpoints` in `scripts/ffmpeg.mjs`) was verified in isolation against one real scene's audio but never exercised by an actual `with-timestamps` failure in this campaign — `with-timestamps` succeeded every time. If it matters, forcing a failure (e.g. temporarily pointing the URL at a bad path) and confirming the resulting split still passes `saskia-split-check.py` would close this gap.
- **Restarting the dev server for a `.env.local`-only `CLIP_SECONDS` change**: in testing, a running dev server did not pick up an edited `CLIP_SECONDS` in `.env.local` without a restart, even though `lib/config.ts`'s own comment says a `.env.local` change "take[s] effect on the next question, no code change." This may be specific to how the process was started in this session (env vars passed on the command line for `VOICE`/`CHAIN`/`PORT` alongside `.env.local`) rather than a real bug — not conclusively diagnosed either way. Flagging so it isn't assumed to hot-reload.
- **The "no people in any clip" criterion** was checked only via the translator's existing people-lexicon/proper-name gate (0 beats dropped for this reason across 4 live translations) and by reading `subjects` fields — not by inspecting rendered frames for this report, unlike WP0's contact-sheet method. No face gate is merged in this worktree (WP5.1 is separate).
- **The seam-count-per-minute numbers are nominal**, not a visual count from watching the reels — whether a beat's internal "[5-10s]" half actually reads as a cut versus a continuous movement varies by beat (see report §5's example); Robin's subjective notes column in the report is deliberately left blank per the brief.
- **Two live translations were rendered as their own full length** (9-10 beats each, whatever the translator naturally produced) rather than trimmed — this is what "two live translations at 10s" was read to mean, but if a shorter/cheaper sample was intended instead, that's a scope call worth confirming.
- **`reels/spine-5s-vs-10s.mp4`** is a silent, truncated-to-30s side-by-side (see report §6 for why); the two full reels with their own narration (`spine-5s.mp4`, `spine-10s.mp4`) are the ones to actually watch.

## Scope calls made without an explicit answer in the brief

1. **The beat-block duration override line** in `lib/prompt.ts` (see "What was built" §1) — the brief lists the style sheet as out of scope (owned by WP7, working in a parallel worktree on the same file), but the fal `duration` genuinely changes with `CLIP_SECONDS` and the numbered style sheet states a fixed "5 seconds." Added one line to the beat block instead of editing the numbered sheet, to avoid colliding with WP7's parallel edits to the same function while still telling the model the truth about its own clip length. Flagged in the report; not presented as self-evidently correct.
2. **CLAUDE.md hard rule 4** ("5-second clips") is deliberately overridden at `CLIP_SECONDS=10`, per this brief's own explicit instruction — noted here since CLAUDE.md asks builders to flag any brief/CLAUDE.md conflict.

## Merge notes

New/changed files: `lib/config.ts`, `lib/translator.ts`, `lib/prompt.ts`, `lib/stream.ts`, `lib/render.ts`, `lib/programme.ts`, `lib/voice.ts`, `app/api/translate/route.ts`, `app/api/voice/route.ts`, `scripts/check.mjs`, `scripts/report.mjs`, `scripts/render.mts`, `scripts/ffmpeg.mjs`, `scripts/saskia-split-check.py` (new), `package.json` (`split-check` script added). No changes to `lib/fal.ts`, `lib/frames.ts`, `lib/recorder.ts`, `components/*`, `app/page.tsx`, `app/api/record`, `app/api/config`, `app/api/media`, `app/api/music`, or the style sheet content in `lib/prompt.ts#styleSheet`/`CLAUDE.md`. Three new cached translations committed under `data/translations/` (the 10s spine question and the two live 10s translations) — normal "save everything" practice, same as every prior WP's committed cache entries.

`npx tsc --noEmit` is clean. `npm run check` on the five WP8 sessions: 0 hard failures except the pre-existing scene-run soft-miss noted above (which `checkProgramme` already reports as a `FAIL` line, by design — it is a report, not a runtime gate).
