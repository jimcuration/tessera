# WP8 — Report

All renders 5 September 2026, MiniMax H3 Max Turbo on fal, 480P, 16:9, `prompt_expansion_mode: balanced`, ElevenLabs `eleven_v3` Saskia, voice QMSGabqYzk8YAneQYYvR. Numbers come from `recordings/<session>/*.json` via `npm run report`, and `recordings/<session>/saskia-split-check.json` via `npm run split-check` (openai-whisper `base`, CPU — the acceptance criteria don't require `medium`, and `base` was fast enough to check every beat of every session). Five sessions, four of them `CLIP_SECONDS=10`:

| session | CLIP_SECONDS | source | how | beats |
|---|---|---|---|---|
| `20260905-151952-spine-saskia-chain-on-5s` | 5 | headless (`scripts/render.mts`) | pinned exemplar | 6 |
| `20260905-151245-spine-saskia-chain-on-10s` | 10 | headless | live translation, same question as the 5s spine | 9 |
| `20260905-151454-live-catalysts-saskia-chain-on-10s` | 10 | headless | live translation #1 ("What are the key catalysts for Diginex?") | 10 |
| `20260905-151653-live-risks-saskia-chain-on-10s` | 10 | headless | live translation #2 ("What are the key risks for Diginex?") | 10 |
| `20260905-152557-what-is-the-cash-position-and-runway-saskia-chain-on` | 10 | **in the app**, Browser tool, real question asked through the player | same question as the 10s spine (cache hit) | 9 |

The fifth session is the one that answers acceptance criterion 5: it went through `components/player.tsx` / `lib/programme.ts` end to end (ask → translate → stage → Stream → Screen), not the headless script, driven live in a browser via the Browser tool while console logs were read. All five sessions are chained (`CHAIN=on`), Saskia, `MUSIC=on`.

Reels (`recordings/reels/`): `spine-5s.mp4` (31.1s, narrated + music), `spine-10s.mp4` (91.3s, narrated + music), `live-catalysts-10s.mp4` (101.4s), `live-risks-10s.mp4` (101.4s), `spine-5s-vs-10s.mp4` (silent side-by-side, video only — see note under §6).

## 1. Render time per clip vs clip length

| session | CLIP_SECONDS | p50 ms | max ms | ratio p50 | ratio max |
|---|---|---|---|---|---|
| spine (5s) | 5 | 2458 | 2897 | 0.49 | 0.58 |
| spine (10s) | 10 | 3613 | 9142 | 0.36 | 0.91 |
| live-catalysts | 10 | 3789 | 4618 | 0.38 | 0.46 |
| live-risks | 10 | 3580 | 9042 | 0.36 | 0.90 |
| in-app spine (10s) | 10 | 3922 | 4634 | 0.39 | 0.46 |
| **all 10s (4 sessions, 38 clips)** | 10 | **3613** | 9142 | **0.38** | 0.91 |

Ratio = render ms ÷ (CLIP_SECONDS × 1000). **Acceptance criterion 2** (p50 ratio ≤ 0.6 at 10s): measured p50 ratio **0.38** across all four 10s sessions — met, on this data. (Per the brief, this report does not mark the criterion itself as passed; that is the reviewer's call.)

At 10s, the outliers are queue waits, not the model: two clips (one in the 10s spine, one in live-risks) hit 8–9s wall clock while the rest of both sessions sit at 3.1–4.6s — exactly the pattern WP0 §1 found at 5s ("the tail is queue variance, not the model: it hit one clip in most chained runs"). The 10s p50 (3613ms) is barely above the 5s p50 (2458ms) despite doubling clip length, so the fixed per-request overhead WP0 identified (prompt expansion, upload, the post-chain frame-grab) dominates more, proportionally, at 10s than at 5s — which is exactly why the ratio drops from ~0.5 to ~0.38 rather than staying flat. Real fal wall-clock, confirmed independently: rendered clip durations measured with ffmpeg were 5.18s and 10.14s for the two spine sessions' beat 1 — `duration` really is reaching fal.

## 2. Time to first frame

Approximate: `firstBeatMs` (translator time to the first streamed beat) + that beat's own `renderMs`, both already recorded fields — not a browser-measured paint time the way WP0's own numbers were (WP0 §1: "measured in the browser"). Treat these as an upper-bound estimate of the true metric, not equivalent to it.

| session | first beat ms | + first clip render ms | ≈ time to first frame |
|---|---|---|---|
| spine (5s), pinned | 2207 | 2897 | 5104 ms |
| spine (10s), live translation | 6799 | 3929 | 10728 ms |
| live-catalysts (10s), cache hit | 130 | 3130 | 3260 ms |
| live-risks (10s), live translation | 4369 | 3583 | 7952 ms |
| in-app spine (10s), cache hit | 2209 | 4056 | 6265 ms |

Cache hits (live-catalysts, in-app spine) land near WP0's quiet-queue range (4–6s). Live translations at 10s add the translator's own time (Claude Opus 5 writing 9-10 longer beats, ~22-27s to first token in these two runs — see §8-equivalent below) before the first beat streams, which is the dominant cost here, not clip length.

## 3. Words per line

| session | CLIP_SECONDS | mean words/line | limit | n |
|---|---|---|---|---|
| spine (5s) | 5 | 10.7 | 12 | 6 |
| spine (10s) | 10 | 12.2 | 22 | 9 |
| live-catalysts | 10 | 15.8 | 22 | 10 |
| live-risks | 10 | 14.0 | 22 | 10 |
| in-app spine (10s) | 10 | 12.2 | 22 | 9 |

No beat was dropped for length in any of the five sessions (`npm run check`: 0 line-length failures). The translator used roughly half its 10s budget on average (12–16 of 22 words) rather than filling it — consistent with rule 5's "one or two short sentences... write short and compress," not a sign the budget is too tight. One beat in the live-catalysts session used two sentences in one line ("Survival hinges on continued access to capital markets. The company is not yet self-sustaining.") — the two-sentence form the 10s rule explicitly allows.

## 4. Saskia split check (acceptance criterion 3)

`npm run split-check <session>` (new: `scripts/saskia-split-check.py`) runs Whisper independently on each beat's own split `<n>.mp3` and checks two things: how much of that beat's own line it actually heard, and whether a run of 2+ consecutive words unique to a *neighbouring* beat's line shows up (evidence of a bad cut).

| session | scenes (requests) | split method | mean own-line recall | beats with a neighbour's words |
|---|---|---|---|---|
| spine (5s) | 3 | timestamps (3/3) | 96.7% | **0 / 6** |
| spine (10s) | 4 | timestamps (4/4) | 98.0% | **0 / 9** |
| live-catalysts | 6 | timestamps (6/6) | 93.2% | **0 / 10** |
| live-risks | 4 | timestamps (4/4) | 96.9% | **0 / 10** |
| in-app spine (10s) | 4 | timestamps (4/4) | 97.3% | **0 / 9** |

Zero bleed across every beat in every session (44 beats total). ElevenLabs' `with-timestamps` endpoint worked on every one of the 21 scene requests across all five sessions — the character-level alignment lined up cleanly with the concatenated scene text even with `eleven_v3`'s inline `[bracket]` audio tags in it (verified directly: `voice-scene-*.json` for the first request showed the tag's own characters present in `alignment.characters`, and the cut fell exactly at the sentence boundary — a separate ad hoc 2-beat test transcribed each split file and got the expected line back with nothing from its neighbour). The silence-gap fallback path (`silenceGapMidpoints` in `scripts/ffmpeg.mjs`) was never exercised by a real failure in this campaign; it was verified independently against one scene's audio and found a midpoint (4.441s) within 40ms of the timestamps-derived cut (4.401s) for the same file, so it looks sound as a fallback, but it has not been proven under an actual `with-timestamps` failure. The recall gaps below 100% are Whisper mishearing digits/names ("Digin X" for "Diginex," "Warren" for "warrant"), not missing or wrong audio — spot-checked by ear is still worth doing, but nothing in the transcripts reads as truncation or a wrong-beat splice.

## 5. Seam count per minute

Nominal, not visually verified: external cuts = clip count − 1 (every clip boundary); internal cuts = one per clip when `CLIP_SECONDS=10` (the beat's `action` was told it may carry one at ~5s — whether it actually reads as a cut on screen, versus a continuous move, is the visual call the brief leaves to Robin).

| session | CLIP_SECONDS | clips | external | internal (nominal) | programme length | seams/min (nominal) |
|---|---|---|---|---|---|---|
| spine (5s) | 5 | 6 | 5 | 0 | 0.50 min | 10.0 |
| spine (10s) | 10 | 9 | 8 | 9 | 1.50 min | 11.3 |
| live-catalysts | 10 | 10 | 9 | 10 | 1.67 min | 11.4 |
| live-risks | 10 | 10 | 9 | 10 | 1.67 min | 11.4 |

If every internal cut actually reads as a cut, 10s programmes carry slightly *more* seams per minute than 5s (≈11.3-11.4 vs 10.0), because doubling clip length was expected to roughly halve the *external* cut rate but the internal-cut instruction adds nearly one back per clip. If the internal "cut" more often reads as a continuous move (which several `action` fields above lean toward — e.g. "the hand lifts, the strips spring back... settles level again" — a held motion, not two compositions), the true rate would sit below 5s's. This is exactly the subjective call the brief reserves for Robin (§6).

## 6. Reels

- `recordings/reels/spine-5s.mp4` — the pinned 6-beat spine at 5s, narrated, music.
- `recordings/reels/spine-10s.mp4` — the same question, translated fresh at 10s (9 beats), narrated, music.
- `recordings/reels/live-catalysts-10s.mp4`, `live-risks-10s.mp4` — the two live 10s translations, narrated, music.
- `recordings/reels/spine-5s-vs-10s.mp4` — the literal filename the brief names. This is `scripts/compare.mjs`, video only, silent, the two spine sessions' clips concatenated side by side. It is **not** the primary deliverable: the two programmes differ in both length (31s vs 91s) and narration, so a single mixed-audio file would either need to pick one side's voice or drop both, and `-shortest` in `compare.mjs` would truncate the 10s side to the 5s side's length regardless. The brief allows this explicitly ("each with its own audio; the viewer toggles, **or produce two reels**") — `spine-5s.mp4` and `spine-10s.mp4` are the pair to actually watch and compare narration pacing; `spine-5s-vs-10s.mp4` is a quick visual reference for cut rate only, truncated to 30s.

## 7. Translator adherence (observed, not part of the acceptance criteria)

Running `npm run check` on the four live/cached translations found one pre-existing translator-adherence issue, unrelated to anything WP8 changed: the live-catalysts translation (10s) has two scenes of exactly one beat (scene 2 = beat 3, scene 6 = beat 10), violating rule 4's "scenes of 2-3 beats" — the same class of soft miss WP2's report flagged for beat-count adherence ("not enforced in code"). `validateBeat` (which the translate route does enforce) has no scene-run check; only `validateProgramme` does, and it is a report-time check (`npm run check`), not a runtime gate — this was true before WP8 and stays true after it; WP8's mandate was limited to the word budget and the internal-cut instruction (brief: "Out of scope: ... translator content rules beyond the word budget and the internal-cut instruction"), so this was left alone. Every other session's scenes were clean runs of 2-3.

The internal-cut instruction (translator rule 9 at 10s) was followed in every one of the 38 beats across the four 10s sessions: every `action` field used the `[0-5s] ... [5-10s] ...` format, and reads as a coherent two-part movement in the sample above (§5) — some clearly two compositions, others one continuous move stretched across both halves, which the rule permits ("continues that same movement to a further landing... or cuts once").

## 8. Style sheet line survival, per session

Same signal set as `briefs/WP0-report.md` §6 (`STYLE_SHEET_SIGNALS`, style sheet v0.3, unchanged by WP8). Full per-clip grids are in the raw `npm run report` output; totals:

| session | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| spine (5s) | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 6/6 | 5/6 | 6/6 | 0/6 | 6/6 |
| spine (10s) | 9/9 | 9/9 | 9/9 | 9/9 | 9/9 | 9/9 | 9/9 | 6/9 | 9/9 | 0/9 | 9/9 |
| live-catalysts | 10/10 | 10/10 | 10/10 | 9/10 | 10/10 | 10/10 | 10/10 | 9/10 | 10/10 | 1/10 | 9/10 |
| live-risks | 10/10 | 10/10 | 10/10 | 9/10 | 10/10 | 10/10 | 10/10 | 8/10 | 10/10 | 0/10 | 10/10 |

Line 10 ("16:9, 5 seconds, one composition, crisp cut") barely survives at **either** clip length — 0/6 at 5s, 0-1/9-10 at 10s. This is not a WP8 regression: it is equally near-zero on the unmodified 5s baseline, so whatever changed is on fal's rewriter side since WP0 measured 7/18 for this line, not something WP8's beat-block duration override caused. That override line (`"Duration: this shot is exactly 10 seconds, not 5..."`, added to the compiled prompt — not to the numbered style sheet itself, see the note on scope below) was confirmed present in every 10s prompt and did not appear to confuse the model: no clip in any 10s session showed any sign of running short or long against its requested `duration` (`durationOf()` on rendered clips measured 10.14s where checked), and there were zero "downstream_service_error" or malformed-response failures across all 38 ten-second clips.

## Notes on scope

- **Style sheet.** WP8's brief lists the style sheet as out of scope (WP7 owns it). But the fal request `duration` genuinely changes with `CLIP_SECONDS`, and the numbered style sheet's line 10 (`lib/prompt.ts#styleSheet`) states a fixed "5 seconds" that would then contradict the actual clip. Rather than edit that function's wording (which would collide with WP7's parallel work on the same file), WP8 added one line to the *beat block* instead (`beatBlock`, same file) — `"Duration: this shot is exactly 10 seconds, not 5 (overrides the style sheet's stated length above)"` — only when `clipSeconds !== 5`, so the 5s path is byte-for-byte unchanged. This is a judgement call about a scope boundary, not something the brief settled explicitly; flagging it for review rather than presenting it as obviously correct.
- **CLAUDE.md hard rule 4** ("5-second clips") is deliberately overridden by this work package at `CLIP_SECONDS=10`, per the brief's own instruction. Default remains 5.
- **Player buffer (`lib/stream.ts`)**, normally off-limits per CLAUDE.md rule 3, was changed here because the brief explicitly asked for it (§1: "the buffer target is expressed in seconds of playback... not clip count"). `MAX_BUFFER = 3` clips became `MIN_BUFFER_SECONDS = 10` (queue-length × clip length in seconds); the in-app session (§ table, row 5) exercised this path live with zero stalls or blank frames (see acceptance criterion 5 below).

## Acceptance criteria — measured, not marked

Per the brief ("Do not mark criteria as passed"), here is what was measured against each one; the pass/fail call is the reviewer's.

1. `CLIP_SECONDS` switches 5/10 without code changes (`.env.local`, restart); fal requests carry the right duration (confirmed via `ffmpeg` on rendered clips: 5.18s and 10.14s); `npm run check` enforces 12/22 words (confirmed: 22-word cap active on all 10s sessions, 0 line-length failures, and lines up to 18 words passed that would fail a 12-word cap).
2. p50 render/playback ratio at 10s: **0.38** across 4 sessions / 38 clips (target ≤ 0.6).
3. Saskia audio generated per scene (21 requests across 5 sessions, 2-3 beats each bar two lone-beat scenes) and split per beat; independently verified with Whisper: **0 of 44 beats** showed a neighbour's words.
4. Every voice request recorded with timestamps: confirmed — `voice-scene-*.json` for every scene in every session carries `model`, `voiceId`, `settings`, full `sceneText`, per-beat `beats`, `splitMethod`, `cutTimes`, and the raw ElevenLabs `alignment` when the timestamps path was used (it was, every time, in this campaign).
5. Reels and report exist (§6 above); the 10s spine played through **in the app** (Browser tool, not the headless script) with 9/9 beats swapping at `readyState` 3 or 4 and zero blank-frame or stall warnings in the console log, ending cleanly in the "ended" phase with the auto-continue countdown showing.
6. No people in any clip: not independently re-verified by frame inspection for this report (no face gate is merged — WP5.1 is a separate worktree); the translator's people-lexicon/proper-name check (`validateBeat`) did not drop any beat in any of the four live translations, and none of the `subjects` fields inspected in this report named a person.

## Addendum — 10s exemplar pinned, pronunciation finding

Follow-up requested after the report above: pin the 10s spine exemplar (22-word lines), re-render it, and check for a pronunciation issue on the opening line.

**Pinning.** The live 10s translation from `20260905-151245-spine-saskia-chain-on-10s` (`data/translations/e4fc1b52451dd81d22f57020dd92185d0ef2f69d.json`) was already a clean, well-formed candidate — 9 beats, all ≤22 words, scenes of 2/3/2/2, bookended on violet/the coin stack, the `[0-5s]/[5-10s]` internal-cut format followed in every beat, 0 `npm run check` failures, 98.0% mean own-line Whisper recall with 0 cross-beat bleed on the earlier pass. Rather than author a second exemplar from scratch (extra Claude spend to reproduce work already validated), that file was marked `"pinned": true` — the same mechanism the 5s exemplar (`a14c3cdf...json`) already uses — and re-rendered:

```
20260905-154446-spine-pinned-saskia-chain-on-10s
```

`[render] 9 beat(s), 0 dropped, source=pinned` — confirmed the pin took. `npm run check`: 0 failures. `npm run split-check`: mean own-line recall 96.2%, 0/9 beats with a neighbour's words. Render times 3.0–4.4s per clip (ratio 0.31–0.44), no queue outliers this run. Reel: `recordings/reels/spine-10s-pinned.mp4` (91.3s). This session, not the earlier live one, is now the one to treat as the 10s spine going forward.

**The opening-line pronunciation check.** I don't have a way to listen to audio directly, so I could not confirm "accent drift" as such — nothing in the split-check transcripts reads as a different accent, and I'm not asserting that finding into this report as observed fact. What I *did* find, by comparing Whisper's transcription of every occurrence of "Diginex" across all six sessions (44 beats total, same ElevenLabs voice ID throughout, `eleven_v3`, no override — narration is never cached, so each render is a fresh TTS generation of the same text):

| session | beat | delivery text | Whisper heard |
|---|---|---|---|
| spine (5s) | 1 | "...Diginex held..." | "...**Diginex** held..." |
| spine (10s), live | 1 | "...Diginex held..." | "...**Diginex** held..." |
| spine (10s), live | 9 | "...critical for Diginex." | "...critical for **Digin X**." |
| live-catalysts | 1 | "Diginex faces a run..." | "**Digin X** faces a run..." |
| live-catalysts | 9 | "...Diginex is priced..." | "...**DigiNex** is priced..." |
| live-risks | 1 | "Diginex faces a data..." | "**Digin X** faces a data..." |
| in-app spine (10s) | 1 | "...Diginex held..." | "...**Digenx** held..." |
| in-app spine (10s) | 9 | "...critical for Diginex." | "...critical for **DigiNex**." |
| **spine (10s), pinned** | **1** | "...Diginex held..." | "...**Dijon X** held..." |
| spine (10s), pinned | 9 | "...critical for Diginex." | "...critical for **Digin X**." |

Only 2 of 10 occurrences transcribed as "Diginex" cleanly; the rest split across four different mis-hearings ("Digin X", "DigiNex", "Digenx", "Dijon X"), and it happens on both beat 1 (the `[presenting to camera]` opener) and beat 9 (the close) — not one specific line. This is consistent with an invented brand name having no canonical pronunciation anchor for the TTS model, so `eleven_v3` says it slightly differently generation to generation even on the same voice ID and text — which Whisper then hears differently. **I cannot tell from this whether the narration itself drifts or Whisper's transcription is just unstable on an out-of-vocabulary name**; distinguishing those needs an actual listen, which I can't do. Worth Robin's ear on `spine-10s-pinned.mp4` beat 1 and beat 9 specifically, and if it is the TTS: a phonetic respelling in the text sent to ElevenLabs (e.g. a `pronunciation_dictionary` locator or spelling "Diginex" phonetically) would be the fix, not a WP8-scope change.
