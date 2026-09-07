# WP7 — Report

Built in `../tessera-wp7` (branch `wp7`, off `main` @ `5420f1b`), reading
`briefs/reference/reference-prompt.md` (added by Robin mid-build — the
brief's dependency was missing at session start; see the handoff) and
`briefs/WP6.1-report.md`. Recordings in the shared `<RECORDINGS_DIR>`
(`../tessera-recordings/`), all 5 September 2026, MiniMax H3 Max Turbo on
fal, 480P, 16:9, 5s.

Sessions (spine `data/translations/spine-v0.6.json`, Saskia, chained, music on):

| palette | session |
|---|---|
| A Electric Curation | `20260905-144934-spine-v0-6-saskia-chain-on-palette-a` |
| B Reference | `20260905-145034-spine-v0-6-saskia-chain-on-palette-b` |
| C Mono-plus-one | `20260905-145129-spine-v0-6-saskia-chain-on-palette-c` |

v0.3 baseline used for the transition comparison: `20260905-095626-diginex-v0-3-baseline-saskia-chain-on`
(pre-existing in the shared recordings dir — style-sheet-v0.3, Saskia, chain
on, the same question, 6 beats; not a WP7 render).

Reels (`recordings/reels/`): `spine-palette-a-b-c.mp4` (the three palettes
side by side, one audio track — palette A's narrated+music mix, chosen
arbitrarily since the brief asks for one shared track, not each side's
own), `spine-v0.3-vs-v0.6-b.mp4` (v0.3 baseline left, v0.6 palette B right,
palette B's narrated+music mix as the shared audio — same pattern WP5 used
for its v0.3-vs-v0.4 reel, `scripts/compare.mjs`'s own doc comment). Also
built, not required by the brief but used as the two reels' audio source
and useful on their own: `spine-v0.6-palette-a.mp4`, `-b.mp4`, `-c.mp4`
(each palette's own six beats, Saskia + music, 31.1s).

`node scripts/check.mjs` on all three sessions plus `data/translations/spine-v0.6.json`:
one failure, everywhere, and only one — `final beat's ground "lime" does
not bookend scene 1's ground "violet"`. That is WP6.1's own deliberate
scene-3 deviation (its spine does not bookend; briefs/WP6.1-report.md §0),
carried over unchanged into `spine-v0.6.json`, not a new bug. Zero other
hard failures, zero warnings, across all 18 rendered beats + 6 translation
beats.

## 0. What changed from spine-staged.json

`data/translations/spine-v0.6.json` is WP6.1's six beats with two edits
(full diff in the file's own `note`): the one headline-chip "replaces the
previous chip" exit clause (beat 2) is cut, per item 1; and every beat's
hardcoded ground-colour name ("Soft violet ground.", "Deep magenta
ground.", "Lime green ground.", plus three hardcoded chip-material colours)
is replaced with palette-neutral phrasing ("The ground holds its colour
from the previous shot." / "The ground changes colour for this new
scene." / a plain "paper chip"). This second edit isn't in the brief's
text but is required by it: v0.3's sheet always rendered `ground: violet`
as literally violet, so WP6.1's stage directions could safely say "Soft
violet ground." — but v0.6 resolves `ground` through whichever `PALETTE`
is active, so a beat that hardcodes "violet" would contradict the sheet's
own ground line under palettes B and C. Caught before rendering by
compiling a sample prompt for all three palettes and reading it (not by a
bad render) — see the handoff for how.

## 1. Transitions (item 1) — seam quality

Chained spine, first-frame-vs-previous-last-frame, read from the contact
sheets at `first` and `last` (`briefs/WP7-contact-sheet-palette-{a,b,c}-{first,last}.jpg`,
and per-session `contact-{first,mid,last}.jpg` in each recordings dir):

| transition | palette A | palette B | palette C |
|---|---|---|---|
| 1→2 (coin stack, chip lands) | opens on beat 1's closing stack + chip, then the hand acts | same | same |
| 2→3 (stack→arrow→calendar strip) | opens on beat 2's closing shorter-stack + arrow, then unrolls | same | same |
| 3→4 (strip→runway→airliner) | opens on beat 3's closing extended strip + chip, then the runway/airliner enter | same | same |
| 4→5 (torn stub→taped runway) | opens on beat 4's closing airliner-on-stub, then the tape lands | same | same |
| 5→6 (taped runway→pointing hand) | opens on beat 5's closing airliner + chip, then the calendar pages/hand enter | same | same |

5/5 non-opening transitions show the closing composition carried into the
next beat's opening frame, then transformed, in all three palettes — beat 1
opens cold by design (no previous handoff), so this reads as "5/6 beats
open on the previous closing composition and transform it," the brief's
own phrasing, for every palette. Headline occlusion (item 1's "do not add
rules to prevent it"): not observed in this run — every headline in every
mid-clip frame across all three palettes is fully legible and un-occluded
(§2). The brief accepts occlusion as a possible outcome, not a guaranteed
one; this run didn't produce any.

## 2. Headlines, elements, stray lettering, faces — per clip

Read from the `mid` contact sheets (`contact-mid.jpg` per session; every
headline below was checked exact against the beat's `headline` field).
Elements/relationship columns are shared across palettes — palette only
changes colour, not what's staged — with palette-specific deviations
called out.

| beat | headline | exact & legible, all 3 palettes | elements present | relationship | stray lettering / faces |
|---|---|---|---|---|---|
| 1 | $1.85M | yes | coin stack, hand (mid-place), chip | yes — hand places the coin | 0 / 0 |
| 2 | $3.11M | yes | shorter stack, arrow, chip | yes — arrow points at the stack | 0 / 0 |
| 3 | $1.3M / MONTH | yes | stack, calendar strip (six divisions, legible as squares in B/C, thin lines in A), chip | yes | 0 / 0 |
| 4 (hero) | 1.4 MONTHS | yes, "1.4" printed larger per the hero rule | airliner, runway, chip | yes — airliner resting on the runway | **airliner livery — see §3** / 0 |
| 5 | +$13.8M | yes | airliner, taped runway, chip | yes — tape visibly mends the join | **airliner livery — see §3** / 0 |
| 6 | NEXT 2 QUARTERS | yes | calendar pages, pointing hand, chip; airliner visible at frame edge in all 3 (unlike WP6.1's chain-on session, where beat 6 framed it out) | yes | **airliner livery, where visible — see §3** / 0 |

No people or recognisable faces in any of the 18 clips (mid-frame samples
plus a skim of all three reels) — CLAUDE.md rule 6 is clean on faces
specifically in this run. Coins in every palette carry a small embossed
circular/swirl mark on their face (visible in the reel screenshots and
contact sheets) — present identically in the pre-existing v0.3 baseline
session too, so not a v0.6 regression; still a minor style-sheet-line-1
("no lettering, numerals, symbols... on any tag, card") gap worth noting
alongside §3.

## 3. The airliner livery finding recurs, unchanged, despite v0.6's added clause

WP6.1 found the video model invents a fabricated airline livery on the
cutout airliner — a fuselage wordmark plus a tail marking that reads as a
logo — despite an explicit "no printed markings" instruction reaching the
model intact in its own `expanded_prompt` (`briefs/WP6.1-report.md` §3).
v0.6's sheet line 1 adds exactly the mitigation the brief asks for
("vehicles... that carry no lettering, numerals, symbols or liveries") —
and the finding reproduces anyway, in all three palettes:

- **Palette A**: a black tail emblem (a stylized swirl/leaf mark, not
  legible as any specific brand) on the airliner in beats 4–6, plus faint
  illegible grey marks on the fuselage near the forward door
  (`briefs/WP7-livery-zoom-a.jpg`).
- **Palette B**: the same tail emblem shape (a simpler arrow/swirl mark),
  beats 4–6.
- **Palette C**: the tail emblem again, plus — this time clearly legible —
  a fuselage wordmark reading **"UNS/EDAAMS"** (nonsense text, not a real
  or client airline; compare WP6.1's "CESAIRAMUR" and "ADAISIIAASIM",
  same failure shape, third independently-generated fake livery) visible
  from beat 4 onward (`briefs/WP7-contact-sheet-palette-c-last.jpg`,
  `briefs/WP7-livery-zoom-c.jpg`).

This is the same finding WP6.1 reported, reproduced a third time under a
sheet that now explicitly names "liveries" as forbidden. It is not
something item 2's wording change fixed, and per WP6.1's own framing
("worth a style-sheet mitigation... a subject-vocabulary change... or
accepted as a known model limitation... is a call for Robin/PM, not this
WP") the same call still stands — now with three independent data points
instead of two, and evidence that the tail-emblem shape recurs
near-identically across renders in a way the fuselage wordmark's random
letter strings do not, which may be worth a follow-up look on its own (a
learned "aircraft cutout → this specific tail-mark shape" prior would be a
different and narrower thing to fix than "the model sometimes invents
text").

## 4. Palette system — a real limitation found in this run

`lib/palette.ts` maps `Ground` (`lime`/`cyan`/`violet`/`magenta`, fixed
indices 0–3) onto each palette's colour list by `index % list.length`, so
a palette works for any beat sequence with no per-programme code. For
palette **C** (2 colours) this produces exactly the intended alternation
(§ design comment in `lib/palette.ts`, confirmed in the render: scenes 1
and 3, both using `Ground` keys that share the same parity — `violet`
index 2 and `lime` index 0 — both land on near-black, while scene 2
(`magenta`, index 3, odd) lands on warm white; the visible result is
black→white→black, which reads as three distinct scenes because
consecutive scenes differ even though scene 1 and 3 share a colour pool).

For palette **B** (3 colours) the same arithmetic has an unintended
consequence for *this specific* beat sequence: `violet` (index 2) → `2%3=2`
→ yellow, `magenta` (index 3) → `3%3=0` → cobalt, `lime` (index 0) →
`0%3=0` → **also cobalt**. Scene 2 (magenta, beats 3–4, "the burn") and
scene 3 (lime, beats 5–6, "capital markets and the next two quarters") are
different scenes with a real topic change, but under palette B they render
as the *same* background colour — confirmed in
`briefs/WP7-contact-sheet-palette-b-last.jpg` (panels 3–6 are all blue).
This isn't a bug in the sense of broken code — the switch works exactly as
built, hex values compile correctly, `npm run check` is clean — but it is
a real gap against the show's own grammar (CLAUDE.md: "ground... held for
the whole scene... then changed at the next scene") that a 3- or
4-distinct-colour programme under a 3-colour palette can silently lose a
scene boundary, depending on which `Ground` keys the beats happen to use.
A per-programme "map in order of first appearance" scheme (considered and
rejected during the build, see the handoff, because it would require
threading the full beat list into `compilePrompt`, which the brief's
"changes three things and nothing else" scope argued against) would not
have this failure mode. Flagging for Robin/PM rather than re-rendering
mid-WP.

## 5. Style-sheet line survival (`npm run report`, all three sessions)

Corrected the report's `SIGNALS` keyword list mid-run: the first pass
showed line 2 (ground) at 0/18, which contradicted the raw `expanded_prompt`
text I was reading by hand (which clearly names the ground colour every
time, e.g. "a flat, matte, single-color paper background in electric
violet (#8A5CF6)") — the original keyword list only looked for v0.3-era
phrasing ("block-colour", "flat ground") that fal's rewriter doesn't
actually use for v0.6's wording. Added the phrases actually observed
("single-color", "unbroken block", "paper ground/background") to both
`lib/prompt.ts#STYLE_SHEET_SIGNALS` and `scripts/report.mjs`'s mirror
before trusting the numbers below.

| line | A | B | C | total | ≥15/18? |
|---|---|---|---|---|---|
| 1 visual system (reference-derived) | 6/6 | 6/6 | 6/6 | 18/18 | yes |
| 2 ground | 6/6 | 6/6 | 6/6 | 18/18 | yes |
| 3 paper diagram | 6/6 | 6/6 | 6/6 | 18/18 | yes |
| 4 shape-match cuts | 1/6 | 1/6 | 1/6 | 3/18 | **no** |
| 5 headline type | 6/6 | 6/6 | 6/6 | 18/18 | yes |
| 6 motion (reference-derived) | 6/6 | 6/6 | 6/6 | 18/18 | yes |
| 7 16:9, 5s, one comp | 0/6 | 0/6 | 1/6 | 1/18 | **no** |

The two lines actually "derived from the reference prompt" (item 2's own
language — VISUAL SYSTEM as line 1, MOTION PRINCIPLES as line 6) both clear
15/18 comfortably, in every palette. Lines 4 and 7 don't, but neither is
reference-derived: line 4 is the brief's new shape-match sentence (added
by item 1, not adapted from the reference), and line 7 is the unchanged
v0.3 technical-spec line. Both are consistent with pre-existing findings,
not new regressions: v0.3's equivalent technical-spec line measured 7/18
in WP0 ("usually reduced to `[Shot 1]`," WP0-report.md §6) — v0.6 measures
even lower here, but the same *kind* of line (duration/cut-count/aspect
metadata) has never survived reliably in this repo's measurements. Reading
the raw `expanded_prompt` text, the shape-match *behaviour* is honoured
structurally almost every time (§1's continuity table) even where the
literal phrase "shape-match" doesn't appear — the rewriter narrates the
continuity ("the scene opens on `<Picture 1>`... the ground instantly
transitions to...") without naming the technique. Whether that distinction
(behaviour present, phrase absent) satisfies acceptance criterion 3's
"lines... survive" is a call for review, not this report — the number is
reported as measured, not argued away.

## 6. Cost

18 new clips × 5s × $0.025/s = $2.25 of video (post-promo H3 Max Turbo,
per WP0-report.md §2's stated rate; I did not re-verify fal's dashboard).
Plus 18 ElevenLabs narration lines (~6 per palette, same six lines repeated
three times). Render time p50 2.86–3.01s/clip, max 3.56s, in line with
WP0/WP6.1's numbers.

## 7. Acceptance criteria — self-assessment (not marking any as passed)

1. **Layout law and exit rule gone from sheet and translator; shape-match
   line present.** `lib/prompt.ts`'s v0.6 sheet has no layout-law/exit
   line; the new line 4 is the brief's exact sentence. `lib/translator.ts`
   rule 9 no longer requires stating how the previous chip leaves, and the
   exemplar's five "previous chip..." clauses are cut. I'd call this met;
   leaving the "not passed" call to review.
2. **Chained spine: ≥5/6 beats open on the previous closing composition
   and transform it, per palette.** 5/5 non-opening transitions, all three
   palettes (§1).
3. **Sheet v0.6 lines derived from the reference prompt survive ≥15/18 per
   line, per palette.** The two reference-derived lines clear it in all
   three palettes (§5); the two other new/unchanged lines (shape-match,
   technical spec) do not, consistent with a pre-existing pattern for that
   kind of line (§5).
4. **`PALETTE` switch works without code changes; hex values appear in
   compiled prompts.** Confirmed — `--palette a|b|c` (or `PALETTE=` for the
   live path), no code touched between runs, hex present in every sampled
   prompt and `expanded_prompt`. §4 is a real design-level gap in the
   mapping, not a failure of this criterion as literally written.
5. **Both reels exist; report has the per-clip table and contact sheets.**
   `reels/spine-palette-a-b-c.mp4` and `reels/spine-v0.3-vs-v0.6-b.mp4`
   both exist (§ intro); §2's table plus the six `briefs/WP7-contact-sheet-*.jpg`
   files (first/last per palette; `mid` also generated per session, not
   copied into `briefs/` to keep the diff small — read from
   `../tessera-recordings/<session>/contact-mid.jpg`).
6. **No people in any clip.** None observed (§2) — same caveat as WP6.1:
   checked via first/mid/last samples plus a reel skim, not exhaustive
   frame-by-frame.

**Open, not something this WP fixed:** the airliner livery (§3, now a
third independent occurrence) and the palette-B scene-colour collision
(§4) are both calls for Robin/PM, not resolved here.
