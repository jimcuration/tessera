# WP8.2 — Handoff

Worktree `../tessera-wp8-2`, branch `wp8-2`. Do not mark acceptance criteria as passed — see `briefs/WP8.2-report.md`'s closing section for what was measured against each one; this doc is what was built and how to run it.

**Follow-up added after the first handoff/report pass**: the first pass's own report found a clamp cascade (one 3-beat scene's narration exceeding fal's 15s ceiling delays every later beat for the rest of the programme). Asked to fix it with a scene audio budget — see "Follow-up: scene audio budget" below, and the report's matching section, for what was built and re-measured. The rest of this document is mostly unchanged from the first pass; only the sections below and the acceptance-criteria summary reflect the follow-up.

## Flag for PM: brief names "the six-beat spine"; scene mode's actual spine has 9 beats

The six-beat exemplar (`data/translations/a14c3cdf...json`) is not reachable at `CLIP_SECONDS=15` — the translate cache key includes `clipSeconds` (`app/api/translate/route.ts#cacheKey`), so a 5s-keyed pinned translation never resolves under a 15s session; there is no 15s-keyed pinned translation of that same content. The spine WP8.1 actually built and measured *at scene mode* is a separate 9-beat/4-scene pinned translation (`ecc17ec6...json`). This WP's render and report use that one, since it's the only real, already-measured fixed-boundary baseline for scene mode that exists. See `briefs/WP8.2-report.md`'s "Which spine" section for the full reasoning. Not a CLAUDE.md conflict, but worth PM's attention before the next brief references "the spine" at CLIP_SECONDS=15 — it isn't the same fixture as at 5s/10s.

## What was built

**1. Order of operations (audio before video prompt compile), CLIP_SECONDS=15 + Saskia only.**

- `lib/voice.ts`: `Narrator.prefetchScene` now returns `Promise<SceneAudioResult>` (`{splitMethod, beats: Map<n, {url, durationSeconds}>}`) instead of `void` — the caller can await it for timing data; existing fire-and-forget playback (`tracks`/`play()`) is unchanged.
- `lib/programme.ts`: `Session#flushVideoScene` is now `async`, takes the already-dequeued buffer as an argument, and (for `voice==="saskia"`) awaits `narrator.prefetchScene` before computing timing and compiling the prompt. A new `queueFlushVideoScene` dequeues the buffer synchronously (as before) and chains the actual async work onto a new `flushChain` promise, so scenes still reach `stream.addShots` in translation order even though the work in between is now async and can otherwise race. The end-of-programme flush now `await`s `flushChain` before `stream.finish()`, so the last scene can't be lost to a race with "no more shots coming." The old `sceneBuffer`/`flushScene` Saskia-only-batching path is now used only at `clipSeconds !== 15` (5s/10s); at 15s, narration generation lives inside `flushVideoScene` itself.
- `scripts/render.mts`: `renderScene` now reads per-beat `durationSeconds` from a `Map` populated by the pre-existing (already-ahead-of-render) Saskia loop, which previously fetched and discarded them.

**2-3. Section boundaries and clip duration from audio.**

- `lib/prompt.ts`: new `computeVoiceLedTiming(durations: number[])` — `{sections, requestedDuration, totalNarrationSeconds, clamped}`. Boundary *i* = cumulative narration through beat *i* + `0.4 * (boundary index)`, one decimal place; last section's end is pinned to `requestedDuration` (not the formula) since that's the clip's true length. `requestedDuration = clamp(ceil(totalNarration + 1.0), FAL_DURATION_MIN, FAL_DURATION_MAX)`.
- New exported constants `FAL_DURATION_MIN = 5`, `FAL_DURATION_MAX = 15` — **found empirically**, not documented anywhere by fal: `scripts/probe-duration.mts` (kept, not wired into any npm script) submitted real minimal-prompt clips at eight integer durations; 2/3/4 and 16-20/30 all returned HTTP 422, every integer 5-15 rendered. Run it again with `npx tsx scripts/probe-duration.mts` if this ever needs re-confirming (it costs real fal spend — under $1 for the 13 real calls made across both probe rounds in this WP).
- `compileScenePrompt` (`lib/prompt.ts`) gained optional `sections`/`clipSeconds` args; omitted, it falls back to WP8.1's exact original fixed-5s-per-beat behavior (`sceneOffsetSeconds`) — this is the fallback path used automatically whenever voice-led timing isn't available (native voice, or incomplete Saskia durations).

**4. Aspect ratio.**

- `lib/fal.ts`/`scripts/render.mts`: no change to what's actually sent (`aspect_ratio: "16:9"` was already t2v-only, correctly — **checked directly against fal's published schema**, image-to-video has no such input field at all, so this was never a bug). Both now compute and record `aspectRatioParamSent` (true/false) alongside a `requestedAspectRatio: "16:9"` constant.
- `scripts/ffmpeg.mjs`: new `dimensionsOf(file)` (pixel width/height from ffmpeg's own stderr banner, same pattern as the existing `durationOf`).
- `app/api/record/route.ts`: after downloading a clip's mp4 (already happened; unchanged), now also measures it with `durationOf`/`dimensionsOf` and merges `returnedDurationSeconds`/`returnedWidth`/`returnedHeight`/`returnedAspectRatio` into the already-written `<n>.json` — fal's response has neither field, confirmed against its schema, so this is the only place either number can come from.

**5. Recording.**

- `lib/recorder.ts`: `ShotMetaBeat` gained `sectionEndSeconds`, `audioDurationSeconds`; `ShotMeta` gained `requestedDuration` (previously not recorded *at all*, even by WP8.1 — every prior 15s recording's actual clip length had to be inferred, wrongly once it can vary by scene, from beat count — `scripts/report.mjs#shotDuration` did exactly that inference, now fixed to prefer the recorded field), `timingMethod`, `splitMethod`, `totalNarrationSeconds`, `durationClamped`; `ClipInfo` gained `requestedAspectRatio`, `aspectRatioParamSent`. `app/api/record/route.ts` needed no schema changes for any of this beyond §4's measurement addition — it already passes bodies through unvalidated.
- `lib/programme.ts`/`scripts/render.mts`'s "beat" (5s/10s) single-beat path also populates the new fields (with fixed-timing defaults: `sectionEndSeconds = clipSeconds`, `audioDurationSeconds: null`, `timingMethod: "fixed"`) so every recording, at any clip length, now has a consistent shape.

**6. Fallback.**

- If Saskia's response is missing, or any beat's `durationSeconds` is null/≤0, both `flushVideoScene` and `renderScene` log a warning and fall back to WP8.1's original fixed-5s-per-beat timing (`timingMethod: "fixed"` recorded either way, including at 15s — a change from before, where the field didn't exist to distinguish this). **Not exercised by any real render this WP made** — every scene's ElevenLabs call succeeded with usable timestamps in every session rendered.

**7. Scene audio budget (follow-up, after the first report identified the clamp cascade).**

- `lib/prompt.ts`: new `SCENE_AUDIO_BUDGET_SECONDS = 14` and `splitSceneByAudioBudget<T>(items, durations, budget?)` — generic pure function (works on `lib/programme.ts`'s `{n, beat, warnings}` items and `scripts/render.mts`'s identical shape unchanged), returns the scene's beats split into contiguous groups, each at or under budget (or a lone beat that alone exceeds it — nothing left to split). The split point minimizes the **larger group's own narration total**, not beat count, recursing into either side that's still over budget. A scene already within budget returns as its own single group — unchanged behavior for every scene that doesn't need this.
- `lib/programme.ts#flushVideoScene`: after fetching Saskia's per-beat durations (already awaited, per item 1), calls `splitSceneByAudioBudget` and loops over the resulting groups — each gets its own `computeVoiceLedTiming`, `compileScenePrompt`, `Shot`, and registered clip, with `previousHandoff` carried from the prior group's last beat exactly as it already was between any two scenes (no new chaining logic — `stream`/`lib/fal.ts` already chain any two consecutive shots). Reduces to the exact prior single-shot behavior when a scene doesn't need splitting.
- `scripts/render.mts`: the `clipSeconds === 15` dispatch loop now builds a flat `renderUnits` list (one entry per scene, or per split group when a scene needs splitting) before either the chained (sequential) or unchained (batched) render path runs — both paths already worked over "whatever's in the list," so no further change was needed there. `renderScene` itself needed only a new optional `splitInfo` param, purely for the recording (see next point) — the actual render logic already runs correctly on whatever `items` it's given, whole scene or split group alike.
- `lib/recorder.ts`: `ShotMeta` gained `sceneSplit: {scene, part, of} | null` — non-null on both parts of a split scene's clips, in play order, null otherwise.
- **Verified for real**, both code paths, on the pinned spine's actual scene 2: the split fired (`[render] scene 2: narration 18.8s exceeds budget, split into 2 chained clips (1+2 beats)` headless; `[session] scene 2: narration 18.9s exceeds budget, split into 2 chained clips (1+2 beats)` in-app), split 1 beat + 2 beats as the minimize-the-larger-group rule predicts, and **eliminated the clamp entirely** (`durationClamped: false` on every shot in both follow-up sessions, vs `true` on scene 2 in both first-pass sessions). Lag re-measured across the whole programme, both paths: headless 0.05s mean / 0.38s max, in-app -0.01s mean / 0.29s max — both now meet the brief's target (mean <0.5s, max <1.0s), 9/9 beats detected both times (the first pass's clamped scene had left one beat "not detected" each time). Full numbers in the report's "Follow-up" section. The recursion beyond one split was only exercised against synthetic inputs by hand (`splitSceneByAudioBudget(['b1','b2','b3','b4'], [4,4,4,4])` → `[['b1','b2'],['b3','b4']]`, `(['b1','b2'],[8,8])` → `[['b1'],['b2']]`) — see "Untested" below.

**New tooling** (not requested verbatim by the brief, built to answer it):

- `scripts/probe-duration.mts`: one-off, real-API probe of fal's `duration` range (see §2-3). Not wired to any npm script; run by hand.
- `scripts/ffmpeg.mjs#headlineChangeTimes(file)`: ffmpeg's own scene-change detector run against just the cropped upper-third of the frame (the style sheet's headline-chip region) — a visual-change signal, not OCR. Used by:
- `scripts/lag-report.mjs recordings/<session>`: per-beat "headline first-appearance vs actual audio start" (the latter reconstructed exactly as `scripts/reel.mjs` already places narration — the sequential `Narrator.play` queue, not the raw recorded `offsetSeconds`), plus mean/max |lag| for the session. This is what produced every lag number in `briefs/WP8.2-report.md`.
- `scripts/concat-reel.mjs a.mp4 b.mp4 out.mp4`: plain ffmpeg-concat two already-built reels (stream-copy, same codec params) — used once, to build the deliverable reel from two `scripts/reel.mjs` outputs.
- `scripts/report.mjs#shotDuration`: now reads the new `requestedDuration` field first, falling back to WP8.1's beat-count inference only for recordings made before this field existed.

## How to run it

```
CLIP_SECONDS=15, VOICE=saskia, CHAIN=on in .env.local (this worktree's copy has VOICE=saskia set explicitly — the copied main-checkout .env.local had VOICE=native)

npx tsx scripts/probe-duration.mts
  — re-probe fal's accepted duration range (real spend, ~13 calls' worth if you run every candidate in the file)

npx tsx scripts/render.mts --question "What is the cash position and runway?" --voice saskia --chain on --clip-seconds 15 --base http://localhost:PORT --suffix name
  — as WP8.1: the dev server's own CLIP_SECONDS must already be 15. The
  scene audio budget (14s) is unconditional, not a flag — any Saskia scene
  whose narration exceeds it splits automatically, headless or in-app.

node scripts/lag-report.mjs recordings/<session>
  — per-beat lag table + mean/max, for any Saskia scene-mode (15s) session

node scripts/concat-reel.mjs a.mp4 b.mp4 out.mp4
  — stitch two scripts/reel.mjs outputs back-to-back

npm run check recordings/<session>          — unaffected by this WP, still 0 failures on the new sessions
npm run report recordings/<session> [...]   — shotDuration now prefers the recorded requestedDuration
npm run split-check recordings/<session>    — unaffected; still 97.8% mean recall, 0 bleed on the new session
```

## Findings (full detail in `briefs/WP8.2-report.md`)

- fal's real accepted `duration` range for h3-max-turbo is **5-15 inclusive, any integer** — not documented anywhere, found by direct probing. This is now `FAL_DURATION_MIN`/`MAX` in `lib/prompt.ts`.
- Voice-led timing works exactly as designed and is verified against the formula by hand on all 9 beats across four independent real renders (headless + in-app, first pass and follow-up, different ElevenLabs takes every time): non-5-multiple `offsetSeconds`, correct `[start-end]s` timecodes, correct clamping when narration exceeds 15s (first pass) and correct splitting instead of clamping once the budget existed (follow-up).
- **The clamp cascades** (first pass): once one scene's real narration exceeds fal's 15s ceiling (measured twice, independently, on the same 3-beat scene 2 — 18.8s and 19.2s of real narration against a 15s cap), the strict sequential narration queue (`Narrator.play`) means every later beat in the programme runs progressively later than its picture, and nothing in the design at that point let it catch back up.
- **The scene audio budget fixes it** (follow-up): splitting that same scene into two chained clips (1 beat + 2 beats, chosen to minimize the larger group's own narration) eliminated the clamp entirely and, with it, the cascade — lag dropped from -1.18s/-1.77s mean (first pass, both code paths) to 0.05s/-0.01s mean, both now under the brief's 0.5s/1.0s targets, 9/9 beats detected both times (the clamped scene had left one beat undetectable each time in the first pass). Verified independently on both the headless script and the live browser app, with two separate ElevenLabs takes.
- Returned clip dimensions are **832×480 (ratio 1.7333), every single shot, chained or not, split or not** — a fixed, small (~2.5%) deviation from true 16:9, apparently a fal 480P characteristic rather than anything request-dependent. This is "the WP8 screen-fill issue" the brief names.
- Split integrity (Whisper) and structural validity (`npm run check`) are both unaffected by this WP's changes, including the scene split — same quality as WP8.1 on every new session.
- **Trade-off**: the budget-split programme is longer and costs more than the clamped one it replaces (5 shots instead of 4, 59s instead of 45-53s, ~$1.475 vs ~$1.125-1.325 at $0.025/s) — splitting a scene gives its narration the screen time it actually needs rather than compressing it, so a scene that used to (wrongly) fit in 15s now correctly takes ~22s. Not a regression against any acceptance criterion, but a real, visible change worth Robin/PM knowing about.

## Untested / not verified

- **The fixed-timing fallback path** (native voice already excepted; Saskia-durations-unavailable case) — implemented, never exercised by a real render this campaign (every ElevenLabs call succeeded, in both passes). Forcing it (e.g. temporarily unsetting `ELEVENLABS_API_KEY` mid-session, or a scene whose alignment doesn't line up) was not attempted.
- **A real scene that recurses into 3+ split groups** — this project's scenes run 2-3 beats (CLAUDE.md), so `splitSceneByAudioBudget`'s recursion beyond one split was only exercised against synthetic inputs (see item 7 above), not a real render.
- **"Headline first-appearance" is a visual-change heuristic** (ffmpeg scene-change detection on the cropped headline-chip region), not OCR — it was not manually cross-checked frame-by-frame against the actual on-screen text for every beat, in either pass. `npm run check` and the Whisper split-check are the independently-verified layers; the lag numbers are only as good as this one heuristic.
- **A true split-screen comparison video** was not attempted; the deliverable reel is two sessions' own reels concatenated back-to-back (see report for why).
- Everything WP8.1's own handoff already flagged as untested (tag coin-sizing by frame inspection, visual distinctness of 5s sections, "no people" by frame inspection) remains equally untested here — out of this brief's scope.

## Also touched, not requested by name

- `scripts/report.mjs#shotDuration`: fixed to read the new `requestedDuration` field (falls back correctly for pre-WP8.2 recordings, verified against the fixed-boundary session). This was a real, small, pre-existing gap (every 15s recording's duration had to be *inferred* from beat count, silently wrong the moment WP8.2's variable durations exist) rather than a WP8.2 feature per se.
- Two new translation cache files under `data/translations/` (`72e3ca9e...`, `9e24980d...`) — organic artifacts of live-app exploration during this WP's browser verification (clicking through follow-up questions at `CLIP_SECONDS=15` for the first time generates a 15s-keyed cache entry where only a 5s/10s one existed before), not hand-authored, harmless, same pattern as this repo's existing cache growth.

## Merge notes

New files: `scripts/probe-duration.mts`, `scripts/lag-report.mjs`, `scripts/concat-reel.mjs`. Changed: `lib/prompt.ts`, `lib/voice.ts`, `lib/programme.ts`, `lib/recorder.ts`, `lib/fal.ts`, `scripts/render.mts`, `scripts/ffmpeg.mjs`, `app/api/record/route.ts`, `scripts/report.mjs`. No changes to `components/screen.tsx`, `components/player.tsx`, `lib/stream.ts`, `lib/translator.ts`, `app/api/voice/route.ts`, `app/api/translate/route.ts`, `scripts/check.mjs`, `scripts/reel.mjs` — all already generic enough over variable per-beat `offsetSeconds`/durations to need no change (checked, not assumed, for each).

`npx tsc --noEmit` is clean. `npm run check` on both new sessions: 0 hard failures.
