# WP7 — Handoff

Branch `wp7`, worktree `../tessera-wp7`. Full measurements in
`briefs/WP7-report.md`; this is what was built, how to run it, and what's
untested.

## Blocker hit and resolved mid-build

The brief depends on `briefs/reference/reference-prompt.md` ("Robin to
add"), which did not exist anywhere in the repo or its git history at the
start of this session — not on `main`, not in any worktree. I stopped and
asked how to proceed rather than reverse-engineering the reference's
VISUAL SYSTEM/MOTION PRINCIPLES wording from the stills/video alone; Robin
added the file to `main` mid-session and I pulled it into this worktree
(it's still untracked on `main` as of this writing — someone should `git
add` it there). Everything in item 2 below reads from the real file.

## What was built

**Item 1 — transitions.** `lib/prompt.ts`: v0.3's line 6 (headline chip
owns the upper third; previous elements clear in the first second) is
gone. `lib/translator.ts` rule 9: no longer requires stating how the
previous headline chip leaves; the exemplar's five "The previous chip
slides off/flips away/is covered/flips down as..." clauses are cut to
just the shape transformation. `CLAUDE.md`'s Style Sheet and Transitions
sections rewritten to match (with an explicit note on what was deleted and
why). `beatBlock()`'s "Opens on X, carried over... which transforms as the
action begins" wording — the actual WP0 chaining instruction — needed no
change; it was v0.3's *sheet* line 6 fighting it, not this line.

**Item 2 — sheet v0.6.** `lib/prompt.ts`'s `styleSheet()` rewritten to 7
numbered lines. Lines 1 (visual system) and 6 (motion) are the reference
prompt's own paragraphs, adapted per the brief's three rules: character
removed (subjects are objects/machines/etc. "that carry no lettering,
numerals, symbols or liveries" — folding in WP6.1's airliner-livery
finding — plus the anonymous paper hand as recurring actor); colour names
→ whichever palette is active; the character-description sentences → this
file's existing rule-6 face wording (unchanged from v0.3, not new). New
line 4 is the brief's exact shape-match-cut sentence. Everything the brief
marks out of scope (materials, headline width cap + hero exception,
12-word lines, `scene`/`hand`/`delivery`/source, the `Beat` schema) is
untouched. `STYLE_SHEET_VERSION` is now `style-sheet-v0.6`.

Beat content: `data/translations/spine-v0.6.json` — WP6.1's six staged
beats, copied in (not imported from the `wp6.1` branch/worktree, since
this worktree is its own branch off `main`), with the one true exit clause
removed and, **an edit not spelled out in the brief but required by it**:
every beat's `action` text hardcoded a literal ground/chip colour name
("Soft violet ground.", "a black paper chip... in cream") — harmless under
v0.3 where the ground was always literally that colour, but a direct
contradiction of the sheet's own ground line once `ground` is resolved
through a palette. Caught by compiling a sample prompt for all three
palettes before spending any render budget (see "What's untested" for why
that mattered) and fixed by genericizing those six phrases to
palette-neutral stage direction. Full diff described in the file's own
`note` field.

**Item 3 — palette system.** New `lib/palette.ts`: `PaletteId = "a"|"b"|"c"`,
each with an ordered swatch list; `resolveGround(ground, palette)` maps
the translator's fixed 4-key `Ground` enum onto that list by
`GROUND_ORDER.indexOf(ground) % list.length` — a static, per-beat mapping
with no dependency on the rest of the programme, chosen deliberately so
`compilePrompt`'s existing per-beat signature didn't need the full beat
list threaded through it (the brief's "changes three things and nothing
else" read as a constraint against widening scope into `programme.ts`'s
streaming architecture). Consequence found during the actual render:
`briefs/WP7-report.md` §4 — palette B's 3 colours collide two of the
spine's four `Ground` keys onto the same colour for this specific beat
sequence. `PALETTE=a|b|c` added to `lib/config.ts`'s `Switches` (mirrors
`VOICE`/`CHAIN`/etc. exactly) and threaded through `lib/programme.ts`
(live path) and `scripts/render-staged.mts --palette` (this WP's actual
render path) into `compilePrompt`. `app/api/config` needed no change — it
already spreads `readSwitches()`. `GROUND_HEX` (the player's cursor-colour
lookup, `components/player.tsx`) is untouched on purpose — out of scope
("Console"), stays the v0.3 approximate hexes regardless of `PALETTE`.

**Item 4 — render and compare.** Three sessions (palettes A/B/C, spine
`spine-v0.6.json`, Saskia, chained, music on) rendered against a dev
server on port 3102 (`npx next dev -p 3102` — 3100/3101 are `wp6`/`wp6.1`'s
convention per `briefs/WP6.1-handoff.md`; picked 3102 as the next free
one). `reels/spine-palette-a-b-c.mp4` and `reels/spine-v0.3-vs-v0.6-b.mp4`
both built and exist in the shared recordings dir. The v0.3 baseline used
for the second reel is a pre-existing session
(`20260905-095626-diginex-v0-3-baseline-saskia-chain-on`) found already in
`../tessera-recordings/` — not rendered by this WP.

`scripts/compare.mjs` only hstacks two videos; the three-way reel needed a
throwaway third script (`scripts/_wp7-triple-compare.mjs`, same approach
generalised to 3 inputs), run once and deleted — it's not part of the
diff. If a real 3+-way comparison tool turns out to be wanted again,
that's worth writing properly rather than recreating the throwaway.

## How to run it

```
cd ../tessera-wp7
npm install                          # first time only
npx next dev -p 3102                 # or any free port; render-staged.mts defaults to :3100

npx tsx scripts/render-staged.mts --beats data/translations/spine-v0.6.json \
  --voice saskia --chain on --music on --palette a --base http://localhost:3102 --suffix "spine-v0.6"
# repeat with --palette b, --palette c

node scripts/check.mjs ../tessera-recordings/<session>          # per session
node scripts/report.mjs ../tessera-recordings/<session> [...]   # survival grid, render times
node scripts/contact-sheet.mjs ../tessera-recordings/<session> --at first|mid|last
node scripts/reel.mjs ../tessera-recordings/<session> --out <file> --narration --music ../tessera-recordings/music/bed.mp3
node scripts/compare.mjs <dirA> <dirB> --out <file> --labels "a,b" --audio-from <narrated-reel.mp4>
```

Live path (translator, not this WP's beats file): `PALETTE=a|b|c` in
`.env.local`, or leave unset for the default (A).

## What's untested

- **The live translator path with `PALETTE`.** `lib/programme.ts` and
  `app/api/config` are wired and typecheck clean, but no live-translated
  answer was actually rendered through them in this session — item 4's
  render budget went entirely to the staged spine, per the brief's own
  render plan. Worth a quick live smoke test before this ships.
- **Headline occlusion.** Item 1 accepts it rather than fighting it, but
  it didn't actually occur in any of the 18 rendered clips (`WP7-report.md`
  §1) — the "occlusion is fine" behaviour is unverified against a render
  that actually produces occlusion. Not something this run could force.
- **The airliner livery and coin-emboss findings (`WP7-report.md` §2, §3)**
  are observed, not fixed — same status WP6.1 left them in.
- **The palette-B colour-collision finding (§4)** is a design-level
  read of the mapping plus one confirming render; I did not try an
  alternate mapping (e.g. order-of-first-appearance, or reordering
  `GROUND_ORDER` per palette) to see whether it avoids the collision
  without reintroducing the whole-programme-context problem the current
  design was built to avoid.
- **`briefs/reference/reference-prompt.md` is still untracked on `main`**
  (see "Blocker hit" above) — someone should commit it there so the next
  worktree off `main` doesn't hit the same missing-dependency stop.

## Untracked in this worktree

`briefs/WP6.1.md`, `briefs/WP6.1-report.md`, `briefs/WP6.1-handoff.md` were
copied in from the main checkout at session start (they're untracked on
`main` too) purely so I could read them per the brief's own reading list;
not part of this WP's deliverable, harmless to leave or remove.
