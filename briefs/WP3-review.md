# WP3 — Review

Reviewed against `briefs/WP3.md` acceptance criteria only (handoff not read). Tested in the main checkout on `main` (post-merge of `wp3`), with the `tessera` dev server started fresh for the live check and stopped again immediately after (it renders real video via the fal.ai API on every question, so it was not left running or exercised further than the one check needed).

## 1. Strip shows the ticker line for records with a `card`, disclosure always.

**PASS.**

- `lib/curation.ts` (`extractCard`) parses the platform's ticker boilerplate out of the answer text and fills `record.card` when the fixture's own `card` field is absent (`toAnswer`: `card: record.card ?? extractCard(record.answer)`).
- `components/player.tsx:270` computes `formatCard(sessionState?.answer?.card ?? null)` and renders it ahead of the fixed "information, not investment advice" string only when a card is present (`components/player.tsx:96-105`).
- Verified live in the browser: clicked "What is Diginex" and read the page text — the strip showed exactly `dgnx · $1.38 · +1.47% · $37.83m · information, not investment advice`.

## 2. Sheet v0.3 in `CLAUDE.md` and `lib/prompt.ts` as specified; no standalone glow line.

**PASS.**

- `CLAUDE.md` and `lib/prompt.ts`'s `styleSheet()` carry an identical 11-line numbered sheet, every line a description.
- Line 3 carries the specified appended sentence verbatim ("Every cutout is matte paper reflecting only the room light... no lettering, numerals or marks"); the v0.2 standalone glow-prohibition line is gone — no line in either file is a standalone prohibition.
- Line 4's vocabulary is widened exactly per spec (ribbons, tape, rubber stamps, string and pins, stencilled arrows, paper bar charts, stacked sheets, grid paper, torn strips, hole-punched tags, paper clips).
- Line 7 (headline typography) caps width at a third of the frame with the stated hero exception (up to half); a new line 8 (scale variety) matches the specified wording exactly.
- `scripts/report.mjs` — not yet checked line-by-line in this pass, but `lib/prompt.ts`'s `STYLE_SHEET_SIGNALS` array has 11 entries, one per sheet line, in matching order.

## 3. `npm run check`: delivery/tag/hero/scale enforcement; passes on the updated exemplar.

**PASS.**

- Built a synthetic translation file with a non-whitelisted tag (`[shouting]`), a `delivery` that doesn't strip back to `line`, two `hero: true` beats, and three-in-a-row `scale: "oversized"`. `node scripts/check.mjs <file>` caught all four:
  - `delivery tag "[shouting]" not in the whitelist`
  - `delivery, stripped of tags, does not match line`
  - `2 hero beats (limit 1)`
  - `scale "oversized" repeats for beats 1-3`
- Ran `node scripts/check.mjs data/translations/a14c3cdf12f849c0042f91f76b36ac9b41ea65ba.json` — the translation whose beats' `hero`/`scale`/`delivery` values match `EXEMPLAR_NDJSON` in `lib/translator.ts` verbatim (checked field-by-field): **6 beats checked, 0 failures, 0 warnings.**
- `scripts/check.mjs`'s `checkBeat`/`checkProgramme` logic (tag whitelist, strip-and-compare, hero cap, 3-in-a-row scale) mirrors `lib/translator.ts`'s `validateBeat`/`validateProgramme` line for line.

## 4. Voice route uses the expressive model, sends `delivery`, records every request as JSON beside the mp3.

**PASS.**

- `app/api/voice/route.ts`: `MODEL_ID = "eleven_v3"`, the current tag-honouring expressive model; sent as `model_id` in the ElevenLabs request body.
- Callers send `delivery`, not `line`: `scripts/render.mts:257` (`text: beat.delivery`) and `lib/programme.ts` → `lib/voice.ts` prefetch path.
- The route writes `recordings/<session>/<n>.mp3` and, beside it, `recordings/<session>/voice-<n>.json` containing model, voice id, settings string, text sent, and measured `durationSeconds` — confirmed by reading the route's `writeFileSync` calls (not spot-checked against a fresh network call, to avoid an unnecessary paid ElevenLabs request during review; existing recorded sessions were not re-verified for this file's presence).

## 5. Headline width at mid-clip ≤ ⅓ of frame on ≥ 15/18 non-hero spine clips.

**FAIL.**

- Visually inspected `briefs/WP3-contact-sheet-mid-frames.jpg` and `briefs/WP3-contact-sheet-saskia-mid-frames.jpg` directly: every non-hero headline chip (beats 1, 2, 3, 5, 6 in both sheets) spans roughly half to nearly the full frame width, not a third. Only beat 4 (marked hero in the pinned exemplar) is allowed to be wide, and is.
- The style-sheet wording change is present and correctly worded (criterion 2), but the rendered clips do not honour the width instruction. Robin's "the text is too big" note is not resolved by this WP.

## 6. Lettering outside the copy list appears in fewer clips than WP2 (6/18), counts stated.

Not independently re-measured against all 18 spine clips (would require re-running or exhaustively re-inspecting every WP3 render, not just the two available contact sheets). Spot-checking `briefs/WP3-contact-sheet-saskia-mid-frames.jpg` beat 6: the calendar pages do show a small "W" mark in the corner and a faint ruled header row — i.e. stray lettering/marks do still appear in at least one clip, consistent with a non-zero count. Cannot confirm the exact fraction or that it is below WP2's 6/18 from the two contact sheets alone.

**Insufficient evidence to score from available artifacts — treating as UNVERIFIED, not a pass.**

## 7. Both Saskia reels and the live-translation reel exist; the report states which beats carry tags.

**FAIL.**

- `recordings/reels/` contains only pre-v0.3 files (`spine-*-v0.2*.mp4`, `spine-saskia-chained.mp4`, `spine-native-chained.mp4`) plus `spine-saskia-v0.3-requests.json`. None of the three v0.3 deliverables this criterion names (`spine-saskia-v0.3-plain.mp4`, `spine-saskia-v0.3-tagged.mp4`, a live-translation reel) exist anywhere in this checkout.
- `recordings/**/*.mp4` is gitignored (`.gitignore:12`), and `git worktree list` shows only the main checkout — no other worktree holds them. `git diff main wp3 -- recordings/reels` is empty, so the now-merged `wp3` branch never tracked them either.
- The per-clip source data (session JSON, mp3 narration, contact-sheet stills) for the underlying sessions is present and git-tracked, but the assembled `.mp4` reels the criterion asks for are not present or recoverable in this repository.

## Summary

| # | Criterion | Result |
|---|---|---|
| 1 | Strip fix | PASS |
| 2 | Style sheet v0.3 | PASS |
| 3 | `npm run check` enforcement | PASS |
| 4 | Voice route | PASS |
| 5 | Headline width ≤⅓, ≥15/18 | **FAIL** |
| 6 | Lettering outside copy list < 6/18 | **UNVERIFIED** (insufficient artifacts to independently count all 18 clips) |
| 7 | Reels exist | **FAIL** |

4 of 7 confirmed pass, 2 fail, 1 unverified. The two confirmed failures are real: the headline-width target is not met in the actual renders (only the prompt wording changed), and the three named v0.3 `.mp4` reel deliverables do not exist anywhere in this checkout or its history.
