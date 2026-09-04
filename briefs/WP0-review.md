# WP0 — Review

Reviewer: Claude (reviewer role, CLAUDE.md). Read only `briefs/WP0.md` acceptance criteria — the handoff was not read. Tested live against `npm run dev` with the repo's own `.env.local`, plus `npm run check` and the recorded artifacts in `recordings/`.

## Acceptance criteria

### 1. `npm run dev` starts; typing a Diginex question plays a programme of ≥6 chained beats with no blank frames between clips — **PASS**

`npm run dev` started clean (`Ready in 1891ms`). Typed `what is the resulticks acquisition supposed to unlock` into the ask line and pressed Enter (confirmed via a fresh `/api/translate` POST → 200 firing at the moment of submit, and the typed text appearing under the screen) — it rendered and played. Separately, clicking a suggestion for `What is Diginex` played a full 10-beat chained programme (`CHAIN=on` default), well over the ≥6 threshold. Console logged every swap (`[screen] beat N → front slot … (readyState 3|4, …)`); readyState was never below 3 at a swap, i.e. no blank frame was ever presented. Screenshots through the run showed continuous, correctly-grounded collage clips (violet → magenta → lime → violet …) with no black gaps.

### 2. `VOICE` and `CHAIN` switches work without code changes — **PASS**

Edited only `.env.local` (`VOICE=native→saskia`, `CHAIN=on→off`), no code touched, no server restart (Next's `force-dynamic` route re-reads `process.env` per request). `/api/config` reflected the change on the very next request: `{"voice":"saskia","chain":"off","render":"queue",...}`. A live session then ran under those switches and recorded to `recordings/20260904-124818-…-saskia-chain-off/`. Reverted `.env.local` to `native`/`on` afterwards.

### 3. Interrupting mid-segment starts the new answer without the screen going blank; stale renders are cancelled — **PASS**

Asked a question, waited ~4s (a render in flight), then clicked a different suggestion. The screen held the exact frame it was on (before/after screenshots identical), and the console logged `[session] cancelled 1 render(s) in flight`. The new session's first clip cut in cleanly a few seconds later with no gap.

### 4. Suggestions appear under the screen and auto-continue fires after 10s idle — **PASS**

Suggestions (three lines, each prefixed with the small cursor square) update to the answer's own follow-ups after every answer. Observed the `· up next in Ns` countdown on the top suggestion counting down live and firing on its own at 0, starting a new programme with no click.

### 5. Every beat records its source sentence(s); `npm run check` flags any beat with no source and exits non-zero if found — **PASS**

`npm run check` against the real `recordings/` + `data/translations/`: `142 beat(s) checked, 0 without a valid source, 16 warning(s)`, exit code `0` (warnings are soft — line/headline length, a headline digit not literally in its cited sentence — and correctly don't fail the run). Negative case: fed it a synthetic translation file with `source: []` — it reported `FAIL … no source`, `1 without a valid source`, and exited `1`. Both directions work as specified.

### 6. `briefs/WP0-report.md` contains the required numbers — **FAIL (one required item missing)**

Present and well-evidenced: render time per clip (p50/max), cost per clip and per-60s projection at $0.025/s, Whisper word-match per clip for native voice, five contact sheets, which style-sheet lines survive in `expanded_prompt`, and headline/number render accuracy per clip.

Missing: **subjective voice-consistency 1–5 across the six spine clips.** The report's §4 table has two empty checkboxes (`☐`) under "voice consistency 1–5" and says "Subjective, needs listening; I cannot." The brief asks the report to *contain* that rating — proxies and an honest note about why it's unscored are useful, but they aren't a substitute for the number, and as written the deliverable is incomplete on this one line. Recommend Robin (or whoever screens the two reels) fills in the two `☐` cells before this criterion is called done — everything else needed to do that (the reels, the per-clip breakdown) is already in place.

### 7. `recordings/` contains two demo reels (native, saskia) of the six spine beats and one chained-vs-unchained comparison — **PASS**

`recordings/reels/` has exactly the three expected files: `spine-native-chained.mp4` (31.14s ≈ 6×5s), `spine-saskia-chained.mp4` (33.96s, narration overlaid), `spine-chained-vs-unchained.mp4` (31.14s, side-by-side). Durations match `WP0-report.md`'s own numbers, and each corresponds to a real recorded session with matching beat count.

**Score: 6/7 pass.** Only #6 is incomplete, and only on one specific line.

## `lib/stream.ts` — the five changes, and whether each was necessary

CLAUDE.md hard rule 3 says not to touch `lib/stream.ts` buffer logic "unless a brief explicitly says so." WP0 explicitly replaces the showrunner with the translator and adds `CHAIN=on|off`, so some rewrite was licensed; I checked each change against that license rather than assuming it.

1. **Shot ingestion moved from batch `refill()`/`writeBatch()` (showrunner) to incremental `addShots()`/`finish()`.** Necessary. The brief's scope item 2 explicitly retires the showrunner for the translator, and `lib/programme.ts` streams one beat at a time as Claude writes them (`stream.addShots([shot])` inside the per-line SSE handler) — the old batch-write model has no way to consume that.

2. **Removed the pre-rendered cold-open path** (`openCold()`, `ManifestEntry`/`Title` asset, `previewPrompt`; constructor now takes just `chain: boolean`). Necessary, and a direct consequence of #1: a cold open needs a pre-rendered clip for a known opening line, but Tessera's content is decided per live question — there is nothing to pre-render. `catalog/titles.mjs`'s own comment confirms this: "There is no cover and no pre-generated preview: the first beat of every answer is the cold open."

3. **`isStory`/chain now driven by the `CHAIN` switch instead of `title.mode` ("story"/"chaos").** Necessary — this *is* switch item 2 from the brief's Switches section, verified live in §2 above.

4. **Added a terminal `"ended"` phase, a `finished` flag, and `renderingShot()`.** Necessary. `player.tsx` uses `phase === "ended"` as one of the three conditions that start the 10s auto-continue countdown (brief item 5 / criterion 4, verified live in §4), and `renderingShot()` feeds the cursor's ground-colour blink while rendering, which CLAUDE.md's Interface section specifies by name ("blinks in the next beat's ground colour while rendering"). Both are wired up and observed working, not speculative additions.

5. **Position-based playback (`playIndex`, matching queue entries by shot identity instead of `queue.shift()`) plus `failedShots`/`skipFailed()`.** Necessary, and the one change furthest from the brief's literal text — it's a buffer-ordering fix, not a switch. It matters because unchained programmes (`CHAIN=off`) render two shots in parallel (`UNCHAINED_PARALLEL`), so clips can land out of completion order; a plain FIFO `queue.shift()` would then play beats out of the order the translator wrote them. `WP0-report.md` §9 records that this was found and fixed during the same work ("Unchained rendering played beats out of order until the stream was made to hand clips over in writing order; fixed and re-run"), and I reproduced the failure-handling half of it live: a run where beats 1–4 hit transient fal `500`s still played beats 5–10 in order with no stall, which only works because of `skipFailed()`. Given the brief requires a working `CHAIN=off` mode and a chained-vs-unchained comparison reel (criterion 7, scope item 4), this fix was required to meet the brief, not scope creep — but it's the one change I'd want Robin to know was inferred rather than spelled out, since it's exactly the kind of "buffer logic" hard rule 3 is guarding.

## Other observations (not acceptance criteria, worth flagging)

- Twice during testing (once on `What is Diginex`, once on a follow-up), a beat's collage subject rendered as a clearly recognisable human face (a man's headshot; a young woman's face), not the anonymous halftone cutouts the style sheet calls for. CLAUDE.md hard rule 6 and style-sheet line 3 both prohibit this. `WP0-report.md` §7 states "Faces: none in 18 spine clips or 20 live-translation clips" for the recorded sessions it audited — that's consistent with what I saw being sampling variance across different renders, not a contradiction, but it means the no-faces constraint is not yet reliable enough to treat as solved. Worth a prompt-level follow-up before this goes in front of anyone outside the team.
- Testing this review generated nine new session recordings under `recordings/` (untracked, not staged) — left as-is since they're genuine output of exercising the app, not modified.
