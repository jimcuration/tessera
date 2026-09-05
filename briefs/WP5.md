# WP5 — Style v0.4: scenes, event rate, protagonist hand, type on black, music bed

Owner: Builder · Status: Briefed · Depends on: WP3 merged to main (3ea6a60). Runs alone in the checkout or in its own worktree.

Read `CLAUDE.md` first (sheet v0.3, rule 8, Notes), then `briefs/WP3-report.md`. Then watch the reference: `briefs/reference/halftone-science-short.mp4` and its contact sheet `briefs/reference/halftone-science-short-sheet.jpg` (Robin will add both; if absent, ask).

## Goal

Make a six-beat programme feel like one piece instead of six clips. The reference does this with four things our clips don't do: it accumulates events within a composition, it groups compositions into colour scenes, it uses a recurring actor, and it bookends. Implement those, plus saturated grounds and Curation type-on-black, and render the Diginex spine under v0.4 beside v0.3 for Robin and the team to judge.

## What the reference does (from the contact sheet)

- 15 s, four compositions, four ground colours. Each composition holds ~4 s and builds: 3–4 events, roughly one per second (subject present → hand arrives → ribbon shoots out → headline slaps in → subject reacts).
- Elements persist and pile up within a composition; nothing exits until the match cut to the next.
- A paper finger/hand is the recurring actor.
- All type is cream or yellow on black paper chips; small data chips (labels, tags, a tiny chart) accompany the headline.
- It ends on its opening composition with one thing changed.
- Saturated cobalt / orange / yellow grounds; black; cream.

## 1. Translator v0.4 (`lib/translator.ts`)

Add to the beat schema and prompt:

- **`scene`** (integer). Beats are grouped into scenes of 2–3 consecutive beats sharing `ground` and a persistent primary subject. A six-beat programme has 2–3 scenes. Scenes change on a topic turn, with a match cut on the previous beat's `handoff`.
- **Within a scene, elements accumulate.** The prompt states which prior elements remain (the primary subject always; ribbons and chips from earlier beats stay in place) and only the *new* elements enter. The exit rule from v0.2 applies only at scene boundaries.
- **`events`** replaces the single `action`: exactly three timed moves per beat — `[0–1.5 s] enter`, `[1.5–3.5 s] act`, `[3.5–5 s] react or label lands` — each one short clause. The compiler writes them as a timecoded mini beat-sheet in the prompt.
- **`hand`** (boolean): the anonymous paper hand is the recurring actor and appears in at least half the beats — pressing, pointing, pulling a ribbon, tapping the number, sliding a chip in.
- **`labels`**: up to two short data chips per beat (≤ 3 words or one figure each), verbatim from the cited sentence, in addition to the headline. All go in the copy list.
- **Bookend**: the final beat returns to scene 1's ground and primary subject with one element changed or added; its `handoff` is the opening composition's named shape.
- Keep: 12-word lines, `hero`, `delivery` with the tag whitelist, people never in `subjects`, source pointers.
- `npm run check`: fails a programme whose scenes are shorter than 2 or longer than 3 beats, a beat without exactly three events, a `labels` string not found in the cited sentence, or a final beat whose `ground` ≠ scene 1's. Update the pinned exemplar.

## 2. Style Sheet v0.4 (`CLAUDE.md`, `lib/prompt.ts`)

Edit v0.3. Keep it numbered and descriptive. Changes:

- **Grounds (line 2):** "One deep, saturated block-colour paper ground fills the frame: saturated lime, deep cyan, rich violet or deep magenta, as the beat specifies. The ground holds its colour for the whole scene." Use deep versions of the WP0 names as placeholders; Jim's hexes replace them as a one-line edit.
- **Type (headline line):** "All headlines and labels are cream or pale-yellow extra-bold sans-serif printed on black paper chips. Headline chip one line; label chips small, two words or a figure; every chip slaps into place as a piece of paper and then holds." (Headline width remains a WP3.1 question; do not spend time on it here.)
- **New line — accumulation:** "Within a scene the composition accumulates: elements already in place stay exactly where they are while new elements arrive; the frame is fuller at the end of the beat than at the start."
- **New line — the hand:** "An anonymous paper hand, black-and-white halftone with a torn white edge, is the recurring actor: it presses, points, pulls ribbons and slides chips into place, entering from the frame edge."
- **New line — one hot ribbon colour:** "Ribbons and diagram elements use one hot contrasting paper colour per programme (a saturated orange or red-orange), plus cream and black."
- Keep everything else from v0.3.

Copy list block gains the labels: "On-screen text: [headline], [label 1], [label 2]. These strings are printed complete and correct from their first visible frame and never change. They are the only lettering in the frame."

## 3. Music bed (A/B)

Add a `MUSIC=on|off` switch (default off). On: the player plays a low music bed under Saskia — plucked bass and marimba register, sparse, ducked −12 dB under the voice, looping. Source one royalty-free or generated track (fal or ElevenLabs music generation are both fine; record the prompt and licence in `recordings/music/`). The video's own audio block stays wordless with paper-slap effects. Do not change the audio block to ask the model for music.

## 4. Render and compare

- Render the Diginex spine under v0.4 (`saskia`, `chain on`) twice: `MUSIC=off` and `MUSIC=on`. Render both live translations under v0.4.
- Cut `recordings/reels/spine-v0.3-vs-v0.4.mp4`: v0.3 spine (from WP3's recordings) on the left, v0.4 on the right, Saskia audio from v0.4.
- Cut `recordings/reels/spine-v0.4-music.mp4`.
- `briefs/WP5-report.md`: survival grid for the new lines; events observed per beat at 1 s / 3 s / 5 s frames (target 3); labels rendered exactly (count); hand present (count); accumulation held within scenes (count of scene-internal beats where prior elements remained); bookend achieved (yes/no); contact sheets at 1 s, 3 s, 5 s for every clip.

## Out of scope

Headline width (WP3.1). Console (done). Director. Reference-to-video. Palette hexes.

## Acceptance criteria

1. Translator emits `scene`, `events` (three, timed), `hand`, `labels`, and a bookend; `npm run check` enforces all as specified and passes on the updated exemplar.
2. Sheet v0.4 in `CLAUDE.md` and `lib/prompt.ts` as specified; copy list carries the labels.
3. Across the six v0.4 spine clips: ≥ 4 show three distinct events across the 1 s / 3 s / 5 s frames; ≥ 3 show the hand; every label string renders exactly; scene-internal beats keep prior elements in ≥ 3 of 4 cases; the final beat bookends scene 1.
4. `MUSIC` switch works; the bed sits under the voice without masking it; the source and licence are recorded.
5. The two reels exist and the report contains the counts above with contact sheets.
6. No people in any clip; `npm run check` clean.

## Handoff

`briefs/WP5-handoff.md`: what changed, how to run it, what is untested. Do not mark criteria as passed.
