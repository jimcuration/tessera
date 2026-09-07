# WP6.1 handoff — reference-grade stage directions, six spine beats

Built in a new worktree, `../tessera-wp6.1` (branch `wp6.1`), off `main` @
`5420f1b` — **deliberately not** the existing `../tessera-wp6` worktree,
which is already mid-flight on style-sheet v0.5 (`WP6.md`); this brief
depends on v0.3, the sheet on `main`. Not merged. Full detail and
measurement is in `briefs/WP6.1-report.md` — this file is what changed, how
to run it, and what is not verified. **Do not treat anything in "Not
verified / open" below as passed** — the brief itself says not to mark
criteria as passed, and I haven't.

## What changed

**`data/translations/spine-staged.json`** (new): the six beats from
`briefs/WP6.1.md`, in the standard `Beat` shape. `action` carries each
stage direction verbatim (80–110 words vs. our usual ~30). `headline`,
`ground` (violet/violet/magenta/magenta/lime/lime), `handoff` and scene
grouping are exactly as specified in the brief — note scene 3 is lime, not
the pinned exemplar's bookending violet, so this programme deliberately
does not bookend. `source` is copied from the pinned exemplar
(`data/translations/a14c3cdf...json`) beat by beat, and I checked it
against the real captured answer's sentences directly (`lib/curation.ts`,
"What is the cash position and runway?") rather than trusting the copy —
all six indices check out. `line`/`delivery`/`hero`/`scale` aren't
specified by the brief; I carried them over unchanged from the pinned
exemplar, since these beats stage the identical underlying facts and
inventing new ones would risk drifting from what the answer actually says
(CLAUDE.md's translator rule). `hand` is set from whether the stage
direction itself names the hand acting (true on 5 of 6; only beat 3 has no
hand in it). One hand-fix versus the brief's text as drafted: beat 6 lists
four `subjects` in the brief; `validateBeat`'s 3-subject cap
(`lib/translator.ts`) would silently drop one on ingestion, so I trimmed
it to three myself — keeping the paper hand (it acts in the action) and
dropping "the repaired runway" (redundant with the handoff already carried
from beat 5). This file is not wired into `app/api/translate`'s cache
lookup (its filename isn't the sha1 of any captured answer, deliberately —
that hash already belongs to the real pinned spine and I didn't want any
risk of collision); `scripts/check.mjs` still scans it because it globs
every file in `data/translations/`.

**`scripts/render-staged.mts`** (new): a headless renderer for a
hand-authored beats file, modelled closely on `scripts/render.mts`. The
only structural difference: instead of streaming `/api/translate`, it
reads the beats file directly and calls `lib/curation.ts#getAnswer` for the
real `sentences` array (so the session record and `validateBeat`'s
source-bounds check mean something), then runs every beat through
`validateBeat` before rendering. Everything downstream — `generateClip`,
`lastFrameOf`, the `/api/record` and `/api/voice` posts, the session
manifest shape — is copy-identical to `render.mts`, so
`scripts/check.mjs`, `report.mjs`, `reel.mjs` and `contact-sheet.mjs` all
work on its output with no changes of their own. No changes to
`lib/prompt.ts`, `lib/translator.ts`, or any `app/api/*` route — per the
brief, this WP is about the prompt body, not the sheet or translator.

**Confirmed, not changed**: `lib/prompt.ts#beatBlock` already writes
`Action: ${beat.action}` with no truncation — verified directly (a small
throwaway script, not committed) that the full text of every one of the 6
actions survives verbatim into the compiled prompt, and again from every
recorded clip's `n.json#prompt`. Nothing needed removing from
`lib/prompt.ts` for this run.

**Renders**, both in `<RECORDINGS_DIR>` (`../tessera-recordings/`, shared
across checkouts/worktrees per CLAUDE.md rule 8):
- Chained (i2v), Saskia, MUSIC=on (record tag):
  `20260905-132552-spine-staged-saskia-chain-on/`
- Unchained (t2v), Saskia, MUSIC=on (record tag):
  `20260905-132702-spine-staged-saskia-chain-off/`

Contact sheets at 1/3/5s for both (`<session>/contact-{1,3,5}.jpg`). Reels:
`reels/spine-staged-chain-on.mp4` (the required deliverable — Saskia
narration + the WP5 music bed mixed in, 31.1s) and
`reels/spine-staged-chain-off.mp4` (same recipe, for comparison).
`node scripts/check.mjs` on the translation file and both sessions: one
failure everywhere, and only one — the deliberate scene-3-is-lime bookend
miss the brief specifies, not a bug. Zero other failures, zero warnings.

**The headline finding** (full writeup, `briefs/WP6.1-report.md` §3): the
cutout airliner (beats 4–6, wherever it's in frame) gets a fabricated
fuselage wordmark and tail livery in *both* sessions, with two different
nonsense wordmarks — a real style-sheet-line-3 violation, reproduced
independently twice. Notably, one of the two `expanded_prompt`s that
triggered it explicitly states "no printed markings, symbols, or text" for
that exact aircraft — so this isn't a prompt-wording or rewriter-drop
problem the way WP1/WP5's fixes were; the instruction reached the model
intact and the model overrode it anyway for this subject. I'm not treating
this as fixed or in scope to fix — see report §3 and §7 for what I think
the options are.

## How to run it

```
git worktree add ../tessera-wp6.1 -b wp6.1 <main-commit>   # already done for this WP
cp .env.local from the main checkout                        # secrets aren't tracked
cd ../tessera-wp6.1 && npm install
npm run dev -- -p 3101                                       # or any free port
npm run typecheck                                             # clean
node scripts/check.mjs data/translations/spine-staged.json    # 1 expected failure (bookend), see above
```

Render the staged beats headlessly (a browser is not required):

```
npx tsx scripts/render-staged.mts --beats data/translations/spine-staged.json \
  --voice saskia --chain on --music on --base http://localhost:3101 --suffix "spine-staged"

npx tsx scripts/render-staged.mts --beats data/translations/spine-staged.json \
  --voice saskia --chain off --music on --base http://localhost:3101 --suffix "spine-staged"
```

Contact sheets: `node scripts/contact-sheet.mjs <RECORDINGS_DIR>/<session> --at <1|3|5> --cols 3`.
Reel: `node scripts/reel.mjs <RECORDINGS_DIR>/<session> --narration --music <RECORDINGS_DIR>/music/bed.mp3 --out <file>`.

## Not verified / open — do not mark these as passed

1. **The vehicle-livery finding (report §3)** is real and reproduced twice,
   but I have not tried any mitigation for it (unlike WP5's face fix,
   which re-rendered once to check). I don't know whether a style-sheet
   wording change would even help, given the instruction already reached
   the model intact in at least one case and was overridden anyway. Needs
   Robin/PM's call.
2. **Faces**: 0 observed in the 1/3/5s samples across all 12 clips, and a
   skim of both reels, but not an exhaustive frame-by-frame check of every
   second of footage.
3. **Headline width** (report §5): several non-hero beats visibly exceed
   the "no wider than a third" rule, consistent with the gap WP3/WP6
   already flagged and deferred to WP3.1. Measured by eye from compressed
   contact sheets, not pixel-measured — directional, not exact.
4. **The chain-on/chain-off material-continuity observation** (report §4 —
   the unchained runway drifting from paper strip to photographic asphalt)
   is one clean example on one beat, not a systematic study; I'm reporting
   it because it's a clear, on-topic illustration of why CLAUDE.md's
   chaining design exists, not as a measured rate.
5. **Whisper word-match, render-time/cost stats**: `scripts/report.mjs` ran
   clean on both sessions (render-time and expanded-prompt-line-survival
   numbers are in it, in `../tessera-recordings/`, not reproduced in the
   report beyond what's relevant) but no `whisper.json` was generated
   (`scripts/whisper-match.py`, Python, not run) — out of scope per the
   brief, which asks for the report content listed in "What to build" §5
   only.
6. **The style sheet, translator, console, and everything else outside
   `data/translations/spine-staged.json` and the new render script** were
   not touched and not re-tested — out of scope by the brief's own framing
   ("No sheet or translator changes; this is about the prompt body").

## Acceptance criteria

See `briefs/WP6.1-report.md` §7 for the full per-criterion self-assessment
with evidence. Summary: criteria 1, 2, 3, 5 have direct evidence and read
as met to me; criterion 4 (no people) has no counter-evidence in what I
checked but wasn't checked exhaustively frame-by-frame. **I am not marking
any criterion as passed** — that's explicitly left to review, per the
brief.
