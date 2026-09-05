# WP5 handoff — style v0.4 + shared RECORDINGS_DIR

Built in a worktree (`../tessera-wp5`, branch `wp5`) off `main` @ `3ea6a60`,
per CLAUDE.md rule 8 (the WP5.md brief itself is Robin's addition,
committed here). Not merged. Full detail and measurement is in
`briefs/WP5-report.md` — this file is what changed, how to run it, and
what is not verified. **Do not treat anything in §"Not verified / open"
below as passed.**

## What changed

**RECORDINGS_DIR** (asked for ahead of the WP5.md brief itself):
`lib/config.ts#recordingsDir`, default `../tessera-recordings` — one
folder shared by every checkout and worktree, resolved relative to each
process's own cwd so `../tessera-recordings` lands in the same sibling
folder from `Project Tessera` and from any `../tessera-<wp>` worktree next
to it. Wired into `app/api/record`, `app/api/voice`, and
`scripts/check.mjs`'s default scan. `.env.local`/`.env.example` gain
`RECORDINGS_DIR=` (optional override); CLAUDE.md rule 8, and the README,
updated. **All of this WP's own recordings live there, not in this
checkout's `recordings/`.**

**Translator v0.4** (`lib/translator.ts`, `TRANSLATOR_VERSION =
"translator-v0.4"`):
- `Beat` gains `scene` (int), `events` (exactly 3 timed strings,
  replacing `action`), `hand` (bool), `labels` (string[], 0-2).
- `validateBeat` hard-drops a beat with no `scene`, without exactly 3
  `events`, or with a `labels` entry not found verbatim (or, for a
  numeric label, by digit group) in its cited sentence(s) — unlike the
  headline-number check, there is no soft "derived count" exception for
  labels.
- `validateProgramme` additionally fails a `scene` that isn't a run of 2-3
  consecutive beats, and (multi-beat programmes only — a one-beat
  deflection is exempt by construction) a final beat whose `ground`
  doesn't match scene 1's.
- `deflectionBeat` and the pinned exemplar (`EXEMPLAR_NDJSON` +
  `data/translations/a14c3cdf...json`, both updated — "update the pinned
  exemplar" from the brief means both places) moved to the new shape.
  The exemplar's three scenes: {1,2} violet, {3,4} magenta, {5,6} violet
  — beats 5-6 moved from v0.3's lime to violet so the programme bookends.
- `scripts/check.mjs` mirrors every new rule, plus (new) skips a session
  or cached translation recorded under an earlier `TRANSLATOR_VERSION`
  instead of failing it against v0.4's rules retroactively — otherwise
  this version bump alone would turn every pre-existing recording
  permanently red. `npm run check` on the exemplar: clean, 0 warnings.

**Style sheet v0.4** (`lib/prompt.ts`, `STYLE_SHEET_VERSION =
"style-sheet-v0.4"`; `CLAUDE.md`'s style sheet section mirrors it):
grounds are deep/saturated and held for a whole scene; headline+label
type moved to cream-or-pale-yellow on black chips only; three new lines
(accumulation, the recurring paper hand, one hot ribbon colour). `beatBlock`
and `compilePrompt` take a `previousScene` argument to choose between
accumulation phrasing (continuing a scene) and the old exit phrasing (a
scene boundary) — wired through both `lib/programme.ts` (the live player)
and `scripts/render.mts` (headless). `copyList` now takes `labels` and
prints them alongside the headline. `STYLE_SHEET_SIGNALS` (and its mirror
in `scripts/report.mjs`, updated to run the v0.4 fourteen-line set) extended
for the three new lines.

**One unplanned style-sheet change beyond the brief**, in direct response
to a finding (`briefs/WP5-report.md` §5): lines 3 and 4 now explicitly say
every tag, card, document and photograph is blank paper texture only,
never a face — added after a live translation's fal render put
recognisable human faces on paper "tags" whose text description
(`"four hole-punched tags"`) was completely innocuous. **Read that section
before calling CLAUDE.md rule 6 satisfied for this WP** — it's a real
finding, a plausible mitigation, one clean verification re-render, and
explicitly not something I'm marking as closed.

**MUSIC switch**: `MUSIC=on|off` (`lib/config.ts`, default `off`), a
second `<audio>` element in `components/player.tsx` (does not touch
`lib/stream.ts`, per rule 3) — plays only when `MUSIC=on`, `VOICE=saskia`,
and a programme is playing/buffering, at volume 0.13 (~-12dB under
Saskia's own 0.5). `scripts/music.mts` (run once) generated the bed via
ElevenLabs' `/v1/music` and saved it plus its prompt/licence to
`<RECORDINGS_DIR>/music/`. `app/api/music` serves it to the player (the
binary isn't committed to the repo). `scripts/reel.mjs` gained a
`--music <file>` flag and `scripts/compare.mjs` gained `--audio-from
<file>`, both small additions needed to build the two required reels
without re-rendering the spine twice (report §6 explains why — MUSIC
doesn't change the fal prompt or output at all, so the two "MUSIC=on/off"
renders the brief describes are, for the video itself, the same six
clips; the reels differ only in whether the bed is mixed in).

**Renders and reels**, all in `<RECORDINGS_DIR>`:
- v0.3 baseline spine (before touching the style sheet):
  `20260905-095626-diginex-v0-3-baseline-saskia-chain-on/`
- v0.4 spine (saskia, chain on — the pinned exemplar):
  `20260905-103727-diginex-v0-4-spine-saskia-chain-on/`
- Two live (non-cached) translations under v0.4:
  `20260905-102615-live-resulticks-v0-4-saskia-chain-on/`,
  `20260905-103447-live-esg-competitors-v0-4-saskia-chain-on/`
- Face-fix verification render: `20260905-104543-verify-face-fix-v0-4-saskia-chain-on/`
- `reels/spine-v0.3-vs-v0.4.mp4`, `reels/spine-v0.4-music.mp4`
- `music/bed.mp3`, `music/bed.json`

Two earlier sessions are superseded but kept on disk per rule 7, not
deleted: `20260905-102219-...` (an interactive-browser spine render with
an authoring bug in the exemplar's beat 4, fixed before the final spine
render — see report §1) and `20260905-102328-...` (an interrupted
interactive translation of "What is Diginex," only 5 of 10 clips
rendered).

## How to run it

```
git worktree add ../tessera-wp5 -b wp5          # already done for this WP
cp .env.local from the main checkout             # secrets aren't tracked
cd ../tessera-wp5 && npm install
npm run dev -- -p 3100                           # or any free port
npm run typecheck                                # clean
npm run check                                    # see note below
```

Render the spine or a live question headlessly (what this WP used
throughout — a browser is not required):

```
npx tsx scripts/render.mts --question "What is the cash position and runway?" \
  --voice saskia --chain on --base http://localhost:3100 --suffix "my-run"
```

Generate the music bed once (only needed if `<RECORDINGS_DIR>/music/bed.mp3`
doesn't already exist): `npx tsx scripts/music.mts`.

Cut reels: `node scripts/reel.mjs <RECORDINGS_DIR>/<session> --narration
--music <RECORDINGS_DIR>/music/bed.mp3 --out <file>`; compare two sessions
with `node scripts/compare.mjs <left> <right> --audio-from <narrated.mp4>
--out <file>`.

`npm run check` (no args) currently exits 1: one interrupted interactive
session (`20260905-102328-...`, see above) fails its bookend check because
it's a truncated 5-of-10-clip programme, not because the translator did
anything wrong (its complete cache-file equivalent, `data/translations/
91389ad5...json`, checks clean). Checking any single required deliverable
directly (e.g. `node scripts/check.mjs
../tessera-recordings/20260905-103727-diginex-v0-4-spine-saskia-chain-on`)
returns clean.

## Not verified / open — do not mark these as passed

1. **CLAUDE.md rule 6 (no recognisable people), acceptance criterion 6.**
   Real violation found and reproduced in two different live
   translations; a style-sheet mitigation is applied and verified clean
   on **one** re-render of the exact content that triggered it. This is
   evidence the fix helps, not proof the underlying model tendency (small
   paper rectangles in a "comparison"/"roster" context → photographic
   faces) is gone. Full write-up: `briefs/WP5-report.md` §5. Needs
   Robin/PM's call on whether more than a wording fix is warranted.
2. **Music bed tuning.** Verified the mechanism works end-to-end (fetches,
   plays only under the right conditions, loops, correct low volume,
   pauses/resumes correctly) and that the reel-cut mix is measurably
   present (`ffmpeg -af volumedetect`). Have not had a human listen to
   judge whether 0.13 / -12dB actually reads as "low, under the voice" or
   needs adjusting by ear.
3. **Label rendering reliability.** All labels in the final v0.4 spine
   render exactly. An earlier render of the identical beats showed one
   label garbled on a re-drawn (accumulated) chip. Not reproduced since,
   but not proven not to recur — worth watching across future renders,
   not something this WP fixed.
4. **Accumulation's denominator vs. the brief's phrasing.** The spine uses
   three two-beat scenes, giving 3 scene-internal beats, not the 4 the
   brief's acceptance criterion assumes (which fits two three-beat
   scenes). All 3 of 3 show accumulation — proportionally exceeds the
   criterion — but flagging the structural difference so it isn't read as
   a miscount. See report §3.
5. **Whisper word-match, settings passes, and anything else WP0-WP4
   measured** were not re-run for v0.4 — out of scope per the brief
   ("Out of scope: ... Director. Reference-to-video. Palette hexes."
   plus headline width, explicitly deferred to WP3.1).
6. **Console, theatre mode, and everything WP4/WP4.1 built** were not
   touched and not re-tested — out of scope ("Console (done)" in the
   brief's Out of scope list).

## Acceptance criteria

See `briefs/WP5-report.md`'s final section for the full per-criterion
self-assessment with evidence. Summary: criteria 1-5 met; criterion 6 not
met (open finding above) — **I am not marking it passed.**
