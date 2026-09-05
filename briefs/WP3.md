# WP3 — Style Sheet v0.3, Saskia delivery, strip fix, voice logging

Owner: Builder · Status: Briefed · Depends on: WP2 and WP4 done (both reviewed 4 Sept). Runs alone in the checkout.

Read `CLAUDE.md` first (it now carries sheet v0.2 and rule 8), then `briefs/WP2-report.md` §6 and `briefs/WP2-review.md`.

## Goal

Make the clips more varied and less clumsy, make Saskia sound like a presenter, and close two gaps the reviews found. This is the version the team sees on Sunday.

## Robin's notes this brief answers

"The animation style works and is elegant. Refine with more elements and more variety. The text is too big and feels clumsy." On the voice: the three ElevenLabs settings profiles were audibly identical; the expressive model is better natively and much better with expression tags, but they can be overdone.

## 1. Strip fix (do first, ten minutes)

`lib/curation.ts` drops the record's `card`. Pass it through so the strip shows `dgnx · $1.38 · +1.47% · $37.83m` before the disclosure when a record has one. Verify in the browser.

## 2. Style Sheet v0.3

Edit the v0.2 sheet in `CLAUDE.md` and `lib/prompt.ts`. Keep it numbered; keep every line a description. Changes only:

- **Line 3 (subjects)** — append: "Every cutout is matte paper reflecting only the room light, with a plain blank face: coin rims, document faces, screens and vehicle sides carry no lettering, numerals or marks." Then **delete the standalone glow line (v0.2 line 6)**; its content now rides inside line 3, which survives 18/18.
- **Line 4 (elements)** — widen the vocabulary: "flat matte paper shapes and ribbons, tape, rubber stamps, string and pins, stencilled arrows, paper bar charts, stacked sheets, grid paper, torn strips, hole-punched tags, paper clips, in cream, black, pale yellow or the ground's contrasting colour, with real paper texture and print dots."
- **Line 8 (headline type)** — replace "large" with: "one line, no wider than a third of the frame width, on a small paper chip; the chip sits clear of the subjects." Add a separate sentence for the hero number: "When the beat marks a hero number, that number alone may be printed larger, up to half the frame width."
- **New line (scale)** — "Compositions vary in scale from beat to beat: some show one oversized subject filling the frame, some a small subject alone on open ground, some several elements arranged as a diagram."
- **Line 10 (format)** — leave as is; it barely survives and the API enforces it anyway.

Renumber. Update `scripts/report.mjs` line names to match.

## 3. Translator v0.3 (`lib/translator.ts`)

- Add `hero: true|false` to the beat schema; at most one hero beat per programme, and only where the line carries the answer's central figure.
- Add `scale: "oversized" | "small" | "diagram"` to the beat schema; the translator varies it across the programme and never repeats the same value three times in a row.
- Widen the visual director's element vocabulary to match sheet line 4.
- Add `delivery` to the beat schema: the `line` text with expression tags in square brackets. Rules in the prompt:
  - Whitelist: `[presenting to camera]`, `[excited]`, `[fast-paced]`. No other tags.
  - At most one tag per line. Most lines carry none. Roughly three tags in a six-beat programme: `[presenting to camera]` on the opener, one `[excited]` or `[fast-paced]` on the hero beat or a turn, none on the close.
  - A flat line is better than an over-acted one.
- `npm run check` and the Whisper scorer use `line`, never `delivery`; add a check that `delivery` with tags stripped equals `line` exactly, and that tags come only from the whitelist.
- Update the pinned exemplar with `hero`, `scale` and `delivery`.

## 4. Saskia voice route (`app/api/voice/route.ts`)

- Switch to ElevenLabs' current expressive model (the one that honours square-bracket audio tags). Send `delivery`, not `line`.
- Wire explicit `voice_settings` so the live app matches what is tested (start from the account default; WP2 showed the three profiles were audibly indistinguishable, so do not spend time tuning them).
- **Record every request**: model, voice id, settings, text sent, duration, to `recordings/<session>/voice-<n>.json` beside the mp3. Save-everything is a hard rule; the WP2 settings pass broke it.
- Concurrency stays at two.

## 5. Render and measure

Same three spine sessions as WP0/WP2 plus the two live translations, under v0.3. `briefs/WP3-report.md` with the WP2 tables side by side, plus:

- survival grid v0.3 (the glow content is now judged inside line 3)
- headline width: fraction of frame width at mid-clip, per clip (target ≤ 1/3 except hero)
- element variety: count of distinct element types across the six spine clips (v0.2 baseline from the contact sheets)
- lettering outside the copy list, per clip (WP2: 6/18)
- two Saskia reels: `spine-saskia-v0.3-plain.mp4` (expressive model, no tags) and `spine-saskia-v0.3-tagged.mp4` (with translator tags). Robin picks by ear.
- one live-translation reel with the tagged voice, so the team hears a real answer, not the exemplar.

## Out of scope

Console finesse (WP4.1). Director. Reference-to-video. Palette hex (still pending Jim).

## Acceptance criteria

1. Strip shows the ticker line for records with a `card`, disclosure always.
2. Sheet v0.3 in `CLAUDE.md` and `lib/prompt.ts` as specified; no standalone glow line.
3. `npm run check` fails a `delivery` whose stripped text differs from `line`, or that uses a tag outside the whitelist; passes on the updated exemplar; at most one hero and no three-in-a-row `scale` values per programme.
4. Voice route uses the expressive model, sends `delivery`, and records every request as JSON beside the mp3.
5. Headline width at mid-clip ≤ 1/3 of frame on ≥ 15/18 non-hero spine clips.
6. Lettering outside the copy list appears in fewer clips than WP2 (6/18), counts stated.
7. Both Saskia reels and the live-translation reel exist; the report states which beats carry tags.

## Handoff

`briefs/WP3-handoff.md`: what changed, how to run it, what is untested. Do not mark criteria as passed.
