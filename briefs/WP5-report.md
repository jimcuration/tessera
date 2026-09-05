# WP5 report — style v0.4: scenes, event rate, protagonist hand, type on black, music bed

All recordings referenced below live in the shared `RECORDINGS_DIR`
(`lib/config.ts#recordingsDir`, default `../tessera-recordings`), **not**
inside this checkout's own `recordings/` — that is the point of the
RECORDINGS_DIR addition (see the top of this report and `briefs/WP5-handoff.md`).
Paths below are relative to that shared folder.

## 0. RECORDINGS_DIR (this WP's first addition)

Added `RECORDINGS_DIR` (`lib/config.ts#recordingsDir`, default
`../tessera-recordings`) so the main checkout and every worktree write
clips, prompts, `expanded_prompt`s and everything else CLAUDE.md rule 7
covers to one shared folder instead of each checkout's own disconnected
`recordings/`. Wired into `app/api/record`, `app/api/voice`, and
`scripts/check.mjs`'s default scan target. CLAUDE.md rule 8, the README,
and `.env.example` updated. Verified: the v0.3 baseline render below, the
v0.4 spine, both live translations, and the music bed all landed in
`../tessera-recordings/` from this one worktree; `npm run check` with no
arguments scans that shared folder by default.

Before touching the style sheet, the Diginex spine ("What is the cash
position and runway?", `saskia`, `chain on`) was rendered once under v0.3
as the baseline for the comparison reel:
`20260905-095626-diginex-v0-3-baseline-saskia-chain-on/`.

## 1. Translator v0.4

`scene`, `events` (replacing `action`), `hand`, `labels`, and the bookend
rule are implemented in `lib/translator.ts` per the brief; `npm run check`
(`scripts/check.mjs`) mirrors every new rule. The pinned exemplar
(`EXEMPLAR_NDJSON` and `data/translations/a14c3cdf...json`) is updated to
the v0.4 shape and regrouped into three two-beat scenes so its own final
beat bookends scene 1 (see §3).

`npm run check` on the updated exemplar:

```
6 beat(s) checked, 0 without a valid source, 0 warning(s).
```

Clean, as required.

One authoring bug caught and fixed during this WP: the exemplar's beat 4
was marked `hand: true` but its `events`/`subjects` never gave the hand
anything to do — the first render of it (session
`20260905-102219-...`, superseded, kept on disk per rule 7) accordingly
showed no hand in beat 4. Fixed by adding a paper hand to beat 4's third
event and subjects, re-rendered clean (see §3's session, `20260905-103727-...`).
Not caught by `npm run check` because `hand` isn't cross-checked against
`events`/`subjects` content — that's a judgement call a human (or a
model) has to make when writing a beat, not something codifiable the way
the label-verbatim check is.

## 2. Style sheet v0.4

`lib/prompt.ts` and `CLAUDE.md` updated per the brief: grounds are deep
and saturated, held for the whole scene; headline and label type moved to
cream-or-pale-yellow on black chips only; three new lines added
(accumulation, the recurring hand, one hot ribbon colour). Copy list
carries labels alongside the headline.

One line 3/4 addition beyond the brief's spec, made in response to a
finding in §5 below (recognisable faces on paper tags) — see that section
for the full story; noted here because it changes the numbered style sheet
text itself.

### Survival grid (`expanded_prompt`, all three v0.4 renders — spine + both live translations, 26 beats)

| line | 1 collage | 2 ground | 3 halftone/unmarked/matte | 4 paper diagram | 5 light | 6 layout | 7 headline type | 8 scale | 9 motion | 10 16:9/5s | 11 identity | **12 accumulation** | **13 paper hand** | **14 hot ribbon** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| spine (6) | 6/6 | 6/6 | 6/6 | 3/6 | 6/6 | 6/6 | 6/6 | 3/6 | 6/6 | 1/6 | 5/6 | **1/6** | **5/6** | **2/6** |
| live: Resulticks (10) | 10/10 | 10/10 | 10/10 | 8/10 | 10/10 | 10/10 | 10/10 | 2/10 | 10/10 | 3/10 | 10/10 | **1/10** | **8/10** | **6/10** |
| live: ESG competitors (10) | 10/10 | 10/10 | 10/10 | 8/10 | 10/10 | 10/10 | 10/10 | 4/10 | 10/10 | 2/10 | 10/10 | **4/10** | **7/10** | **4/10** |
| **all (26)** | 26/26 | 26/26 | 26/26 | 19/26 | 26/26 | 26/26 | 26/26 | 9/26 | 26/26 | 6/26 | 25/26 | **6/26 (23%)** | **20/26 (77%)** | **12/26 (46%)** |

The three new lines survive fal's prompt rewriter unevenly: **line 13
(the recurring paper hand) survives well (77%)** — concrete, embodied
instructions ("presses", "points", "slides chips") paraphrase easily.
**Line 14 (hot ribbon colour) is middling (46%)** — a scene-level rule
about which colour to use, easier to drop or genericise into "colourful."
**Line 12 (accumulation) survives worst (23%)** — it is the most abstract
of the three (a rule about what does *not* change), and the rewriter
tends to compress it away. This roughly matches WP1/WP2's finding that
descriptive, concrete instructions survive better than abstract ones; it
suggests a future revision could fold line 12's intent into the BEAT
block's own per-beat language (which already says explicitly what
persists) rather than relying on the style sheet's general rule surviving
every rewrite. Numbers computed by `scripts/report.mjs` (extended to the
v0.4 fourteen-line signal set) against every rendered beat's own
`expanded_prompt`.

Reminder: survival in the fal rewriter's text is a different measurement
from whether the *rendered frame* actually shows the hand/accumulation/
ribbon colour — §3 covers that by eye, against the contact sheets.

## 3. The v0.4 spine — measured against acceptance criterion 3

Session: `20260905-103727-diginex-v0-4-spine-saskia-chain-on/` (saskia,
chain on, the pinned exemplar — `npm run check` clean, 0 warnings).
Contact sheets at 1s/3s/5s for all six clips: `contact-1.jpg`,
`contact-3.jpg`, `contact-5.jpg` inside that session folder.

| beat | headline | scene | ground | hand (design) | hand (observed) | events distinct across 1s/3s/5s | label(s) | label rendered exactly |
|---|---|---|---|---|---|---|---|---|
| 1 | $1.85M | 1 | violet | true | ✓ (hand presses coin, 5s) | ✓ | "six months earlier" | ✓ |
| 2 | $3.11M → $1.85M | 1 | violet | false | — | ✓ | "$3.11M" | ✓ |
| 3 | $1.3M / MONTH | 2 | magenta | false | — | ✓ | "$3.9M per half-year" | ✓ |
| 4 | 1.4 MONTHS (hero) | 2 | magenta | true | ✓ (hand taps aircraft, 3s) | ✓ | "dangerously thin" | ✓ |
| 5 | +$13.8M | 3 | violet | true | ✓ (hand presses coin, 3s/5s) | ✓ | "$13.8M" | ✓ |
| 6 | NEXT 2 QUARTERS | 3 | violet | true | ✓ (hand points, 3s/5s) | ✓ | "capital markets" | ✓ |

- **Events**: 6/6 beats show a clearly different composition at 1s vs 3s
  vs 5s (target: ≥4 of 6). Full build visible beat to beat, e.g. beat 1:
  coins still dropping (1s) → chip and label settled (3s) → hand arrives
  (5s).
- **Hand**: 4/6 beats show it (target: ≥3 of 6) — beats 1, 4, 5, 6, matching
  the `hand: true` design exactly once beat 4's authoring bug (§1) was fixed.
- **Labels**: 6/6 render exactly as specified (target: every label exact).
  An earlier render of the same beats (superseded session
  `20260905-102219-...`) showed beat 2's carried-over label from beat 1
  render as "six moming earlign" instead of "six months earlier" — a
  video-model text-rendering slip on a re-drawn (chained, accumulated)
  chip, not a translator or prompt defect (the prompt states the string
  correctly in both beats). Not reproduced in this session; flagged here
  because it is a real, if apparently intermittent, risk worth watching
  across future renders, especially for labels/headlines carried into a
  second beat by accumulation.
- **Accumulation**: this programme has three two-beat scenes, so three
  scene-internal beats exist (the brief's phrasing assumes four, which
  fits a two-scene, two-beats-and-a-continuation shape rather than this
  programme's three two-beat scenes — a difference in scene sizing, not a
  shortfall). All three keep the prior beat's primary subject and chip in
  place while adding something new: beat 2 keeps the coin stack and beat
  1's chip while the arrow enters; beat 4 keeps the strip's chip while the
  aircraft enters; beat 6 keeps the coin stack and tape while the calendar
  pages and hand enter. **3 of 3 scene-internal beats show accumulation.**
- **Bookend**: beat 6 returns to scene 1's ground (violet), scene 1's
  primary subject (the coin stack), and scene 1's exact `handoff` string
  ("the coin stack") — with the October warrant's fresh coins (beat 5) and
  the calendar pages plus pointing hand (beat 6) as what's added/changed.
  **Achieved.** `npm run check` enforces the ground half of this
  automatically (see §1); the primary-subject and handoff match were
  checked by hand against the contact sheets.

All six criterion-3 thresholds are met or exceeded on this session.

## 4. Live translations under v0.4

Two non-spine, non-pinned questions, translated live (`source: "live"` —
confirmed in each `session.json`; both are now cached under
`translator-v0.4` for future runs, since `TRANSLATE_CACHE=on`):

- `20260905-102615-live-resulticks-v0-4-saskia-chain-on/` — "What is the
  Resulticks acquisition supposed to unlock — revenue synergies or cost
  savings?", 10 beats. `npm run check`: clean (2 soft warnings only, no
  failures — see §5 for a real problem this session surfaced anyway).
- `20260905-103447-live-esg-competitors-v0-4-saskia-chain-on/` — "How is
  Diginex positioned against larger ESG software competitors like Workiva
  or Enablon?", 10 beats. `npm run check`: clean (2 soft warnings only).

A third question ("What is Diginex") was also translated live during
interactive browser testing and is genuinely `npm run check`-clean *as a
translation* (its cache entry, `data/translations/91389ad5...json`,
passes with 0 failures), but the interactive session was interrupted after
5 of 10 clips rendered (session `20260905-102328-...`, kept on disk).
`npm run check` on that specific session folder still reports a bookend
FAIL — that is an artifact of checking a truncated 5-clip programme against
its own (correct) 10-beat design, not a translator defect; superseded by
the two complete live translations above for this report's purposes.

Contact sheets at 1s/3s/5s exist for both complete live translations
(`contact-1/3/5.jpg` in each session folder). Both show the same pattern
as the spine — visible per-beat build across the three timestamps, and the
hand appearing in a majority of beats (8/10 and 7/10 respectively, per the
survival table's line-13 text-level numbers, corroborated by eye against
the frames) — but both are 10-beat, four/five-scene programmes rather than
the spine's fixed six/three shape, so criterion 3's beat-by-beat table
above is not repeated for them; they primarily inform §2's survival grid
and §5's finding.

## 5. Finding: recognisable faces on paper tags (CLAUDE.md rule 6)

**This is the most important finding in this report and is not fully
resolved.**

Beats 6 and 7 of the Resulticks live translation (`subjects: ["four
hole-punched tags", "string and pins"]` and `["a grid of paper squares",
"string and pins"]` respectively — both phrasings drawn straight from the
style sheet's own approved vocabulary, and both pass `validateBeat`'s
people check cleanly, as they should) were rendered by the video model
with **recognisable human faces** printed on several of the tags/squares —
photographic portraits, not blank paper. Beat 7 of the ESG-competitors
live translation ("a grid of paper squares" again) showed the same
pattern, more faintly. Confirmed at full resolution, not a contact-sheet
compression artifact (see the beat 6/7 frames pulled directly from the
source `.mp4` files during this investigation).

This is a **CLAUDE.md rule 6 violation** ("No recognisable people in
generated imagery") and directly bears on acceptance criterion 6 ("No
people in any clip"). It is a genuine finding, reproduced independently in
two different live translations, on two different beat concepts
("acquisitions" and "modules" comparisons), both using small rectangular
"card" or "tag" groupings. It is **not a translator bug**: `subjects` in
both cases were exactly the kind of anonymous object the style sheet asks
for, and `validateBeat`'s people-lexicon/proper-name check has no way to
catch a fact about the *rendered pixels* from the *beat's own text*
description. It appears to be a real tendency of the H3 Max Turbo model to
default to ID-card/portrait imagery when generating small paper rectangles
in a "comparison" or "roster" context — plausibly a training-data bias
toward personnel photos, contact cards, or dating-app-style grids.

**Mitigation applied, verification below.** `lib/prompt.ts` style sheet
lines 3 and 4 (and the mirrored text in `CLAUDE.md`) were strengthened to
say explicitly that *every* tag, card, document and photograph in the
frame is blank paper texture only, "never a person's face, portrait or
headshot, printed or photographic, however small or partial," and that a
tag standing for a company or deal is "a blank rectangle of textured
paper... not a photograph or portrait." `STYLE_SHEET_SIGNALS` and
`scripts/report.mjs`'s mirror were updated with matching phrases.

**Verification**: re-rendered the identical Resulticks translation (same
cached v0.4 beats — `source: "cache"` this time, so beats 6 and 7's
`subjects` text is byte-for-byte the same as the render that showed
faces) under the strengthened style sheet:
`20260905-104543-verify-face-fix-v0-4-saskia-chain-on/`. All ten clips
inspected at full resolution (not just 6 and 7): **no recognisable faces
in any beat**, including beats 6 and 7, which now show the tags/squares as
plain grey halftone texture — and, as a side benefit, the connecting
string now renders in the hot ribbon colour (orange) both times, where the
original showed a cream/tan string. `npm run check` on this session: clean
(2 soft warnings, same headline-number class as before, no failures).
Contact sheet: `contact-5.jpg` in that session folder.

This is one successful re-render, not a guarantee — video diffusion is
stochastic, "four hole-punched tags" or "a grid of paper squares" could
still draw a face on a future sample, and no other subject phrasing that
might trigger the same model tendency (photographs, portraits, ID cards,
headshots as diagram elements are all still nominally reachable via other
answers' content) has been tested. Treat the mitigation as a real,
positive signal worth keeping, not as this finding being closed. Robin/PM:
this likely warrants (a) watching for recurrence across future WPs' live
renders, and (b) a decision on whether anything beyond a style-sheet
wording fix is needed (e.g. a code-side check on the *expanded_prompt* or
even the rendered frame, analogous to how `validateBeat` catches people
named in text) before this is treated as solved.

## 6. MUSIC switch

`MUSIC=on|off` (default `off`) added to `lib/config.ts`, exposed via
`/api/config`, consumed only by `components/player.tsx` (a second,
independent `<audio>` element — `lib/stream.ts` untouched, per rule 3).
Plays only when `MUSIC=on`, `VOICE=saskia`, and a programme is actively
playing or buffering; paused the instant the programme ends or is muted.
Verified interactively in the browser (Browser pane, `MUSIC=on`,
`VOICE=saskia`): the bed fetched from `/api/music`, played at volume 0.13
(Saskia's own volume is 0.5, so roughly -12dB under it, matching the
brief), looped correctly (`currentTime` wrapped from ~29.7s back to
~12.4s at the ~30s mark), paused when the programme reached its idle
countdown, and resumed automatically when auto-continue started the next
programme.

**Source and licence** (`scripts/music.mts`, run once): generated via
ElevenLabs' music API (`POST /v1/music`) using this project's own
`ELEVENLABS_API_KEY` — succeeded on the first attempt, no fallback to
`/v1/sound-generation` needed. Prompt: "Sparse instrumental underscore for
a paper-collage documentary explainer: soft plucked upright bass and
marimba only, warm and understated, gentle even tempo around 92 BPM, no
drums, no percussion kit, no vocals, no melody hooks, wide open space
between notes, seamlessly loopable, low mixed level throughout so it can
sit under narration." 30 seconds requested, 480,698 bytes returned. Saved
to `<RECORDINGS_DIR>/music/bed.mp3` with the prompt, endpoint, byte count
and a licence note logged alongside it in `bed.json` — usage rights follow
the same ElevenLabs account/plan as every Saskia narration track this app
already generates; not a third-party sample. Served to the player by the
new `app/api/music` route (reads `<RECORDINGS_DIR>/music/bed.mp3`; the
binary itself is not committed to the repo, matching how narration
`.mp3`s are already handled).

**Design note on the "render twice" instruction.** `MUSIC` does not change
`compilePrompt`'s output or the fal call at all — the clip's own audio
block stays wordless either way (per the brief: "do not change the audio
block to ask the model for music"). Rendering the identical six clips
twice through fal to produce a `MUSIC=off` and a `MUSIC=on` version would
have paid twice for pixel-identical video. Instead, the spine was rendered
once (§3's session) and the two reels below differ only in whether the
music bed is mixed into the narration track at reel-cut time
(`scripts/reel.mjs --music`, mirroring the player's own 0.13 volume) — the
same outcome the brief asks for (an A/B pair to compare), at half the fal
cost.

## 7. Reels

Both in `<RECORDINGS_DIR>/reels/`:

- `spine-v0.3-vs-v0.4.mp4` — the v0.3 baseline (§0) on the left, the v0.4
  spine (§3) on the right, v0.4's Saskia mix as the reel's only audio
  track (built via `scripts/compare.mjs --audio-from`, a small addition
  this WP made to `compare.mjs` since its previous default was always the
  left side's own audio). 31.1s.
- `spine-v0.4-music.mp4` — the v0.4 spine with the music bed mixed in
  under the narration (`scripts/reel.mjs --narration --music`, a small
  addition this WP made to `reel.mjs`). 31.1s. `ffmpeg -af volumedetect`
  measured mean level -22.3dB (vs. -22.4dB for the no-music mix) and max
  level -1.7dB (vs. -2.0dB) — consistent with a low, present-but-unobtrusive
  bed; a proper listen is still worth Robin's ear before calling this
  tuned.

## 8. `npm run check` — overall state of the shared recordings folder

```
83 beat(s) checked, 1 without a valid source, 7 warning(s).
```

The one failure is the interrupted "What is Diginex" session discussed in
§4 (an artifact of a truncated interactive test, not a translator defect —
its complete cache-file equivalent checks clean). Every other session
either checks clean or is correctly skipped as pre-v0.4 (the v0.3 baseline
and three pre-existing v0.2/v0.3 translation caches, via the new
version-staleness skip this WP added to `scripts/check.mjs`, mirroring the
same check `app/api/translate` already made before ever serving a cache
hit). Checking any one of the required deliverables individually
(`node scripts/check.mjs ../tessera-recordings/<spine-or-live-translation-session>`)
returns clean.

## Acceptance criteria — self-assessment (Builder; not the Reviewer's word)

1. Translator emits `scene`, `events`, `hand`, `labels`, bookend; `npm run
   check` enforces all and passes on the exemplar. **Met.**
2. Sheet v0.4 in `CLAUDE.md` and `lib/prompt.ts`; copy list carries
   labels. **Met** (plus the unplanned line 3/4 addition in §5).
3. Spine measurements (events, hand, labels, accumulation, bookend).
   **Met**, all thresholds exceeded (§3).
4. `MUSIC` switch works, ducked under the voice, source and licence
   recorded. **Met** (§6).
5. Both reels exist; report contains the counts and contact sheets.
   **Met** (§3, §4, §7).
6. No people in any clip; `npm run check` clean. **Not met.** The v0.4
   spine itself is people-free and `npm run check`-clean. But across the
   two live translations, three clips (Resulticks beats 6 and 7, sharing
   one root cause; ESG-competitors beat 7, a separate occurrence) show
   recognisable human faces — a real CLAUDE.md rule 6 violation, not
   caught by `npm run check` (which validates the translator's text
   output, not the rendered pixels). A style-sheet mitigation is in place
   and verified clean on one full re-render of the same content (§5), but
   one clean re-render is evidence, not proof the underlying model
   tendency is gone — this criterion should not be signed off as passed
   until Robin/PM decide the mitigation is sufficient or more is needed.
   `npm run check`'s one FAIL (§8) is an unrelated, explained artifact,
   not a rule-6 issue.
