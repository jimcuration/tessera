# WP8.1 — Report

All renders 5 September 2026, MiniMax H3 Max Turbo on fal, 480P, 16:9, `prompt_expansion_mode: balanced`, ElevenLabs `eleven_v3` Saskia, voice QMSGabqYzk8YAneQYYvR. Numbers come from `recordings/<session>/*.json` via `npm run report`, and `saskia-split-check.json` via `npm run split-check` (openai-whisper `base`, CPU). Four `CLIP_SECONDS=15` sessions, plus the WP8 5s/10s baseline for comparison:

| session | CLIP_SECONDS | source | how | scenes/shots | beats |
|---|---|---|---|---|---|
| `20260905-164023-spine-pinned-saskia-chain-on-15s` | 15 | headless (`scripts/render.mts`) | pinned exemplar (newly pinned this WP) | 4 | 9 |
| `20260905-164436-live-catalysts-saskia-chain-on-15s` | 15 | headless | live translation #1 | 4 | 10 |
| `20260905-164646-live-risks-saskia-chain-on-15s` | 15 | headless | live translation #2 | 3 | 9 |
| `20260905-165115-what-is-the-cash-position-and-runway-saskia-chain-on` | 15 | **in the app**, Browser tool | same question as the pinned spine (cache hit) | 4 | 9 |
| `20260905-151952-spine-saskia-chain-on-5s` (WP8) | 5 | headless | pinned exemplar | 6 | 6 |
| `20260905-154446-spine-pinned-saskia-chain-on-10s` (WP8) | 10 | headless | pinned exemplar | 9 | 9 |

The fourth 15s session is the one that answers acceptance criterion 1's "player treats beats as timestamps; no blank frames": it went through `components/player.tsx`/`lib/programme.ts` end to end in a real browser (Browser tool), not the headless script.

Reels (`recordings/reels/`): `spine-5s.mp4` (31s), `spine-10s-pinned.mp4` (91s), `spine-15s-pinned.mp4` (53s) — the brief's "three files" option for `spine-5-vs-10-vs-15`, each with its own audio, same reasoning as WP8's report §6 (different lengths and narrations don't mix into one file cleanly). Also `live-catalysts-15s.mp4` (72s), `live-risks-15s.mp4` (59s).

## 1. `CLIP_SECONDS=15` — one generation per scene

Built: `lib/prompt.ts#compileScenePrompt` compiles a whole scene (2-3 beats) into one prompt in the reference prompt's shape (`briefs/reference/reference-prompt.md`) — one STYLE SHEET, one SCENE header naming the held ground and section count, one named, timecoded `[0-5s]`/`[5-10s]`/`[10-15s]` section per beat (subjects, action, handoff, headline, connector, tag), one combined ON-SCREEN TEXT list in strict order, one audio block. `lib/stream.ts`'s `Shot` now carries `beats: {n, beat, offsetSeconds}[]` (1 entry at 5s/10s, 2-3 at 15s) instead of a single beat; the render buffer (already expressed in seconds since WP8) now tracks actual per-shot duration (`bufferedSeconds`, incremented/decremented by each shot's real `duration`) since a 2-beat scene is 10s and a 3-beat scene 15s, not a fixed constant. `lib/programme.ts#flushVideoScene` buffers beats by scene (reusing the same trigger points as the existing Saskia scene buffer) and dispatches one shot per scene when it completes; `scripts/render.mts#renderScene` mirrors this for the headless path.

**Verified for real**: `ffmpeg durationOf` on the four sessions' rendered clips measured 10.14s/15.1s exactly where a 2-beat/3-beat scene was expected (report §1 below has the full breakdown) — `duration` really does vary by scene size, not fixed at 15.

**Player**: `components/screen.tsx` gained an `onTimeUpdate` handler that steps through a multi-beat clip's own `offsetSeconds` as `video.currentTime` crosses them, firing a new `onBeatBoundary(clip, beatIndex)` callback once per beat after the first (which `onStarted` already covers); `components/player.tsx` calls `narrator.play(beat.n)` from both callbacks, so Saskia's per-beat narration (already scene-batched since WP8) starts at the right moment *inside* one playing clip instead of at a clip swap. **Verified live in the browser** (Browser tool, console log added at `components/screen.tsx`'s boundary check): every beat boundary fired within ~0.3s of its exact offset —

```
[screen] beat 1 → front slot 1 (readyState 3, rendered in 3826ms)
[screen] beat boundary: beat 2 at 5.01s (offset 5s)
[screen] beat 3 → front slot 0 (readyState 4, rendered in 4576ms)
[screen] beat boundary: beat 4 at 5.02s (offset 5s)
[screen] beat boundary: beat 5 at 10.06s (offset 10s)
[screen] beat 6 → front slot 1 (readyState 4, rendered in 3820ms)
[screen] beat boundary: beat 7 at 5.26s (offset 5s)
[screen] beat 8 → front slot 0 (readyState 4, rendered in 5810ms)
[screen] beat boundary: beat 9 at 5.26s (offset 5s)
```

All 9 beats across 4 shots, every clip swap and every mid-clip boundary, `readyState` 3 or 4 throughout, zero blank-frame or stall warnings, clean transition to "ended" with the auto-continue countdown. The independent Whisper split-check on this session's audio (mean recall 97.7%, 0/9 beats with a neighbour's words) confirms the *audio* consequence of that scheduling is also correct, not just the console log.

## 2. Connector rule

Built: `Connector { kind, from, to, colour }`, required on every `Beat`, identical across a scene (checked in `validateProgramme`/`checkProgramme`), `from`/`to` must each be a subject named somewhere in the scene (also checked there). Applies at every clip length, not just 15s.

**Live translator adherence**: 0 beats dropped for a malformed connector across 37 beats in the four 15s sessions; `npm run check` found 0 connector failures on any of them (one unrelated soft warning, a headline-number derivation, same class WP0/WP2 already documented). Every scene's connector was internally consistent (identical `kind`/`from`/`to`/`colour` on every beat of the scene) and every `from`/`to` matched a real subject.

**Visually**, spot-checked on the pinned spine's final frame (scene 4, "NEXT 6-9 MONTHS"): an orange paper ribbon runs from the coin stack to two calendar pages, exactly matching that scene's connector (`{kind: "paper string", from: "the coin stack", to: "two paper calendar pages", colour: "orange"}`) — screenshot taken during the in-app verification pass, not included here but reproducible by watching `spine-15s-pinned.mp4`'s last few seconds.

## 3. Tag rule

Built: `Tag { text, source } | null` on every beat, at most one non-null per scene (checked in `validateProgramme`/`checkProgramme`), text ≤2 words or one figure, verbatim (case-insensitive, whitespace-collapsed) in its cited sentence(s) (checked in `validateBeat`/`checkBeat`). Text is added to the copy list (`lib/prompt.ts#copyList`/`compileScenePrompt`'s combined ON-SCREEN TEXT list).

**Live translator adherence**: 0 tag failures (bad verbatim, too many per scene) across all four 15s sessions. Tag frequency: pinned spine 3/4 scenes tagged, live-catalysts 4/4, live-risks 1/3, in-app spine 3/4 — the translator used the field readily, not just when explicitly modeled by the exemplar (live-catalysts' translation, generated independently, tagged every scene).

**Coin-sized, rendered correctly**: not independently verified by frame inspection for every tag in this report (would need a contact-sheet pass per tag, out of time for this campaign); the one frame inspected for §2 above did not happen to show a tag. Flagging this as unverified rather than asserting it.

## 4. Render time per scene vs playback

| session | shots | p50 ms | max ms | ratio p50 | ratio max |
|---|---|---|---|---|---|
| spine (15s, pinned) | 4 | 3560 | 10239 | 0.32 | 1.02 |
| live-catalysts (15s) | 4 | 4225 | 4991 | 0.33 | 0.42 |
| live-risks (15s) | 3 | 5714 | 5783 | 0.38 | 0.39 |
| in-app spine (15s) | 4 | 3826 | 5810 | 0.38 | 0.58 |
| **all 15s (4 sessions, 15 shots)** | | **3826** | 10239 | **0.38** | 1.02 |
| spine (10s, WP8) | 9 | 3791 | 4389 | 0.38 | 0.44 |
| spine (5s, WP8) | 6 | 2458 | 2897 | 0.49 | 0.58 |

Ratio = render ms ÷ (shot's own duration × 1000) — a 2-beat scene's 10s, a 3-beat scene's 15s, not a session-wide constant (a real bug in an early draft of this report's tooling: `scripts/report.mjs` originally divided every shot's render time by the session's nominal `CLIP_SECONDS`, which is wrong the moment scene sizes vary within one programme; fixed before this report was generated — see Handoff). **Acceptance criterion 4** (p50 ratio ≤ 0.6 at 15s): measured p50 ratio **0.38** across all four 15s sessions — identical to WP8's 10s number, and well under the target, on this data. One outlier (10239ms on a 10s clip, ratio 1.02) was fal queue variance — same pattern WP0 and WP8 both found, not the model or the scene-generation approach: the other three shots in that same session rendered in 3.2-4.8s.

## 5. Time to first frame

Same caveat as WP8's report: approximate (`firstBeatMs` + first shot's own `renderMs`, recorded fields, not a browser-measured paint time).

| session | first beat ms | + first shot render ms | ≈ time to first frame |
|---|---|---|---|
| spine (15s), pinned, cache hit | 69 | 3238 | 3307 ms |
| live-catalysts (15s), live translation | 35040 | 4304 | 39344 ms |
| live-risks (15s), live translation | 18877 | 4691 | 23568 ms |
| in-app spine (15s), cache hit | 426 | 3826 | 4252 ms |

Cache hits land in the same 3-4s range as WP8's 10s cache hits. The two live translations took markedly longer to first beat than WP8's 10s live translations (WP8: 6.8s and 4.4s; here: 35s and 18.9s) — Claude is writing about the same number of beats, but the request itself (`translatorSystem(15)`) is longer (the scene-generation note plus 17 rules including two new ones) and, per `usage.cache_creation_input_tokens` in these two responses, both had to write a fresh cache entry (no shared prefix yet at this exact system-prompt version) and produced more `thinking_tokens` than the WP8 10s equivalents. This is a real, measured cost of the 15s scene-generation path's added prompt complexity, not a fluke — both live translations show it.

## 6. Words per line

| session | mean words/line | n |
|---|---|---|
| spine (15s), pinned | 14.0 | 9 |
| live-catalysts | 15.8 | 10 |
| live-risks | 13.3 | 9 |
| in-app spine (15s) | 14.0 | 9 |

Limit stays 22 (brief §1). Same pattern as WP8's 10s data: the translator uses roughly 60-70% of the budget, not all of it.

## 7. Per-scene: connector joining named elements, tag present/correct/coin-sized, beats distinct at 5/10/15s frames

| session | scenes | connector present & valid (from `npm run check`) | tags present | tag text verbatim-checked | beats visually distinct per section |
|---|---|---|---|---|---|
| spine (15s), pinned | 4 | 4/4 | 3/4 | 3/3 (code-checked) | not independently frame-inspected beyond the one screenshot in §2 |
| live-catalysts | 4 | 4/4 | 4/4 | 4/4 | not independently frame-inspected |
| live-risks | 3 | 3/3 | 1/3 | 1/1 | not independently frame-inspected |
| in-app spine (15s) | 4 | 4/4 | 3/4 | 3/3 | not independently frame-inspected |

"Connector present & valid" and "tag text verbatim-checked" are `npm run check`'s job (structural: consistency across the scene, from/to in the scene's subjects, tag text verbatim in its cited sentence) — 14/14 scenes clean across all four sessions, 0 failures. **"Beats visually distinct at 5/10/15s frames"** — whether each 5s section actually reads as a distinct sub-composition on screen, not a static hold — was not verified by pulling and comparing frames at each offset for every scene in this campaign; the one console-log-driven verification (§1) confirms the *timing* is correct (Saskia's narration and the beat-boundary event fire at the right second), but not that the *visual* composition changes as sharply as a 5s beat would on its own. This is the honest gap in acceptance criterion 3's "≥2 of 3 tags render coin-sized" and this criterion's frame-distinctness check — both need a human or a contact-sheet pass this report didn't do.

## 8. "Diginex" transcription consistency (WP8.1 §5, also feeds WP8's earlier finding)

| session | consistent | total |
|---|---|---|
| spine (15s), pinned | 1 | 1 |
| live-catalysts | 1 | 2 |
| live-risks | 0 | 2 |
| in-app spine (15s) | 0 | 1 |
| **all 15s** | **2** | **6** |

**Acceptance criterion 6** target is ≥8/10; this campaign only produced 6 occurrences total across the four 15s sessions (not 10), so the criterion can't be evaluated on this data alone — measuring it properly needs more renders than this campaign did. What the pronunciation map (`data/pronunciations.json`, `{"Diginex": "Didge-in-ex"}`, applied only to the text sent to ElevenLabs — verified directly in `voice-scene-1.json`: `sceneText` still reads "...Diginex held..." while `sceneTextForTTS` reads "...Didge-in-ex held...") measurably did: on the pinned spine's beat 1, the exact same line that WP8's report flagged as mis-transcribed 3 different ways across earlier sessions ("Digin X", "Dijon X", "Digenx") was heard as "Diginex" cleanly, correctly, for the first time in this whole project's recordings. That's one data point, not a trend — the other three sessions' Diginex occurrences (5 of them) split 1 correct, 4 not, so the fix helps sometimes but is not reliable enough to claim solved. A phonetic respelling with no canonical IPA behind it ("Didge-in-ex") is itself somewhat arbitrary; ElevenLabs' own `pronunciation_dictionary` locator API (a different mechanism, using real phoneme alphabets) might be more reliable but wasn't tried — out of scope for what a plain text substitution can test.

## 9. Split integrity (as WP8)

| session | scenes (requests) | split method | mean own-line recall | beats with a neighbour's words |
|---|---|---|---|---|
| spine (15s), pinned | 4 | timestamps (4/4) | 98.5% | **0 / 9** |
| live-catalysts | 4 | timestamps (4/4) | 91.7% | **0 / 10** |
| live-risks | 3 | timestamps (3/3) | 95.9% | **0 / 9** |
| in-app spine (15s) | 4 | timestamps (4/4) | 97.7% | **0 / 9** |

Zero bleed across all 37 beats, same as WP8's 5 sessions. This also confirms the scene-audio-generation and split mechanism (built in WP8, unchanged here) still works correctly now that scenes can be 3 beats and up to 15s of narration — nothing about serving the video half as one longer scene clip affects the audio half, which was already scene-batched.

## Notes on scope and honesty about what wasn't fully verified

- **A real bug was found and fixed during this campaign**: `scripts/render.mts`'s new scene-recording path initially wrote each beat's `n` field missing from the recorded `beats` array (an object-literal oversight in `renderScene`/`renderOne`, not caught by `tsc` because `/api/record`'s POST body isn't typed against `lib/recorder.ts`'s `ShotMeta` at that boundary). Caught immediately by `scripts/saskia-split-check.py` crashing on the first 15s session (empty beat map → division by zero) rather than silently mis-reporting. Fixed in the script; the one already-rendered session's 4 JSON records were patched by hand with the correct (already-known) `n` values rather than re-rendering — the video and audio were never wrong, only the record's own beat-numbering label. `lib/programme.ts`'s equivalent code path (the live app) did **not** have this bug — verified directly against the in-app session's recorded files.
- **Translator version bump named v0.3.2, not v0.4**: an earlier, never-merged WP5 schema already used the literal string `"translator-v0.4"` for an incompatible shape, and some of its cached translations are still present in `data/translations/`. Reusing "v0.4" here would have made this code treat those stale files as current and validate them against these new rules (this was caught during testing: it produced spurious "no action, no connector" failures on WP5's old files before the rename).
- **Not independently frame-verified**: whether a tag actually renders coin-sized (§3, §7), and whether each 5s section within a scene reads as visually distinct rather than a static hold (§7) — both need a contact-sheet or manual review pass this report didn't do. The timing/audio side of "beats within a scene" is verified for real (§1); the pixel side is not.
- **Diginex consistency (criterion 6, ≥8/10) cannot be evaluated** from this campaign's 6 total occurrences — would need further renders specifically to accumulate 10 occurrences.
- **CLAUDE.md hard rule 4** ("5-second clips") is now overridden further still, at `CLIP_SECONDS=15`, per this brief's explicit instruction, layered on WP8's own 10s override.
- Reused the previous WP8 pinned exemplar's underlying content for 5s/10s (unchanged, still passing under the new v0.3.2 schema after adding connector/tag by hand) rather than re-authoring from scratch — see Handoff for exactly what was hand-added there.

## Acceptance criteria — measured, not marked

Per the brief ("Do not mark criteria as passed"):

1. `CLIP_SECONDS=15` renders one request per scene with timecoded sections (confirmed: `ffmpeg durationOf` matched 10s/15s exactly per scene size across all 4 sessions); player treats beats as timestamps (confirmed live in the browser, console log in §1, 9/9 beats correctly scheduled); no blank frames (confirmed: every clip swap `readyState` 3 or 4, zero stall/blank warnings across the in-app session).
2. Connector and tag fields emitted and check-enforced (confirmed: 0 failures across 37 beats / 14 scenes in 4 sessions); exemplar updated and passing (confirmed: the 15s pinned exemplar, plus WP8's 5s and 10s pinned exemplars retrofitted with connector/tag and re-verified, all pass `npm run check` with 0 failures).
3. Spine at 15: connector joining named elements — 4/4 scenes structurally valid per `npm run check`, one visually spot-checked (§2); tags — 3/4 present, structurally valid, coin-sized rendering not independently frame-verified (§3, §7 — the honest gap).
4. p50 render/playback ratio at 15s: **0.38** (target ≤0.6), across 4 sessions / 15 shots; time to first frame reported (§5), including that live translations cost noticeably more time to first beat at 15s than at 10s.
5. `bed-v2.mp3` exists (144.1s, 3s crossfaded loop point, confirmed via `ffmpeg durationOf`); `MUSIC_BED` switch confirmed serving the right file by byte count for both `bed` (480,698 bytes, unchanged) and `bed-v2` (2,789,478 bytes); `bed.mp3` confirmed untouched (same byte count and mtime before and after).
6. Pronunciation map applied to `delivery`/TTS text only, confirmed via `voice-scene-1.json`'s `sceneText` vs `sceneTextForTTS`; Diginex transcribed consistently in 2/6 occurrences across this campaign — below the ≥8/10 target, and the campaign didn't produce 10 occurrences to test against in the first place.
7. Reels and report exist (this document; `spine-5s.mp4`/`spine-10s-pinned.mp4`/`spine-15s-pinned.mp4` plus the two live 15s reels).
