# WP6.1 report — reference-grade stage directions, six spine beats

Built in `../tessera-wp6.1` (branch `wp6.1`, off `main` @ `5420f1b`, v0.3 style
sheet — **not** the `wp6` worktree, which is already on style-sheet v0.5;
running there would have violated the brief's "v0.3 sheet as on main"
dependency). Recordings in the shared `<RECORDINGS_DIR>`
(`../tessera-recordings/`).

Sessions:
- Chained (i2v): `20260905-132552-spine-staged-saskia-chain-on`
- Unchained (t2v): `20260905-132702-spine-staged-saskia-chain-off`

Reels: `reels/spine-staged-chain-on.mp4` (required deliverable — Saskia +
music), `reels/spine-staged-chain-off.mp4` (comparison, same audio recipe).
Contact sheets at 1/3/5s for both sessions:
`<session>/contact-{1,3,5}.jpg`.

## 0. What was built

`data/translations/spine-staged.json`: the six PM-authored beats, `action`
carrying the brief's stage direction verbatim (80–110 words each, vs. our
usual ~30). `headline`, `ground`, `handoff` and scene grouping are exactly
as specified (scene 3 is **lime**, not the pinned exemplar's bookending
violet — this test deliberately does not bookend). `source` is copied from
the pinned exemplar (`data/translations/a14c3cdf...json`) beat by beat and
verified against the real captured answer's sentences (`lib/curation.ts`,
"What is the cash position and runway?") — indices `[9]`, `[9,10]`, `[22]`,
`[23]`, `[27]`, `[25,43]` all check out against the actual sentence text.
`line`/`delivery`/`hero`/`scale` were not specified by the brief; carried
over unchanged from the pinned exemplar since these beats stage the
identical facts. `hand` is set from whether the stage direction itself
names the paper hand acting (true on 5 of 6 — only beat 3 has no hand).
One correction from the brief's text as written: beat 6 as drafted lists
four `subjects`; `validateBeat`'s 3-subject cap would silently drop one, so
I trimmed it to three by hand, keeping the paper hand (it acts in the
action) and dropping the redundant "repaired runway" (already established
as the handoff from beat 5).

`scripts/render-staged.mts`: a new headless renderer, modelled on
`scripts/render.mts`, that loads beats directly from a JSON file instead of
driving `/api/translate` — this test's beats aren't a translator output and
aren't wired into the translate cache's sha1-of-answer lookup (this
filename isn't the hash of any captured answer, deliberately, so it can't
collide with the real pinned spine). It still calls `lib/curation.ts`'s
`getAnswer` directly for the real `sentences` array (so the session record
and `validateBeat`'s source-bounds check are meaningful), still runs every
beat through `validateBeat`, and posts to `/api/record` / `/api/voice`
exactly like `render.mts` — so `scripts/check.mjs`, `report.mjs`,
`reel.mjs` and `contact-sheet.mjs` all work on its output unchanged. No
change to `lib/prompt.ts`, `lib/translator.ts`, or `app/api/translate`.

`node scripts/check.mjs data/translations/spine-staged.json <both sessions>`:
one failure, everywhere, and only one — `final beat's ground "lime" does
not bookend scene 1's ground "violet"`. That's the deliberate scene-3
deviation the brief specifies, not a bug. Zero other hard failures, zero
warnings, across all 18 beats (6 beats × 3 targets).

## 1. Item 2: does the full stage direction survive into the compiled prompt?

Yes, unmodified. `lib/prompt.ts#beatBlock` writes `Action: ${beat.action}`
with no truncation or summarisation — confirmed by direct test
(`prompt.includes(beat.action)` true for all 6 beats before rendering) and
again from the recorded `n.json#prompt` field for all 12 rendered clips.
Nothing needed changing in `lib/prompt.ts` for this run.

**How much survived into fal's `expanded_prompt`** (its own rewritten
version of the prompt, informational only — the actual generation is
driven by the full compiled prompt, not this field): counting each stage
direction's distinctive content words (nouns/verbs, four+ letters, common
words like "the/and/frame/ground" excluded) that reappear (verbatim or as
the obvious synonym) in `expanded_prompt`:

| beat | chain-on | chain-off |
|---|---|---|
| 1 | 32/43 (74%) | 33/43 (77%) |
| 2 | 32/42 (76%) | 30/42 (71%) |
| 3 | 37/41 (90%) | 36/41 (88%) |
| 4 | 41/46 (89%) | 42/46 (91%) |
| 5 | 36/41 (88%) | 37/41 (90%) |
| 6 | 30/38 (79%) | 31/38 (82%) |

75–90% word-level survival across both sessions, consistently. What's
*lost* is mostly connective/spatial detail ("centre," "resting," "sits,"
"where the removed coins were") — the rewriter compresses staging
geometry into shorter clauses but keeps the causal beats (what enters,
what it does, what it lands on). Reading the full `expanded_prompt` text
(e.g. beat 4, quoted in full below) confirms this: every clause of the
stage direction is represented, just paraphrased and shortened.

## 2. Per-clip visual read (from the 1/3/5s contact sheets)

"Elements described" = the distinct staged elements named in that beat's
`action` (primary subject(s), the paper hand when it acts, added props like
an arrow or tape, the headline chip). "Present" = visible in *at least one*
of the three sampled seconds — a fast gesture that resolves before 1s (the
motion in this style sheet is meant to land within the first second, then
hold) can be real and still miss all three samples, so a miss here is a
sampling-window artefact as often as a rendering failure; noted per row.

### Chained (i2v) — `20260905-132552-...-chain-on`

| beat | elements present/described | relationship legible | headline exact & small | stray lettering | faces |
|---|---|---|---|---|---|
| 1 | 2/3 — stack, chip; the coin-add gesture resolves before 1s, missed by all 3 samples | yes — chip labels the stack directly, nothing else in frame | yes, exact text; **borderline on width** (~35% of frame, close to the 1/3 cap) | 0 | 0 |
| 2 | 4/4 — stack, hand (caught mid-pinch at 1s), chip, arrow | yes — hand visibly shortens the stack, arrow reinforces the decline | yes, exact; but the "torn-paper arrow" the action describes as a separate diagram element renders as a small decorative glyph glued to the chip, not a standalone shape | 0 | 0 |
| 3 | 3/3 — stack, calendar strip, chip | **partial** — burn-by-month reads at a glance but the "six plain blank squares" render as thin vertical divider lines, not countable squares, so the one-coin-per-square correspondence is hard to verify from a still | yes, exact; width ~55–60% of frame — clearly over the 1/3 cap, not a `hero` beat | 0 | 0 |
| 4 (hero) | 3/4 — airliner, torn runway stub, chip; the hand's pull is missed (withdrawn by 1s) | yes — the plane hanging off a torn stub is unambiguous and dramatic | yes, exact; ~40% width, inside the `hero` beat's 50% allowance | **1 — see §3** | 0 |
| 5 | 5/5 — airliner, runway, hand (caught at 1s), tape patch, chip | yes — the tape visibly mends the join, plane advances slightly | yes, exact; ~40% width, over the 1/3 cap (not hero) | **1 — see §3** | 0 |
| 6 | 4/5 — runway, 2 calendar pages, pointing hand, chip; **airliner not visible in any of the 3 samples** (framed out to the right) | **partial** — the hand-points-at-calendar beat reads on its own, but the throughline back to the aircraft/runway motif is weak when the plane itself is off-frame | yes, exact; widest chip of the six, ~65% of frame — clearly over the 1/3 cap | 0 (plane not in frame) | 0 |

### Unchained (t2v) — `20260905-132702-...-chain-off`

| beat | elements present/described | relationship legible | headline exact & small | stray lettering | faces |
|---|---|---|---|---|---|
| 1 | 3/3 — stack, hand (caught mid-place at 1s), chip | yes | yes, exact; similar width to chain-on | 0 | 0 |
| 2 | 4/4 — stack, hand (1s), arrow, chip | yes | yes, exact; **chip is the widest single-figure headline in either session, ~50%+ of frame** | 0 | 0 |
| 3 | 3/3 — stack, strip, chip; strip renders as **six clean, legible rectangles** — closer to the brief's "row of six plain blank squares" than the chained take's divider-line version | yes, and more legible than the chained take | yes, exact | 0 | 0 |
| 4 | 3–4/4 — airliner, runway, chip; a small grey shape at frame-right at 3s may be the hand entering, ambiguous at this resolution | yes | yes, exact; ~40% width | **1 — see §3** | 0 |
| 5 | 4/5 — airliner, runway, tape, chip; hand's slide-in not caught in samples. **Runway material drifts**: a photographic dark-asphalt runway with painted lane markings, not the cream paper strip the action specifies and that beat 4 (same session) actually used | yes for the plot beat, but the paper-collage material consistency (style sheet lines 1–3) breaks here | yes, exact; ~40% width | 0 (plane visible, unbranded in these 3 samples) | 0 |
| 6 | 5/5 — airliner (visible here, unlike chain-on), asphalt runway, 2 calendar pages, pointing hand, chip | yes — the best-composed beat in either session; every described element is on screen and legible at once | yes, exact; noticeably smaller chip than chain-on's beat 6 | 0 | 0 |

## 3. The standout finding: stray lettering is systematic, not incidental, and it survives an explicit "no markings" instruction

Every beat that puts the cutout airliner on screen — beats 4 and 5 in
*both* sessions, plus (implicitly) beat 6 wherever the plane is in frame —
shows a fabricated airline livery: a fuselage wordmark ("CESAIRAMUR" in the
chained session, "ADAISIIAASIM" in the unchained one — both nonsense
strings, not a real or client airline) and a red-and-dark tail marking that
reads as a logo. This is a direct violation of style sheet line 3
("vehicles... are blank and unprinted, with no lettering, numerals,
symbols, liveries or marks on them") and, per CLAUDE.md rule 5/6 in spirit
if not letter, an unwanted brand-like mark the video model invented on its
own.

What makes this worth flagging over the ordinary "the model sometimes adds
stray text" finding: **the instruction survived intact into what the model
actually saw**, and it still failed. Beat 4 (chained)'s `expanded_prompt`
states outright: *"Both the airliner and the runway are matte paper with
no printed markings, symbols, or text."* — fal's own rewriter correctly
paraphrased style sheet line 3's rule for this exact subject, in the exact
prompt that drove that render, and the rendered clip shows a wordmark and
tail livery anyway. This isn't a prompt-compression problem the way WP1–v0.3's
prohibition-wording fix was, and it isn't a WP5-style rewriter drop — the
rule reached the model table intact and the model overrode it. It reproduces
identically whether the beat is chained or not, and with two independently
generated, differently-worded fake liveries, which points at a model prior
("aircraft cutout" → "airliner with a livery") strong enough to beat an
explicit contrary instruction for this specific subject class, the same
general shape as WP5's tag/face finding (`briefs/WP5-report.md` §5) but for
vehicles rather than faces. It's the one CLAUDE.md rule-adjacent
compliance gap in this run; everything else observed (coins, chips, tape,
calendar squares, strips) rendered blank as directed.

**Faces: 0 across all 12 clips.** No recognisable people, no photographic
faces on any tag, card, or surface, in either session — CLAUDE.md rule 6 is
otherwise clean in this run (the vehicle livery above is a different
failure mode, not a face).

## 4. Chain-on vs. chain-off: the one difference that matters

Composition quality, headline fidelity and the stray-lettering finding are
statistically identical between the two sessions — same headlines, same
general legibility, same livery problem. The one real difference is
**material continuity across a cut**: because the chained (i2v) session
conditions each clip on the previous clip's last frame, the runway strip
stays a cream paper cutout, consistently, from beat 4 through beat 6.
Because the unchained (t2v) session regenerates every beat from the text
prompt alone with no image anchor, beat 5's "runway" drifts to a
photographic dark-asphalt tarmac with painted lane markings — a real
paper-collage/style-sheet-line-1 violation that chaining structurally
prevents. This is exactly the case CLAUDE.md's "Transitions" section
argues for image-to-video chaining; WP6.1 is a small, direct confirmation
of it on a case chaining is supposed to fix.

## 5. Headline width, briefly

Every headline printed exactly, letterforms clean and stable — the words
were never wrong. Width is a different matter: several non-`hero` beats
(chain-on beat 3, beat 6; chain-off beat 2) visibly exceed the "no wider
than a third of the frame" rule (style sheet line 7), by eye at 640px
contact-sheet resolution, up to roughly twice the specified cap on the
widest ones (chain-on beat 6, "NEXT 2 QUARTERS"). This isn't a new finding
— it's the same headline-sizing gap WP3 raised and WP6 explicitly defers to
WP3.1 — so I'm recording the observation for that WP's use, not treating it
as in scope here. Measurements are eyeball estimates from compressed
contact sheets, not pixel-measured; treat them as directional.

## 6. Full text of one clip, for the record (beat 4, chain-on)

**Action (as authored):**
> Deep magenta ground. A black-and-white halftone paper airliner, torn white edge, sits centre-left with its nose pointing right, resting on a long cream paper strip that runs off the right edge of the frame — the runway. An anonymous paper hand enters from the right, grips the far end of the strip and pulls; the strip tears away in one motion, leaving the aircraft's nose hanging over open magenta with only a short stub of runway beneath it. A small cream chip printed "1.4 MONTHS" lands in the upper third, left of centre, well clear of the aircraft. The frame holds on the aircraft at the edge of the stub.

**fal's `expanded_prompt`:**
> For the target video, at 0.00 seconds into the target video, \<Picture 1\> (from [Shot 1]) is fully referenced.
>
> integrated_multimodal_description: [Shot 1] This is a cinematic, modern editorial paper collage style, photographed as a flat lay under soft room light with a consistent light source from the upper left casting small, soft shadows beneath each paper layer. \<Picture 1\> serves as the starting frame, featuring a deep magenta flat block-color paper ground. The initial elements—a cream paper strip and a stack of halftone coin cutouts—immediately slide off-frame to the left with fast motion and a slight overshoot. Simultaneously, new elements enter the composition: a black-and-white halftone photographic cutout of a commercial airliner with rough, torn white paper edges lands center-left, its nose pointing right. The airliner rests upon a long, cream-colored paper strip acting as a runway, which extends horizontally to the right edge of the frame. Both the airliner and the runway are matte paper with no printed markings, symbols, or text. From the right edge, an anonymous black-and-white halftone paper cutout of a hand enters quickly, grips the far end of the cream runway strip, and pulls it sharply to the right. The strip tears away in one fluid motion, leaving the aircraft's nose hanging precariously over the open magenta ground with only a short stub of the cream runway remaining beneath the fuselage. In the upper third of the frame, left of center, a cream-colored paper chip lands with a fast, snappy motion; it is printed with the clean, stable, extra-bold black sans-serif text "1.4 MONTHS", where the "1.4" is printed larger as a hero number. The camera remains a Static Shot throughout the 5 seconds, holding on the oversized composition of the aircraft balanced on the torn stub of the runway.
>
> overall_soundscape: The audio consists of tactile, diegetic paper sounds. A crisp, fast paper-slap occurs as the headline chip lands, followed by a sharp, textured ripping sound as the paper runway is pulled and torn away.
>
> non_diegetic_music: N/A

The rendered clip (`4.mp4` in that session) is the one with the fuselage
wordmark and tail livery despite the rewrite's own "no printed markings"
line — see §3.

## 7. Acceptance criteria — self-assessment (not marking any as passed)

1. **Full stage direction present in the compiled prompt (checked in the recording JSON).** Verified true for all 6 beats, both sessions (§1). I'd call this met, but leaving the "not passed" call to review per the brief's instruction.
2. **Six chained clips rendered and recorded with expanded prompts; contact sheets at 1/3/5s.** Done — both a chained and an unchained session, 6/6 clips each, all with non-null `expandedPrompt`; six contact sheets (3 per session).
3. **Report states, per clip, elements present vs described, relationship legible, headline exact, stray lettering, faces.** Done, §2.
4. **No people in any clip.** No recognisable people/faces observed in either session (§3). Not exhaustively frame-by-frame verified beyond the 1/3/5s samples plus a skim of both reels.
5. **Reel of the six chained beats with Saskia and music.** `reels/spine-staged-chain-on.mp4` — narration mixed in per-beat, music bed (`../tessera-recordings/music/bed.mp3`) mixed under it via `scripts/reel.mjs --narration --music`, 31.1s.

**Open, not something this WP fixed:** the vehicle-livery finding in §3 —
real, reproduced twice independently, and shown to survive an explicit
contrary instruction reaching the model. It's the same shape of problem as
WP5's face-on-tag finding but for a different subject class ("airliner"),
and it wasn't something a wording change could plausibly have prevented
here (the instruction was already there, verified in the actual expanded
prompt). Whether it's worth a style-sheet mitigation (as WP5 did for
faces), a subject-vocabulary change (avoid "airliner"/"aircraft" for
beats where an unbranded object matters), or is accepted as a known model
limitation for this subject class is a call for Robin/PM, not this WP.
