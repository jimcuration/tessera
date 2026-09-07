# WP10 report — the translator writing brief

Measurements from live renders against the running dev server (`localhost:3110`, `CLIP_SECONDS=15`; a second instance on `localhost:3111`, `CLIP_SECONDS=5`, for the 5s exemplar), 2026-09-07. Not a pass/fail judgement — that's the reviewer's call (brief: "do not mark criteria as passed").

## 1. What was rendered

| session | question | clipSeconds | beats kept / dropped | scenes |
|---|---|---|---|---|
| `20260907-134938-spine-wp10-v2-saskia-chain-on-15s` | What is the cash position and runway? (spine) | 15 | 11 / 0 | 4 |
| `20260907-135154-live-resulticks-wp10-saskia-chain-on-15s` | What is the Resulticks acquisition supposed to unlock — revenue synergies or cost savings? | 15 | 9 / 1 | 4 |
| `20260907-135201-live-esg-competitors-wp10-saskia-chain-on-15s` | How is Diginex positioned against larger ESG software competitors like Workiva or Enablon? | 15 | 10 / 0 | 4 |
| `20260907-135147-spine-wp10-5s-saskia-chain-on-5s` | What is the cash position and runway? (spine, 5s) | 5 | 9 / 3 | 4 |

The Resulticks and ESG-competitors questions are "the two live translations" carried forward from WP5 onward (`briefs/WP5-report.md` §4, `briefs/WP5-handoff.md`; confirmed by re-reading those and `briefs/WP6.md`/`briefs/WP8.md`, which keep referring to "the two live translations" without renaming the pair). All four ran under `TRANSLATE_CACHE=on` (default): the spine and both live-translation questions had stale (pre-v0.4.0) cache entries, so each was translated live once and the fresh result written back to `data/translations/` automatically — that's why the 15s spine reads `source=cache` on a second run (`scripts/render.mts`'s own log line) but `source=live` for Resulticks/ESG on their first.

Both dev servers, and every render/check/whisper command below, ran from this worktree only (`C:\Users\Omar Mocap\Documents\tessera-wp10`); nothing touched the main checkout or another worktree.

## 2. Words per beat and per scene

Across all four sessions (39 beats, 16 scenes): **max line 22 words** (the hard cap at 10s/15s, hit exactly once, never exceeded), **max scene (narration) 47 words** (well inside the 66-word cap at 10s/15s; every 5s scene stayed ≤ 29, inside its own 36-word cap). No beat over budget survived validation; no scene narration exceeded `maxSceneWords(clipSeconds)`.

| session | mean words/line | scene narration words (per scene) |
|---|---|---|
| spine 15s | 13.7 | 46, 41, 37, 27 |
| Resulticks 15s | 15.3 | 43, 42, 47, 29 |
| ESG-competitors 15s | 13.9 | 34, 37, 37, 31 |
| spine 5s | 7.6 | 26, 27, 29, 27 |

(Full per-beat tables, render times, style-sheet survival and cost are in `node scripts/report.mjs <session>...` output, not reproduced here in full — see "How to verify" in the handoff.)

## 3. `npm run check` results

```
node scripts/check.mjs data/translations/a14c3cdf....json data/translations/ecc17ec....json
  -> 20 beat(s) checked, 0 without a valid source, 0 warning(s).
```

Both re-pinned exemplars (5s and 15s) pass cleanly.

The four live sessions:

```
59 beat(s) checked, 7 without a valid source, 6 warning(s).
```

Two distinct findings, both explainable and both pre-existing kinds of fragility rather than new bugs:

**a. A dropped beat orphans its scene.** Resulticks scene 1 wrote 2 beats (23 + width-of-second words); the first was 23 words, one over the 22-word cap, and was dropped by `validateBeat` at run time (`"line is 23 words (limit 22)"`). The surviving lone beat then fails three scene-level checks at once: `scene 1 has 1 beat(s) (expected 2-3)`, `scene 1's narration does not equal its beats' lines concatenated` (only one of the two lines is left to concatenate), and `scene 1's connector ... is not among the scene's subjects` (the connector's `"to"` end was only ever named in the dropped beat's `subjects`). The 5s spine session shows the identical pattern three times over (3 of 9 attempted beats dropped for exceeding the 12-word cap — see §4). This is not a new failure mode: WP8.1's connector/tag scene-consistency checks already had exactly this exposure whenever a mid-scene beat drops; WP10's narration checks just add two more scene-level invariants that a drop can break. Nothing in this brief's scope fixes it — doing so would mean validating a whole scene atomically before committing any of its beats to the client, a change to `app/api/translate/route.ts`'s per-beat streaming design, out of WP10's scope. Flagged as a follow-up suggestion (see handoff).

**b. The numeric-grounding heuristic has real, understood false positives.** `spelledNumbersIn` (lib/translator.ts) expands spelled-out figures back to decimal strings and checks them against the cited sentences' own digits (`numbersIn`, the same simple `\d[\d,]*` regex the pre-existing headline-number check already used). It does not expand `$7B+`/`$34M`-style shorthand in the *source* sentences to full magnitude, so "seven billion dollar plus" (spelled fully, correctly, from "Workiva is a $7B+ market cap...") doesn't digit-match against the source's own literal `"7"`. Both `"7000000000"` and `"34000000"` warnings in the ESG session are this, confirmed by hand against the cited sentences (§5 below) — the content is accurate, the heuristic's magnitude-shorthand gap is the issue. The `"20"`/`"26"` warnings in the same session's scene 4 are a second gap: "late twenty twenty-six" (a spoken year) is parsed as two separate numbers rather than reassembled into "2026" — fixed partway through this WP (see handoff) so it no longer silently sums to a wrong figure ("46"), but it still doesn't reconstruct the year, so it still warns. Both gaps are documented in `spelledNumbersIn`'s own doc comment and are why this check is a soft warning, never a hard failure — a hard failure here would have wrongly killed accurate beats.

No other hard failures. No banned-phrase hits, no un-hedged first-person opinion markers, in any of the four live sessions or either pinned exemplar.

## 4. The 5s/voice tension (an honest finding, not asked for but worth recording)

At 12 words/beat (5s), the new voice's longer, natural-rhythm sentences overshoot the cap more often than at 22 words/beat: the live 5s spine render dropped 3 of 12 attempted beats (25%) for exceeding 12 words, all by 1-2 words (`"line is 14 words (limit 12)"` ×2, `"line is 13 words (limit 12)"` ×1) — see `data/translations/a14c3cdf....json`'s own note for the exact dropped lines. The re-pinned 5s exemplar (`EXEMPLAR_NDJSON_5S`) is hand-authored rather than taken from this run for exactly this reason: it needed to pass `npm run check` cleanly, and this run's dropped-beat gaps didn't. The 15s live sessions each dropped at most 1 of ~10 beats (~10%), by exactly 1 word. This isn't something WP10 was asked to fix (CLIP_SECONDS defaults to 15, and the brief's own worked passages are sized for the 22-word budget — see §3 of `briefs/WP10.md` and this file's §6), but it's a real, measured cost of writing a more natural voice at the older 5s budget, worth Robin knowing about if 5s is ever used again.

## 5. Three live-translation passages, quoted in full, against their source

Every figure and characterisation below was checked by hand against the cited sentence(s) (not just the numeric-grounding heuristic in §3b).

**Spine, scene 2 (magenta), sources [19, 22, 23]:**

> Over six months, the company consumed twelve point seven million. Operating burn alone was three point nine million — about one point three million a month. Which means one point eight five million covers one point four months. That's dangerously thin.

| cited sentence | maps to |
|---|---|
| [19] "Total cash consumed: $12.7M" | "the company consumed twelve point seven million" |
| [22] "The burn rate is roughly $3.9M per half-year in operating losses, or approximately $1.3M per month." | "Operating burn alone was three point nine million — about one point three million a month" |
| [23] "At that rate, the $1.85M cash on hand provides 1.4 months of runway — dangerously thin." | "one point eight five million covers one point four months. That's dangerously thin." (kept verbatim — the source's own characterisation, not softened) |

**Resulticks, scene 2 (cyan), sources [4, 5, 6, 7, 8]:**

> Here's the logic. Same customers, two jobs. Sustainability and compliance on one side, customer intelligence and marketing on the other. So an enterprise already buying ESG reporting can now buy marketing automation from the same vendor. Broader product suite, higher wallet share.

| cited sentence | maps to |
|---|---|
| [4] "...Diginex can now serve enterprise customers across two distinct workflows" | "Same customers, two jobs" |
| [5]/[6] "Sustainability & compliance (...)" / "Customer intelligence & marketing (...)" | "Sustainability and compliance on one side, customer intelligence and marketing on the other" |
| [7] "...enterprises managing ESG compliance can now also buy customer data and marketing automation from the same vendor..." | "an enterprise already buying ESG reporting can now buy marketing automation from the same vendor" |
| [8] "...the same customer base, broader product suite, higher ACV." | "Broader product suite, higher wallet share" ("ACV" dropped as jargon per the voice brief's own worked example: "wallet share" is [7]'s own word, reused instead) |

**ESG-competitors, scene 1 (violet), sources [12, 14, 15]:**

> Start with the size gap. Workiva is a seven billion dollar plus public company. Diginex? Thirty-four million market cap — a micro-cap challenger. It can't match their sales force, brand recognition, or installed base.

| cited sentence | maps to |
|---|---|
| [12] "Workiva is a $7B+ market cap public company..." | "Workiva is a seven billion dollar plus public company" |
| [14] "Diginex, at $34M market cap, is a micro-cap challenger." | "Diginex? Thirty-four million market cap — a micro-cap challenger." |
| [15] "It cannot match their sales force, brand recognition, or installed base." | "It can't match their sales force, brand recognition, or installed base." (near-verbatim, one contraction) |

All three read, out loud, as one person talking: contractions ("here's", "can't", "that's"), short-then-long rhythm, "So"/"But" openers elsewhere in the same programmes (see §7's full quotes), a fragment ("Diginex?"), no invented figures. Reviewer judgement is still the actual acceptance test for criterion 4 — this is the evidence for that read, not a substitute for it.

## 6. Asides (brief §2: "at most one per scene, and it has to do work")

Judged by eye against the "recognition, then back to the answer" definition — this is a qualitative call, not a code check (nothing in `npm run check` counts asides). No scene in any of the four sessions carries more than one:

| session | scenes with a clear aside | example |
|---|---|---|
| spine 15s | 1 of 4 (scene 1) | "Net current assets look better, ten point six million. But that's deferred revenue and payables — not cash generation." |
| Resulticks 15s | 1 of 4 (scene 4) | "...Without that, it's financial engineering, not strategy." |
| ESG-competitors 15s | 1 of 4 (scene 2) | "The bet? Enterprises prefer a single vendor over point solutions from many." |
| spine 5s | 0 of 4 | — (budget is too tight at 12 words/beat for the aside-then-answer shape to fit) |

## 7. Whisper split integrity

**`npm run whisper` (`scripts/whisper-match.py`) is the wrong tool for a Saskia session** — its own docstring says so ("Whisper word-match per clip for native-voice sessions"): it transcribes each rendered clip's own embedded audio, which is wordless by design for `VOICE=saskia` (`AUDIO_BLOCK_B`, "No voice, no speech..."). Run anyway per the brief's instruction to say so plainly rather than skip silently:

```
python scripts/whisper-match.py "../tessera-recordings/20260907-134938-spine-wp10-v2-saskia-chain-on-15s" --model medium
-> mean word recall 0.0% (every clip: "heard: " — nothing transcribed, as expected for a wordless clip)
```

Ran cleanly (Python 3.12.9, `whisper` importable via the environment's Miniconda site-packages, no install needed) — 0.0% is the correct result for a wordless clip, not an environment failure.

**`npm run split-check` (`scripts/saskia-split-check.py`) is the actually-relevant check** — it transcribes each beat's own split narration mp3 and scores recall against that beat's `line`/`delivery`, exactly the split-integrity question WP8/WP8.1/WP8.2 used it for. Run against all four sessions (`--model medium`):

| session | mean own-line recall | beats with a neighbour's words (bleed) | "Diginex" transcription |
|---|---|---|---|
| spine 15s | 98.5% | 0 | 0/1 |
| Resulticks 15s | 98.0% | 0 | 1/2 |
| ESG-competitors 15s | 92.4% | 0 | 3/3 |
| spine 5s | 99.0% | 0 | 0/1 |

Zero bleeds across 39 beats: every beat's own split narration audio is recognisably that beat's own line, never a neighbour's — direct evidence that ElevenLabs' character-alignment split (`app/api/voice/route.ts`, unchanged by WP10) still lands cleanly on the new, longer, more varied-rhythm sentences it's now cutting from. "Diginex" mistranscription (as "Digenex"/"DIGINX"/etc.) is a pre-existing Whisper-on-a-invented-brand-name limitation, not a WP10 finding.

## 8. Reels

- `../tessera-recordings/reels/spine-voice-before-wp10.mp4` (62.1s) — WP8.2's own final voice-led budget-fixed spine session (`20260907-101341-spine-pinned-voiceled-budget-saskia-chain-on-15s`, old voice, pre-WP10), cut with `scripts/reel.mjs --narration --music`.
- `../tessera-recordings/reels/spine-voice-after-wp10.mp4` (76.7s) — the new session (`20260907-134938-spine-wp10-v2-saskia-chain-on-15s`), same tool.
- `../tessera-recordings/reels/spine-voice-before-vs-after.mp4` — the two concatenated back-to-back (`scripts/concat-reel.mjs`), mirroring WP8.2's own precedent for its fixed-vs-voice-led comparison (`briefs/WP8.2-report.md` §"reel", `briefs/WP8.2-handoff.md`): "the deliverable reel concatenates two of these back-to-back, not a split-screen composite" — the sessions differ in length, and a true side-by-side would misrepresent one of them.

All three reels are in `../tessera-recordings/reels/` (the shared `RECORDINGS_DIR`), matching every existing reel there (`spine-scene-fixed-vs-voiceled.mp4`, `spine-v0.3-vs-v0.4.mp4`, etc.) — not a repo-local `reels/` folder. `git` never sees these files (`.gitignore` excludes clip video; the recordings folder itself is outside the repo).

## 9. No `PALETTE=c` mono comparison — why

The brief asks for a second render "once more with `PALETTE=c` env var for a mono comparison" and says to check `lib/config.ts`/`lib/prompt.ts` for what it does, describing it as "an existing switch." It is not: `PALETTE` appears nowhere in `lib/config.ts`, `lib/prompt.ts`, or anywhere else on `main` — the only two hits in the whole repo are `briefs/WP7.md` (which *specifies* a `PALETTE=a|b|c` switch as something to build) and this WP10 brief itself. `briefs/WP7.md` has no `-handoff.md` or `-report.md`, and `git log` shows no WP7 merge to `main` — WP7 was briefed but never built/merged (or was built on a branch that never landed). This worktree is forked from `main` at WP9, so it genuinely has no palette-switching code.

One piece of physical evidence that WP7 *was* attempted somewhere: `../tessera-recordings/reels/spine-palette-a-b-c.mp4` already exists in the shared recordings folder, from some other (unmerged) worktree/branch's run. Its existence doesn't help here — the code that produced it isn't on `main`.

Building `PALETTE=c` from scratch inside WP10 would mean implementing WP7's entire scope (a config switch, new hex values for a "mono-plus-one" palette, and substituting them into `lib/prompt.ts`'s `styleSheet()`/`GROUND_NAMES`) — a different work package's brief, not this one's ("write the scene, then cut it" + voice), and it would mean inventing colour values CLAUDE.md explicitly says not to invent ("Palette hex values are approximate until Jim confirms. Do not invent new colours") without Jim's confirmation this brief doesn't carry. Judgement call: skipped, documented here rather than silently dropped, flagged in the handoff. `reels/spine-voice-before-vs-after.mp4` (§8) still delivers the actual point of that render pass — the voice, not the palette.
