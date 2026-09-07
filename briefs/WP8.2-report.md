# WP8.2 — Report

Per the brief ("Do not mark criteria as passed"): this is what was measured, not a pass/fail declaration. All renders 7 September 2026, MiniMax H3 Max Turbo on fal, 480P (returned 832×480), ElevenLabs `eleven_v3` Saskia, `CLIP_SECONDS=15`, `CHAIN=on`. First pass: two sessions plus one live-app re-run without a scene audio budget. Follow-up pass (after the first pass found a clamp cascade — see below): a scene audio budget was added, and the spine was re-rendered headless and in-app.

| session | how | shots | beats | scene audio budget |
|---|---|---|---|---|
| `20260905-164023-spine-pinned-saskia-chain-on-15s` | WP8.1's own headless render — **the fixed-boundary baseline**, reused unmodified rather than re-rendered (see "Which spine" below) | 4 | 9 | n/a (WP8.1 code) |
| `20260907-091959-spine-pinned-voiceled-saskia-chain-on-15s` | headless (`scripts/render.mts`), voice-led, first pass | 4 | 9 | none |
| `20260907-092455-what-is-the-cash-position-and-runway-saskia-chain-on` | **in the app**, Browser tool, voice-led, first pass, independent Saskia takes | 4 | 9 | none |
| `20260907-101341-spine-pinned-voiceled-budget-saskia-chain-on-15s` | headless, voice-led, **follow-up with the scene audio budget** | 5 | 9 | 14s |
| `20260907-101707-what-is-the-cash-position-and-runway-saskia-chain-on` | **in the app**, Browser tool, voice-led, **follow-up with the scene audio budget**, independent Saskia takes | 5 | 9 | 14s |

Reel: `recordings/reels/spine-scene-fixed-vs-voiceled.mp4` (115s: the fixed baseline's own reel, `--narration`, immediately followed by the follow-up (budget-split) voice-led session's, same way — not the first-pass, pre-budget session). Not a split-screen — see "Render and compare" below for why.

## Follow-up: scene audio budget

The first pass's own "Render and compare" section (below, kept for the record) found that scene 2 of the pinned spine needs 18.8-19.2s of real narration — over `CLIP_SECONDS=15`'s ceiling — and that once one scene's narration doesn't fit, the resulting delay cascades through every later beat for the rest of the programme via `Narrator.play`'s strict FIFO queue. Asked to fix this: **`lib/prompt.ts#splitSceneByAudioBudget(items, durations, budget = SCENE_AUDIO_BUDGET_SECONDS)`** (new, `SCENE_AUDIO_BUDGET_SECONDS = 14`) — after Saskia's per-beat durations are known for a scene, if their sum exceeds 14s, the scene is split at a beat boundary into two (recursing further if a resulting half is itself still over budget) contiguous groups, each rendered as its own chained clip via the existing i2v continuity path — no new chaining mechanism needed, `stream`/`lib/fal.ts` already chain any two consecutive shots from the previous one's last frame. 14s (not 15) leaves enough headroom that `ceil(14 + 1.0s air) = 15`, so a split group should never itself need clamping.

The split point is chosen to **minimize the larger group's own narration total**, not just split evenly by beat count — for scene 2 (durations 7.3s, 5.9s, 5.6s), that means `[beat 3]` alone (7.3s) + `[beat 4, beat 5]` together (11.5s), not `[3,4]`+`[5]` (which would leave a 13.2s group). Verified against the actual formula with unit inputs before re-rendering (`node --input-type … splitSceneByAudioBudget` by hand): the 3-beat scene splits 1+2 as predicted; a 2-beat scene already under budget is returned unchanged; a single beat that alone exceeds budget is returned as-is (nothing left to split); two beats both individually long enough to blow the budget split 1+1.

`lib/programme.ts#flushVideoScene` and `scripts/render.mts`'s scene-dispatch loop both now compute the split (when `voice==="saskia"` and durations are all known) *before* building any shot, then loop over the resulting groups exactly as they previously handled one whole scene — each group gets its own `computeVoiceLedTiming` call, its own `compileScenePrompt` call (continuity/`previousHandoff` carried from the prior group's last beat, same as between any two scenes), and its own registered shot. A new `ShotMeta.sceneSplit: {scene, part, of} | null` records which shots are chained parts of one split scene, for anyone reading the recording later.

**Re-rendered the pinned spine and re-measured lag across the whole programme, both code paths**:

| session | mean lag | max \|lag\| | beats measured | requested durations | any clamped? |
|---|---|---|---|---|---|
| fixed (WP8.1 baseline) | -3.08s | 6.71s | 9/9 | 10,10,10,15 | n/a |
| voice-led, no budget (first pass, headless) | -1.18s | 4.37s | 8/9 | 11,15,14,13 | scene 2: yes |
| voice-led, no budget (first pass, in-app) | -1.77s | 4.48s | 8/9 | 10,15,13,13 | scene 2: yes |
| **voice-led, 14s budget (headless)** | **0.05s** | **0.38s** | **9/9** | 11,**9+13**,13,13 | **no** |
| **voice-led, 14s budget (in-app)** | **-0.01s** | **0.29s** | **9/9** | 10,**9+13**,13,13 | **no** |

Console confirmation, both real runs, independently: `[render] scene 2: narration 18.8s exceeds budget, split into 2 chained clips (1+2 beats)` (headless) and `[session] scene 2: narration 18.9s exceeds budget, split into 2 chained clips (1+2 beats)` (in-app, same log line from `lib/programme.ts`) — the split fired on the exact scene the first pass identified, both times, with two independent ElevenLabs takes producing near-identical (18.8s/18.9s) totals. `npm run check`: 0 hard failures on both new sessions. Split integrity (Whisper, headless follow-up session): mean own-line recall 97.7%, 0/9 beats with a neighbour's words — unaffected by the split, as expected (Saskia's own audio generation is still one request per *translator* scene; only the video is now sometimes two clips).

**Both criterion-2 numbers now meet the brief's target** (mean <0.5s, max <1.0s) on the full 9-beat programme, not just the pre-clamp beats — see the "measured, not marked" section for the precise wording. **Cost of the fix**: the programme is now 5 shots instead of 4, and runs longer in total (59s headless / ~59s in-app, vs 45s fixed and 53s first-pass voice-led) — splitting a scene doesn't compress its narration, it gives it the screen time it actually needs, so a scene that was cramming 18.8s of speech into 15s of picture now correctly takes ~22s (9s + 13s) instead. Not a regression against any acceptance criterion, but a real, visible change to programme length and cost ($1.475 vs $1.125 fixed / $1.325 first-pass voice-led, at $0.025/s) worth Robin/PM knowing about.

## Which spine

The brief's acceptance criterion 2 says "the six-beat spine." The six-beat exemplar (`data/translations/a14c3cdf...json`, `pinned`, 3 scenes × 2 beats, used at 5s/10s since WP0) is **not** the translation `CLIP_SECONDS=15` resolves to a cache hit on — the translate cache key includes `clipSeconds` (`app/api/translate/route.ts#cacheKey`), and no 15s-keyed cache entry exists for that same answer text. The spine WP8.1 actually built and measured *at scene mode* is a different, separately-pinned 9-beat/4-scene translation (`ecc17ec6...json`, "WP8.1's 15s spine (D33)"), used in WP8.1's own report as "spine (15s), pinned." This WP's "voice-led" render uses that same 15s spine, for two reasons: it is the one comparable, already-measured fixed-boundary baseline that exists for CLIP_SECONDS=15 (so "same beats" from the brief's own Render-and-compare instruction is possible without a second throwaway render), and re-deriving a 15s-specific pinned translation of the six-beat exemplar's *content* was not requested by this brief and would not be the same beats WP8.1 measured against. Flagging this as a brief/asset mismatch rather than silently substituting one spine for the other.

## 1. Order of operations

Built: `lib/programme.ts#flushVideoScene` is now `async` — for `voice==="saskia"` it calls (and awaits) `Narrator.prefetchScene` for the scene's beats before compiling the prompt, extracts each beat's own `durationSeconds` from the response, computes section timing from those durations, and only then calls `compileScenePrompt` and dispatches the shot. Native voice is unchanged (no separate audio track to time against).

Because `flushVideoScene` is async, scene *N+1*'s buffer can finish and its own Saskia request can resolve before scene *N*'s does — undesirable, since `stream.addShots` must receive shots in translation order for the player to show them in order. A new `flushChain` (a promise chain) serializes only the flush functions themselves (audio fetch → compute → compile → dispatch); the actual video renders still proceed independently and in parallel via `stream`'s own buffer, so this costs cross-scene *narration-fetch* latency, not render throughput. `scripts/render.mts#renderScene` mirrors the same restructuring for the headless path (its own pre-existing Saskia loop already ran ahead of video renders; it previously discarded the per-beat `durationSeconds` it fetched — now kept in a map and passed through).

**Verified for real**, both paths: the headless render's `[render] scene N ... done in ...ms (voice-led)` log line and the live-app session's recorded JSON both show non-5-multiple `offsetSeconds` (`5.7`, `7.7`, `14`, `7.6`, `5.3`, ...) and per-shot `requestedDuration` values of 11/15/14/13 (not 10/15/10/10) — voice-led timing is genuinely driving both code paths, not just the one this WP happened to touch first.

**Cost measured**: time-to-first-frame (approx., `firstBeatMs + first clip's renderMs`, `npm run report`) was 3307ms on WP8.1's fixed-boundary session vs 6523ms on this WP's voice-led headless session — the first scene's Saskia round-trip (awaited before the first shot can even compile) adds real latency before the programme starts. Not in this brief's acceptance criteria, but a genuine trade-off worth Robin/PM knowing about.

## 2-3. Section boundaries and clip duration from audio

Built, `lib/prompt.ts#computeVoiceLedTiming(durations: number[])`: cumulative narration end time per beat plus a lead that grows by 0.4s per boundary crossed (beat *i*'s section ends at `sum(d1..di) + 0.4*i`, one decimal place, `Math.round(x*10)/10`); beat 1 starts at 0 always. The clip's requested duration is `Math.ceil(totalNarration + 1.0)`, clamped to `FAL_DURATION_MIN`/`MAX` (5/15 — see next section); the **last** section's end is pinned to that requested duration exactly (not the boundary formula), since that is the clip's true length and the two can differ once clamping applies. `[start-end]s SECTION N` in the compiled prompt now prints one decimal place (`[0.0-5.7s]`, not `[0-5s]`).

**Verified for real**, scene 1 of the voice-led headless session (durations 5.33s, 4.36s, `splitMethod: "timestamps"`): computed sections `[0, 5.7]` and `[5.7, 11]`, `requestedDuration: 11`, `totalNarrationSeconds: 9.69` — `5.33 + 0.4 = 5.73 → round to 5.7` ✓, last section end = requested duration (11) ✓. Checked by hand against all 9 beats across both new sessions (headless + in-app); every value matches the formula exactly (full numbers in "Render and compare" below).

`lib/programme.ts`/`scripts/render.mts` both fall back to WP8.1's fixed 5s-per-beat timing (`timingMethod: "fixed"` in the recording) whenever `voice !== "saskia"`, or Saskia's durations come back incomplete (any beat's `durationSeconds` null or ≤0) — not exercised in this WP's renders (every scene's ElevenLabs call succeeded with usable timestamps both times), so this specific fallback path is implemented but **not verified against a real failure**, only read from the code.

## fal's actual accepted `duration` range — found empirically

The published API schema (`minimax/h3-max-turbo/{text,image}-to-video`) states only `duration: integer, default 5` — no min, max or step documented. `scripts/probe-duration.mts` (kept in the repo; not part of any npm script) submitted real, minimal-prompt clips at eight integer durations directly against the live API:

| duration | result |
|---|---|
| 2, 3, 4 | HTTP 422 Unprocessable Entity |
| 6, 11, 13, 15 | accepted; rendered at ≈ requested length |
| 16, 17, 18, 19, 20, 30 | HTTP 422 Unprocessable Entity |

**5-15 inclusive, any integer** (not an enum restricted to {5,10,15} — 6, 11 and 13 all rendered). `FAL_DURATION_MIN`/`MAX` in `lib/prompt.ts` are set to 5/15 accordingly. The actual returned length slightly exceeds the requested one, inconsistently (not a fixed pad): requested 6 → 6.59s, 11 → 11.55s, 13 → 13.70s, 15 → 15.10s. This matches CLAUDE.md's own historical 5/10/15 choices almost exactly — 15 turns out to be the real ceiling, not an arbitrary number Robin picked.

This resolves the brief's "if only fixed durations are accepted, choose the smallest that fits and pad the final section" contingency: fal accepts any integer in range, so no padding-to-a-fixed-value logic was needed — clamping to `[5, 15]` is enough. It does **not** resolve what happens when the audio-derived request needs *more* than 15s (see "Render and compare" — this happened for real, twice, independently).

## 4. Aspect ratio

`lib/fal.ts`/`scripts/render.mts` already sent `aspect_ratio: "16:9"` on every text-to-video (unchained) request; checked directly against fal's published schema, **image-to-video has no `aspect_ratio` input field at all** (not a bug to fix — the field doesn't exist on that endpoint), so a chained shot cannot ask for one. Recorded now (`ClipInfo.aspectRatioParamSent`) rather than silently assumed.

fal's response carries **no field for the actual rendered duration or aspect ratio either** (checked directly against the schema) — `app/api/record/route.ts`'s clip handler now measures the downloaded mp4 itself (`scripts/ffmpeg.mjs#dimensionsOf`, new) and merges `returnedDurationSeconds`/`returnedWidth`/`returnedHeight`/`returnedAspectRatio` into the recorded JSON.

**Measured for real**, all 8 shots across both new sessions (4 t2v-or-i2v shots × 2 sessions): every one returned **832×480**, ratio **1.7333** — every single time, chained and unchained alike, regardless of the requested 16:9 (1.7778) or the absent `aspect_ratio` field on i2v. This is "the WP8 screen-fill issue" the brief names: the model's actual output is consistently ~2.5% narrower than true 16:9, not because chaining drops the ratio (it doesn't — i2v inherits the same 832×480 as t2v) but because **fal's 480P preset itself is not 16:9** at that resolution. Deviation is small and, notably, identical across every shot measured — a fixed model characteristic, not something request-dependent, and not something this WP's changes affect either way.

## 5. Recording

Added (all client-side — `app/api/record/route.ts` passes bodies through unchanged, so no server-route schema work was needed beyond the aspect-ratio measurement above): `ShotMetaBeat.sectionEndSeconds`, `ShotMetaBeat.audioDurationSeconds`; `ShotMeta.requestedDuration` (previously **not recorded at all**, even in WP8.1 — a real pre-existing gap, since a shot's actual requested duration had to be inferred, wrongly once durations could vary per beat, from beat count), `.timingMethod`, `.splitMethod`, `.totalNarrationSeconds`, `.durationClamped`; `ClipInfo.requestedAspectRatio`, `.aspectRatioParamSent`, plus the response-measured `returnedDurationSeconds`/`returnedWidth`/`returnedHeight`/`returnedAspectRatio` from §4. `scripts/report.mjs#shotDuration` now reads the recorded `requestedDuration` first, falling back to WP8.1's beat-count inference only for recordings that predate this field (verified: the fixed-boundary session, which has no such field, still reports correctly via the fallback; the two new sessions report their real, varying per-shot durations).

## 6. Fallback

Implemented (`timingMethod: "fixed"` when Saskia's durations are unavailable) but **not exercised by any real render in this campaign** — every scene, in both the headless and in-app sessions, got a clean `timestamps` split from ElevenLabs on the first try. Read from the code, not observed. Forcing the silence-gap or fixed-fallback path (e.g. by disabling `ELEVENLABS_API_KEY` mid-session, or truncating an `/api/voice` response) was not attempted.

## 7. Player

**No player code changed.** `components/screen.tsx`'s `onTimeUpdate`/`onBeatBoundary` already read `ShotBeat.offsetSeconds` generically off the video's own `currentTime`, with no assumption of fixed 5s spacing; `components/player.tsx` already calls `narrator.play(n)` purely off those callbacks. Confirmed live in the browser (console log, same in-app session as above): every beat boundary fired at a non-5-multiple offset matching the recorded value (`beat boundary: beat 4 at 6.85s (offset 6.6s)`, `beat 7 at 7.38s (offset 7.2s)`, etc. — small positive drift each time, the video's actual cut landing slightly after the requested timecode, consistent with the model not hitting internal cuts exactly, same class of finding as WP8.1 §7).

## Render and compare (first pass, before the scene audio budget — kept for the record)

The reel and acceptance-criteria numbers now reflect the **follow-up** (budget-split) sessions, per the section above — this section is the first pass's own analysis, kept because it's what identified the clamp cascade the follow-up fixes, and because the follow-up's fix can't be understood without it.

`scripts/reel.mjs --narration` (unchanged tool) built each session's own reel independently; the deliverable reel concatenates two of these back-to-back, **not** a split-screen composite. WP8.1's own report (§"Reels") made the same choice for a similar reason ("different lengths and narrations don't mix into one file cleanly") — here the two programmes are additionally different total lengths end to end, so a true side-by-side would need one to freeze or loop while the other keeps playing, which would misrepresent both. Back-to-back, each with its own audio, is what was built — first with the first-pass voice-led session, then rebuilt with the follow-up session once that was measured (see previous section for why).

**Lag** (headline first-appearance − line's own actual audio start; a visual-change detector on the headline chip's own frame region, `scripts/ffmpeg.mjs#headlineChangeTimes` + `scripts/lag-report.mjs` — not OCR, see "Honesty" below). "Line's own actual audio start" reconstructs the real, sequential narration queue exactly as `scripts/reel.mjs` already does (`Narrator.play` does not start line *n* until line *n-1* has finished, even if the picture for *n* is already showing) — not simply the recorded `offsetSeconds`, which is only when playback is *requested*, not when it audibly begins.

| session | mean lag | max \|lag\| | beats measured |
|---|---|---|---|
| fixed (WP8.1, `...-164023-...`) | **-3.08s** | **6.71s** | 9/9 |
| voice-led, headless (`...-091959-...`) | **-1.18s** | **4.37s** | 8/9 (1 not detected) |
| voice-led, in-app (`...-092455-...`) | **-1.77s** | **4.48s** | 8/9 (1 not detected) |

Neither voice-led run meets the brief's target (mean <0.5s, max <1.0s) on this 9-beat spine, **but the reason is a single, precisely-identified cause, not a general failure of the approach**: scene 2 (3 beats) needs 18.8-19.2s of real narration — `requestedDuration` hits the fal ceiling (15) and `durationClamped: true` fires, **independently, in both new sessions** (different ElevenLabs takes, same clamp). Once one scene's narration doesn't fit in the time the video gives it, `Narrator.play`'s strict FIFO queue means every later beat's *actual* audio start is delayed by the overrun — and that delay never recovers for the rest of the programme, because no later scene has enough slack to absorb it. The pattern is visible beat by beat: the three beats *before* the clamped scene are excellent by themselves —

| beat | lag, voice-led headless | lag, voice-led in-app |
|---|---|---|
| 1 | 0.08s | 0.08s |
| 2 | -0.24s | 0.06s |
| 3 | 0.04s | 0.08s |

mean **-0.04s**, max **0.24s** across both sessions' first three beats — comfortably inside the brief's target — and then beat 4 onward (everything from the clamped scene forward) carries the accumulated backlog: -4.34s to +4.34s range, worsening beat over beat in the headless run, -0.23s to -4.48s in the in-app run. The clamped scene's own last beat (5) has only 1.0s of on-screen section left after its first two beats' sections are laid out (`[14, 15]`) — too little for the model to render (or this script's detector to find) a distinct headline change at all; "not detected" in both sessions, independently.

**Why scene 2 needs more than 15s**: it is a 3-beat scene, each beat's line up to the 22-word budget; at Saskia's own measured pace here (roughly 2.5-2.7 words/second across every other beat in these sessions) three near-budget lines run 19-20s before any lead is even added — structurally over `CLIP_SECONDS=15`'s ceiling for a 3-beat scene, not a one-off. This is the pinned 15s spine's own content, not something this WP's timing logic can fix without either shortening scene 2's lines (translator content — explicitly out of scope) or accepting that some 3-beat scenes will clamp and cascade.

Requested vs returned duration and aspect ratio: see §3/§4 above — every shot in both new sessions returned within 0.1-0.7s of its requested duration and 832×480 (ratio 1.7333) regardless of chaining.

## Honesty about what this measurement is and isn't

- **"Headline first-appearance" is a visual-change heuristic, not OCR.** It marks the first frame (after a small tolerance before the exact narration boundary, for the model's own "enters fast" overshoot) where ffmpeg's own scene-change detector fires against the cropped upper-third region — i.e. *something* changed there, not that the correct text is legible. No frame was manually inspected to confirm the headline shown is the right one at the right moment; `npm run check`'s structural pass and the Whisper split-check (below) are the only independently-verified layers here.
- **Split integrity, unaffected**: `scripts/saskia-split-check.py` on the voice-led headless session: mean own-line recall 97.8%, 0/9 beats with a neighbour's words, Diginex 1/1 — same quality as WP8.1's fixed-boundary numbers (98.5%, 0/9). The clamp/cascade problem above is a *video-timing* problem, not an audio-splitting one; the per-beat mp3s themselves are clean.
- **`npm run check`**: 0 hard failures on the new session (9/9 beats, 0 warnings) — connector/tag/word-budget rules are unaffected by this WP, as scoped.
- **Not attempted**: forcing the silence-gap or fixed-timing fallback paths against a real failure (§6); a true split-screen comparison video; independently confirming (beyond the visual-change detector) that a shown headline's *text* is correct at the moment it's judged to have appeared; whether the video model's own internal cuts would land closer to the requested timecodes on a scene that *isn't* clamped (only the clamped scene's degradation was directly measured against a "clean" baseline — the pre-clamp three beats' good numbers are suggestive, not a controlled test of a non-clamped multi-scene programme).

## Acceptance criteria — measured, not marked

1. Section boundaries and clip duration computed from the scene's audio, visible in the recording JSON: **confirmed** — `requestedDuration`, `timingMethod`, `splitMethod`, `totalNarrationSeconds`, `durationClamped`, and (follow-up) `sceneSplit` on every clip; `sectionEndSeconds`/`audioDurationSeconds` on every beat; hand-checked against the formula for all 9 beats across four voice-led sessions (two first-pass, two follow-up), exact match every time.
2. Mean lag <0.5s, max <1.0s on "the six-beat spine" (see "Which spine" for why the 9-beat 15s spine was used instead): **met, after the follow-up scene-audio-budget fix, both code paths** — headless 0.05s / 0.38s, in-app -0.01s / 0.29s, 9/9 beats measured both times (vs the first pass's -1.18s/4.37s and -1.77s/4.48s, 8/9, before the budget existed — see "Follow-up" above for the fix and why it worked). Root cause was a 3-beat scene's narration exceeding fal's 15s ceiling, cascading forward through the strict narration queue; splitting that scene at a beat boundary into two chained clips removed the clamp entirely (confirmed: `durationClamped: false` on every shot in both follow-up sessions) and with it the cascade.
3. Every request asks for 16:9; returned aspect ratio recorded: **confirmed for what's askable** — every t2v request sends `aspect_ratio: "16:9"` (recorded, `aspectRatioParamSent: true`); i2v has no such field in fal's schema at all (recorded, `false`, not a gap this WP can close). Returned aspect ratio measured and recorded on every shot across all four voice-led sessions: 1.7333 (832×480), not 1.7778, consistently — a real, small, fixed deviation, not something request-dependent, and unaffected by the scene split (a split group's two clips both measured 832×480 too).
4. Spine plays through in the app with no blank frames, lines starting on their pictures: **confirmed**, follow-up in-app session — live browser console showed the split firing (`[session] scene 2: narration 18.9s exceeds budget, split into 2 chained clips`), all 9 beat boundaries fired correctly (including across the new mid-scene clip boundary), no stall/blank warnings, clean run through all 5 shots to the final beat and into the auto-continue countdown. Lines starting "on their pictures" in the perceptual sense the brief means is now also supported by criterion 2's own number (mean -0.01s in this exact session), not just playback mechanics.
5. Reel and report exist: **confirmed** — `recordings/reels/spine-scene-fixed-vs-voiceled.mp4` (115s, rebuilt with the follow-up session), this document.
