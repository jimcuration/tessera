# WP6.1 — Staging test: reference-grade stage directions, six spine beats

Owner: Builder · Status: Briefed · Depends on: main at 5420f1b or later (v0.3 sheet). One hour. Runs in the WP6 worktree or its own; recordings are shared.

Read `CLAUDE.md` first.

## Why

v0.4 added type and got clutter; v0.5 removed elements and got austerity. The reference gets its complexity from *staging*: 3–4 objects in a causal relationship, described at ~150 words per composition, with one small headline. Our beats describe a subject in ~30 words. This test renders six beats written by the PM at reference length to see whether the model delivers the reference's density when given reference-grade direction. No sheet or translator changes; this is about the prompt body.

## What to build

1. Add `data/translations/spine-staged.json`: the six beats below in the standard beat schema, with `action` carrying the full stage direction verbatim, `headline` as given, `ground` per scene (violet for beats 1–2, magenta for 3–4, lime for 5–6), `handoff` as given, `source` copied from the current pinned exemplar beat by beat.
2. The compiler already writes `action` into the prompt after the sheet; confirm the full text survives into the compiled prompt uncompressed. If `lib/prompt.ts` truncates or summarises `action`, remove that for this run.
3. Render once: saskia, chain on, MUSIC on, v0.3 sheet as on main. Also render once with chain off.
4. Contact sheets at 1 s / 3 s / 5 s; the two clips as reels; `expanded_prompt` for every clip saved as always.
5. `briefs/WP6.1-report.md`: per clip — elements present vs described (count), relationship legible (yes/no, one line why), headline exact and small (yes/no), stray lettering (count), faces (count); how much of each stage direction survived into `expanded_prompt`.

## The six beats

**Scene 1 — violet**

**Beat 1.** Headline `$1.85M`. Handoff: the coin stack.
> Soft violet ground. Centre frame, a black-and-white halftone paper stack of coins, torn white edge, about a third of the frame tall, casting a small paper shadow to the lower right. From the left, an anonymous paper hand enters holding one more coin between finger and thumb, sets it on top of the stack, and withdraws. As the coin lands, a small cream paper chip printed "$1.85M" slaps down in the upper third, right of centre, clear of the stack, and holds. The stack stays exactly where it is. Nothing else in frame.

**Beat 2.** Headline `$3.11M`. Handoff: the shorter stack.
> Same violet ground, same coin stack centre frame. A cream paper strip printed nothing lies behind it like a shelf. The paper hand enters from the right, pinches the top third of the stack, and lifts it clean away out of the top of the frame, leaving a shorter stack. Where the removed coins were, a thin black paper arrow drops in from above and points down at the shorter stack. The chip "$3.11M" replaces the previous chip in the same upper-third position with a quick paper flip. Hold on the shorter stack and the arrow.

**Scene 2 — magenta**

**Beat 3.** Headline `$1.3M / MONTH`. Handoff: the calendar strip.
> Deep magenta ground. The frame opens on the shorter coin stack, now small at the left edge. A cream paper calendar strip — a row of six plain blank squares, no numerals — unrolls from the stack toward the right across the middle of the frame. As each square passes, a single halftone coin slides off the stack and drops off the bottom of the frame, one per square, so the stack shrinks as the strip lengthens. The chip "$1.3M / MONTH" sits in the upper third, centred. Hold with the strip fully out and the stack down to a few coins.

**Beat 4.** Headline `1.4 MONTHS`. Handoff: the torn stub end.
> Deep magenta ground. A black-and-white halftone paper airliner, torn white edge, sits centre-left with its nose pointing right, resting on a long cream paper strip that runs off the right edge of the frame — the runway. An anonymous paper hand enters from the right, grips the far end of the strip and pulls; the strip tears away in one motion, leaving the aircraft's nose hanging over open magenta with only a short stub of runway beneath it. A small cream chip printed "1.4 MONTHS" lands in the upper third, left of centre, well clear of the aircraft. The frame holds on the aircraft at the edge of the stub.

**Scene 3 — lime**

**Beat 5.** Headline `+$13.8M`. Handoff: the taped runway.
> Lime green ground. The aircraft and the torn runway stub, centre-left, as before. From the right, the paper hand slides in a fresh length of cream strip and presses it against the torn end; two small pieces of paper tape snap down across the join. The runway now runs off the right edge again. As the tape lands, a black paper chip printed "+$13.8M" in cream slaps into the upper third, right of centre. The aircraft rolls a few centimetres forward along the repaired strip and holds.

**Beat 6.** Headline `NEXT 2 QUARTERS`. Handoff: the pointing hand.
> Lime green ground. The repaired runway runs across the middle; the aircraft has rolled to the right third of the frame. Two blank cream paper calendar pages, no numerals, flip in from the top and land side by side above the runway, left of centre. The paper hand enters from below and points at the second page, finger resting on it. The chip "NEXT 2 QUARTERS" sits in the upper third, above the pages, small. Hold on the hand pointing.

## Acceptance criteria

1. The full stage direction for each beat is present in the compiled prompt (checked in the recording JSON).
2. Six chained clips rendered and recorded with expanded prompts; contact sheets at 1/3/5 s.
3. Report states, per clip, elements present vs described, relationship legible, headline exact, stray lettering, faces.
4. No people in any clip.
5. Reel of the six chained beats with Saskia and music.

## Handoff

`briefs/WP6.1-handoff.md`. Do not mark criteria as passed.
