# WP6 — Style v0.5: restraint, locked palette, scale as the event

Owner: Builder · Status: Briefed · Depends on: WP5 merged to main (infrastructure only; sheet is v0.3, labels removed, MUSIC default on). Runs alone or in its own worktree; recordings are shared.

Read `CLAUDE.md` first, then `briefs/WP5-report.md` and the Decisions Log entries D29 and D30 (paste in `briefs/decisions-D29-D30.md` if not present). Look at the three references in `briefs/reference/`: the halftone short contact sheet (structure to copy), the v0.4 frames (what not to do), and the flat-vector spot frames (discipline to copy, not idiom).

## Goal

v0.4 lost the clean feeling of the reference by adding things. v0.5 is v0.3 plus restraint, written as hard limits — because limits are what the model obeys — and rendered beside v0.3 so Robin and the team can judge.

## What the references agree on

- One subject dominates each composition. The subject changes scale; the scene does not change subject.
- One headline at most. Any labels are tiny or absent. Most of every frame is open ground.
- A locked palette: ground, one dark, one hot. Three colours plus cream and black, for the whole piece.
- Energy comes from scale changes and cuts, not from adding elements.
- The piece ends where it began.

## 1. Style Sheet v0.5 (`CLAUDE.md`, `lib/prompt.ts`)

Start from v0.3. Keep numbered, descriptive. Changes:

- **Line 2 (ground):** "One deep block-colour paper ground fills the frame for the whole programme: [ground], as specified. At least half of the frame is open ground at every moment."
- **New line — palette lock:** "The programme uses exactly three paper colours besides black and cream: the ground, one dark paper (black or the ground's deep shade) and one hot accent paper (saturated orange). Ribbons, arrows and chips use only these."
- **Line 3 (subjects):** keep v0.3 text; remove "hole-punched tags" from line 4's vocabulary. Add to line 3: "One primary subject is the largest element in the frame, larger than any chip or headline."
- **Headline line:** "At most one headline per beat, four words or fewer, printed once on a small paper chip that is never larger than the primary subject. No other lettering anywhere: no labels, no tags, no figures except the one headline."
- **New line — scale:** "Across a scene the primary subject changes scale between beats: shown whole, then as a close detail filling the frame, then small on open ground. Cuts are hard; the subject does not change."
- **Hand:** "An anonymous paper hand may enter once per scene for a single gesture — a press, a point, a pull — then leaves."
- Keep v0.3's motion, light, matte-in-line-3, format and identity-anchor lines. Remove any remaining v0.4 accumulation or type-on-black text.

Copy list block: "On-screen text: [headline or none]. Printed complete and correct from its first visible frame and never changing. It is the only lettering in the frame."

## 2. Translator v0.5 (`lib/translator.ts`)

- **`ground` is chosen once per programme**, not per beat; the schema keeps the field but `npm run check` fails a programme with more than one ground value.
- **`accent`** (programme-level): the hot paper colour, chosen once.
- **`scale`** per beat: `whole | detail | small`; within a scene, consecutive beats must differ; a scene of 3 uses all three.
- **`hand`**: at most one beat per scene has `hand: true`.
- **Headline**: ≤ 4 words; a programme prints any given figure once — `npm run check` fails a repeated figure across beats. Headline may be null; the translator is told that a beat with a strong picture needs no headline, and that at least one beat per programme has none.
- **`labels`** stays removed. **`events`**: reduce to one `action` clause per beat again (v0.3 behaviour), keeping the exit rule only at scene boundaries.
- Keep: 12-word lines, `delivery` with the tag whitelist, `scene`, bookend, people never in `subjects`, source pointers.
- Update the pinned exemplar.

## 3. Render and compare

- Render the Diginex spine under v0.5 (saskia, chain on, MUSIC on) and the two live translations.
- Cut `reels/spine-v0.3-vs-v0.5.mp4`: the WP5-recorded v0.3 baseline on the left, v0.5 on the right, v0.5 audio.
- `briefs/WP6-report.md`: survival grid for changed lines; per clip at mid-frame — open-ground fraction (estimate by ground-colour pixel share), primary subject larger than headline (yes/no), lettering outside the copy list (count), scale as specified (yes/no), hand count per scene, one ground per programme (yes/no), bookend (yes/no); contact sheets at mid-frame; face-gate hits if WP5.1 has landed, otherwise a manual face check of every clip.

## Out of scope

Headline width sizing beyond the "smaller than subject" rule (WP3.1). Console. Director. Palette hexes (use deep versions of the WP0 names; Jim's values replace them).

## Acceptance criteria

1. Sheet v0.5 in `CLAUDE.md` and `lib/prompt.ts` as specified; no labels, accumulation or type-on-black text remains.
2. `npm run check` fails: more than one ground per programme, a repeated figure, consecutive same `scale` in a scene, more than one `hand` per scene, a headline over four words; passes on the updated exemplar.
3. Six v0.5 spine clips at mid-frame: ≥ 5 have ≥ 50% open ground; 6/6 have the primary subject larger than the headline; ≤ 1 clip with lettering outside the copy list; `scale` visibly as specified in ≥ 4.
4. One ground colour across the programme; final beat bookends scene 1.
5. No people in any clip.
6. The side-by-side reel exists; the report contains the counts and contact sheets.

## Handoff

`briefs/WP6-handoff.md`: what changed, how to run it, what is untested. Do not mark criteria as passed.
