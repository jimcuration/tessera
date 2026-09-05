# WP8.1 — Handoff

Worktree `../tessera-wp8`, branch `wp8` (same worktree as WP8, per the brief). Do not mark acceptance criteria as passed — see `briefs/WP8.1-report.md`'s closing section for what was measured against each one; this doc is what was built and how to run it.

## What was built

**1. `CLIP_SECONDS=15` — one fal generation per scene.**

- `lib/config.ts`: `ClipSeconds` widened to `5 | 10 | 15`; new `MusicBedSwitch`/`Switches.musicBed` (`MUSIC_BED=bed|bed-v2`, default `bed`).
- `lib/translator.ts`: `maxLineWords`/`validateBeat`/`deflectionBeat` widened to `5 | 10 | 15` (15 uses the same 22-word budget as 10, per brief §1). `translatorSystem(15)` reverts rule 9 (`action`) to the plain single-movement form (no `[0-5s]/[5-10s]` internal-cut instruction — that concept was specific to a single beat rendered as one longer clip at 10s; at 15s each beat is a 5s section placed into a scene by the prompt *compiler*, not by the beat's own text) and adds a one-line note that the programme renders one scene per generation.
- `lib/prompt.ts`: new `compileScenePrompt({beats, voice, previousHandoff})` — one STYLE SHEET, one SCENE header, one named `[0-5s]`/`[5-10s]`/`[10-15s]` section per beat (subjects/action/handoff/headline/connector/tag), one combined ON-SCREEN TEXT list in strict order (mirroring the reference prompt's TEXT CONTROL section), one audio block. `beatBlock`/`compilePrompt` (5s/10s path) also gained `connectorLine`/`tagLine` output and `copyList` now takes an optional tag text.
- `lib/stream.ts`: `Shot.beat` (singular) → `Shot.beats: ShotBeat[]` (`{n, beat, offsetSeconds}`, 1 entry at 5s/10s, 2-3 at 15s). The render buffer (WP8's seconds-based `MIN_BUFFER_SECONDS`) now tracks a running `bufferedSeconds` total (incremented on dispatch by the shot's own `duration`, decremented on `advance()`) instead of `queue.length * a constant clipSeconds` — required because shots now vary in length within one programme (a 2-beat scene is 10s, a 3-beat scene 15s).
- `lib/programme.ts`: new `videoSceneBuffer` (mirrors the existing Saskia `sceneBuffer`) and `flushVideoScene()` — at `CLIP_SECONDS=15`, beats are buffered by scene and dispatched as one `compileScenePrompt`-built shot when the scene completes (next beat starts a new scene, or the translator stream ends); at 5s/10s, unchanged (each beat dispatched immediately, as in WP8).
- `lib/recorder.ts`: `ShotMeta.beat` (singular) → `ShotMeta.beats: ShotMetaBeat[]` (`{n, beat, offsetSeconds, sources, warnings}`).
- `components/screen.tsx`: new `onTimeUpdate` handler steps through a multi-beat clip's `offsetSeconds` as `video.currentTime` crosses them, firing a new `onBeatBoundary(clip, beatIndex)` prop (indices ≥1; index 0 is the existing `onStarted`). Logs `[screen] beat boundary: beat N at Xs (offset Ys)` — added specifically so this could be verified against real playback, not just reasoned about.
- `components/player.tsx`: `onBeatBoundary` calls `narrator.play(beat.n)`, same as `onStarted` does for the first beat — Saskia's per-beat narration (already scene-batched since WP8) now starts at the right *moment inside* a multi-beat clip instead of only at a clip swap.
- `scripts/render.mts` (headless): `--clip-seconds` accepts `15`; new `renderScene()` mirrors `Session#flushVideoScene` — groups translated beats by scene, one `compileScenePrompt` + one `generateClip` call per scene, one `/api/record` POST with the `beats` (plural) shape.
- `scripts/check.mjs`/`scripts/report.mjs`/`scripts/reel.mjs`: all updated to read `rec.beats` (plural, new) with a fallback to `rec.beat` (singular, pre-WP8.1 recordings) — `reel.mjs`'s narration-timing loop in particular now reads each shot's own beats and their `offsetSeconds` to place multiple narration tracks against one video clip correctly (previously assumed one beat per clip).

**2. Connector and tag rules (all clip lengths).**

- `lib/translator.ts`: new `Connector`/`Tag` types, both required fields on `Beat` (`tag` nullable). `validateBeat` structurally validates both (connector: kind/from/to/colour non-empty, from≠to; tag: text ≤2 words, valid source, verbatim-in-cited-sentence via new `appearsVerbatim`). `validateProgramme` adds scene-level checks: every beat in a scene must carry an identical connector, connector `from`/`to` must be among the scene's combined subjects, at most one non-null `tag` per scene. `translatorSystem` gained rules 16 (connector) and 17 (tag), unconditional on clip length. `scripts/check.mjs` mirrors all of this.
- **Translator version bumped to `translator-v0.3.2`** (not `v0.4` — see "A naming collision" below), so every pre-existing cached/pinned translation (which has no `connector` field) reads as stale and is skipped by both the cache-validity check (`app/api/translate/route.ts`) and `npm run check`'s version gate, rather than hard-failing.
- **The 5s and 10s pinned exemplars** (`data/translations/a14c3cdf...json`, `e4fc1b52...json`) were hand-updated with a `connector` per scene and one `tag` each, and re-verified passing under v0.3.2 (0 `npm run check` failures) — otherwise WP8's own pinned exemplars would have gone stale under this brief's own schema change.
- **A new 15s pinned exemplar** was created from a live translation (`data/translations/ecc17ec6...json`) that passed `npm run check` cleanly on its first generation — promoted to `pinned: true` rather than hand-authored from scratch.

**3. Music bed v2.**

- `scripts/music-bed-v2.mts` (new): generates ~150s from ElevenLabs' `/v1/music` (same register as WP5's `bed.mp3` plus "dry drum hits", per brief §4), then crossfades the loop point with ffmpeg (`acrossfade`, 3s, blending the track's own tail into its own head so a native `<audio loop>` jump doesn't click) and saves to `<RECORDINGS_DIR>/music/bed-v2.mp3` + `bed-v2.json`. Run for real: produced 144.1s at 2,789,478 bytes. `bed.mp3`/`bed.json` untouched (confirmed: identical byte count and mtime before and after).
- `app/api/music/route.ts`: reads the new `MUSIC_BED` switch and serves `<musicBed>.mp3`. Verified both values serve the right file by byte count.

**4. Pronunciation map.**

- `data/pronunciations.json`: `{"Diginex": "Didge-in-ex"}`.
- `app/api/voice/route.ts`: loads the map and applies it (whole-word, case-insensitive) only to the text actually sent to ElevenLabs (`sceneTextForTTS`) and to the alignment-offset math (which must operate on the same text that was actually spoken) — the recorded `beats[].text`/`sceneText` in `voice-scene-*.json`, and everything `validateBeat`/`scripts/check.mjs` see, keep the original spelling. Verified directly in a real recording: `sceneText` reads "...Diginex held..." while `sceneTextForTTS` reads "...Didge-in-ex held...".
- `scripts/saskia-split-check.py`: new Diginex-transcription-consistency counter (`diginex_consistency`) — for every beat whose line names the company, checks whether Whisper's transcript contains "diginex" as a contiguous run of letters (case-insensitive, spaces stripped) — reported per-session and read by `scripts/report.mjs`.

## How to run it

```
CLIP_SECONDS=15 (plus VOICE=saskia, CHAIN=on, MUSIC=on) in .env.local, restart the dev server (same caveat as WP8: a running server did not pick up an edited CLIP_SECONDS without a restart in testing here)

npx tsx scripts/render.mts --question "..." --voice saskia --chain on --clip-seconds 15 [--music on] [--base http://localhost:PORT] [--suffix name]
  — as WP8: --clip-seconds only affects this script's own fal duration/prompt; the dev server's own CLIP_SECONDS must already match.

npm run check [recordings/<session> | data/translations/<hash>.json]   — now understands connector/tag and the plural `beats` shape
npm run split-check recordings/<session> [--model medium]              — now also reports Diginex transcription consistency
npm run report recordings/<session> [...]                              — now reports per-shot (not per-session-constant) duration/ratio, connector/tag presence counts
node scripts/reel.mjs recordings/<session> --out ... --narration --music ../tessera-recordings/music/bed.mp3   — unchanged invocation; now correctly places multiple narration tracks against one scene clip

npx tsx scripts/music-bed-v2.mts   — regenerate bed-v2.mp3 (never touches bed.mp3); MUSIC_BED=bed-v2 in .env.local to hear it
```

## Findings (full detail in `briefs/WP8.1-report.md`)

- 15s p50 render/playback ratio: **0.38** (target ≤0.6), identical to WP8's 10s number, across 4 sessions / 15 shots.
- Player sub-beat scheduling (the riskiest untested code in this brief) verified live in the browser: all 9 beats across a 4-shot, 9-beat 15s programme fired their narration at the correct offset inside the right clip, confirmed both by a console log added for this purpose and independently by a 0-bleed Whisper split-check on the resulting audio.
- Connector: 0 structural failures across 37 beats / 14 scenes in the 4 live-rendered 15s sessions; visually spot-checked on one frame (the pinned spine's final scene) and matched the recorded connector data exactly.
- Tag: 0 structural failures; frequency varied 1/3 to 4/4 scenes tagged across the four sessions — the translator uses it readily when it fits, not just when the exemplar happens to show one.
- Diginex pronunciation fix: worked on the one beat directly compared against WP8's earlier report (the exact same line, "Diginex" transcribed cleanly for the first time across this whole project), but only 2/6 occurrences were clean across this campaign's data — real improvement, not a solved problem, and not enough occurrences generated to test the brief's ≥8/10 target.
- Music bed v2: 144.1s, 3s crossfaded loop, generated for real; `MUSIC_BED` switch verified serving the correct file both ways; `bed.mp3` confirmed untouched.

## Untested / not verified

- **Whether a tag actually renders coin-sized**, and **whether each 5s section within a scene reads as visually distinct** rather than a static hold across the cut — the timing/audio side of "beats as timestamps" is verified for real (console log + 0-bleed split-check); the pixel side needs a contact-sheet or manual frame review this handoff didn't do. Flagged clearly in the report rather than asserted either way.
- **Diginex consistency at scale**: only 6 total occurrences across this campaign, versus the brief's ≥8/10 target — would need further renders (not necessarily more work, just more spend) to actually test the criterion.
- **The crossfaded loop point's audibility**: constructed with a standard technique (`acrossfade` blending the track's own tail into its own head) and the resulting file plays and loops without erroring, but nobody has listened to the actual seam. Worth Robin's ear before switching `MUSIC_BED` to `bed-v2` by default.
- Everything WP8's own handoff already flagged as untested (the silence-gap ElevenLabs-alignment fallback path; "no people in any clip" via frame inspection) remains equally untested here — this brief didn't touch those paths.

## A naming collision, caught and fixed

The natural next version after `translator-v0.3.1` is `v0.4` — but that literal string is already used by an earlier, never-merged WP5 schema (`events`/`labels`, a completely different, incompatible shape), and several of its cached translations are still sitting in `data/translations/` from before this repo's history. Bumping to `"translator-v0.4"` here would have made this code's version-gate treat those old, incompatible files as current and run them through the new connector/tag validation — caught during testing (`npm run check` produced a wave of spurious "no action, no connector" failures on files that were never meant to be read under this schema). Renamed to `translator-v0.3.2` instead; documented directly in `lib/translator.ts`'s version-bump comment so the next person doesn't hit the same collision reaching for "v0.4" again.

## A real bug, caught by a script crashing loudly rather than lying quietly

`scripts/render.mts`'s new `renderScene` (and, less consequentially, `renderOne`) wrote each recorded beat's `n` field missing — an object-literal oversight (`{beat, offsetSeconds, sources, warnings}` instead of `{n, beat, offsetSeconds, sources, warnings}`). TypeScript didn't catch it because `/api/record`'s POST body is `unknown` at that boundary, not typed against `lib/recorder.ts`'s `ShotMeta`. It surfaced immediately as a `ZeroDivisionError` in `scripts/saskia-split-check.py` (an empty beat map, because the script's own beat-loading logic — also written this session — keys everything by `n`) rather than silently producing a wrong or empty report. Fixed in `scripts/render.mts` for future renders; the one already-affected session's 4 JSON files were patched by hand with the already-known correct `n` values (the video, audio, and every other field were always correct — only this one label was missing) rather than re-rendering. `lib/programme.ts`'s equivalent path (the live app) never had this bug, confirmed by inspecting its recorded output directly.

## Merge notes

New files: `lib/prompt.ts#compileScenePrompt` (same file, not new), `scripts/music-bed-v2.mts`, `data/pronunciations.json`. Changed: `lib/config.ts`, `lib/translator.ts`, `lib/prompt.ts`, `lib/stream.ts`, `lib/programme.ts`, `lib/recorder.ts`, `components/screen.tsx`, `components/player.tsx`, `app/api/voice/route.ts`, `app/api/music/route.ts`, `scripts/check.mjs`, `scripts/report.mjs`, `scripts/reel.mjs`, `scripts/render.mts`, `scripts/saskia-split-check.py`. Three cached translations updated/added under `data/translations/` (5s and 10s pinned exemplars retrofitted with connector/tag; new 15s pinned exemplar). No changes to `lib/fal.ts`, `lib/frames.ts`, `lib/voice.ts` (Saskia's scene-batching from WP8 needed no change), `app/api/translate/route.ts` (already generic over `ClipSeconds`), `app/api/record/route.ts` (shape-agnostic), or the style sheet content in `lib/prompt.ts#styleSheet`.

`npx tsc --noEmit` is clean. `npm run check` on all four WP8.1 sessions plus the retrofitted WP8 pinned exemplars: 0 hard failures (one pre-existing soft warning class, headline-number derivation, same as WP0/WP2/WP8).
