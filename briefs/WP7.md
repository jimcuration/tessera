# WP7 — Replicate the reference: transitions back, three modern palettes

Owner: Builder · Status: Briefed · Depends on: main (v0.3 sheet) plus WP5.1 if merged; `data/translations/spine-staged.json` from branch `wp6.1`. Own worktree; recordings shared.

Read `CLAUDE.md`, then `briefs/reference/halftone-science-short-sheet.jpg` and the reference prompt in `briefs/reference/reference-prompt.md` (Robin to add: the full prompt that produced the halftone short). Then `briefs/WP0-report.md` §5 and §7 (chained transitions) and `briefs/WP6.1-report.md`.

## Goal

Robin: "completely replicate that reference style, retain the transitions, pull the colours into a more modern palette." Materials and headlines stay as they are. This brief changes three things and nothing else.

## 1. Transitions back (`lib/prompt.ts`, `CLAUDE.md`, `lib/translator.ts`)

- Delete the layout law line (headline owns the upper third) and the exit instruction (previous elements leave in the first second) from the sheet and from the translator prompt.
- Restore WP0 behaviour: with `CHAIN=on`, each beat opens on the previous beat's closing composition and *transforms* it. The translator's `handoff` names the shape the beat ends on; the next beat's `action` begins by transforming that shape. Add one sheet line from the reference: "Cuts are shape-match cuts: the closing shape of one composition becomes the opening shape of the next."
- Headline occlusion is accepted. Do not add rules to prevent it.

## 2. Sheet v0.6 — the reference's words

Replace the surface and motion lines of the sheet with the reference prompt's VISUAL SYSTEM and MOTION PRINCIPLES paragraphs, adapted only as follows: the character is removed (subjects are objects, machines, buildings, maps, coins, screens, vehicles that carry no livery, and the anonymous paper hand as the recurring actor); the colour names are replaced by the palette variables below; the sentence on faces is replaced by our rule-6 wording. Keep it as numbered lines. Keep the copy list block and the wordless audio block. Keep 12-word lines, `scene`, `hand`, `delivery`, source pointers.

Beat content: use the six staged beats from `spine-staged.json` (WP6.1) as the spine — their stage-direction density is part of the reference's look. Remove any "exit" clauses from them.

## 3. Palette test

Make the palette a config (`PALETTE=a|b|c`) that substitutes the colour names in the sheet and the ground names in the beats:

- **A — Electric Curation:** grounds lime `#C8F135`, cyan `#2BD9F0`, violet `#8A5CF6`, magenta `#E8338C`; chips black and warm white `#FFF8E7`; ribbons in the ground's contrasting colour from the set.
- **B — Reference:** grounds cobalt `#2252FF`, orange `#FF6728`, yellow `#FFE14A`; chips black and cream; ribbons in the other two.
- **C — Mono-plus-one:** grounds alternate deep near-black `#0E0E0F` and warm white `#FFF8E7`; one hot accent orange `#FF6728` for ribbons and chips; type black on white grounds, cream on black.

Hex values go into the sheet as names *and* hex (the reference prompt does this). Scene grounds map onto each palette's set in order.

## 4. Render and compare

- Spine, chained, Saskia, music, once per palette: three sessions.
- `reels/spine-palette-a-b-c.mp4`: the three side by side, one audio.
- `reels/spine-v0.3-vs-v0.6-b.mp4`: v0.3 baseline (shared recordings, WP5) beside palette B, for the transition comparison.
- `briefs/WP7-report.md`: per clip — seam quality (does beat N open on beat N−1's closing composition and transform it? yes/no, from first-frame vs previous last-frame), headline visible at mid-clip (yes/no; occlusion is reported, not failed), elements present vs described, stray lettering, faces (or gate hits if WP5.1 is in); survival grid for the new lines; contact sheets first/mid/last frame per clip per palette.

## Out of scope

Materials (halftone, torn edges stay). Headlines to the player. Face gate (WP5.1). Console.

## Acceptance criteria

1. Layout law and exit rule are gone from sheet and translator; the shape-match line is present.
2. Chained spine: ≥ 5/6 beats open on the previous closing composition and transform it (first frame ≈ previous last frame, then a change), per palette.
3. Sheet v0.6 lines derived from the reference prompt survive in `expanded_prompt` ≥ 15/18 per line, per palette.
4. `PALETTE` switch works without code changes; hex values appear in compiled prompts.
5. Both reels exist; report has the per-clip table and contact sheets.
6. No people in any clip.

## Handoff

`briefs/WP7-handoff.md`. Do not mark criteria as passed.
