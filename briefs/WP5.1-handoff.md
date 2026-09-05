# WP5.1 handoff — face gate: built, wired, and measured off by default

Built in a worktree (`../tessera-wp5-1`, branch `wp5-1`) off `main` @
`5420f1b`. Not merged. **Do not treat anything in "Not verified / open" or
the acceptance-criteria table below as passed** — the brief says so
explicitly and this WP is the reason why: the gate works exactly as
designed, and what it's designed to do turned out to be less safe to ship
than the brief anticipated. Read "The investigation" before anything else.

## What changed

**Face gate** (`lib/faceGate.ts`, new): after a clip renders, samples
frames at 0.5s/2.5s/4.5s (per the brief) and runs OpenCV's `FaceDetectorYN`
— a small local DNN face detector (YuNet, ~230KB ONNX, Apache-2.0, from
`opencv/opencv_zoo`, committed at `models/face_detection_yunet_2023mar.onnx`)
via `@techstark/opencv-js` (pure WASM, no native compile). No external API:
model and inference both run locally in the Node process.

**Not Haar cascade, despite the brief naming it first.** `CascadeClassifier`
does not exist in any Node-compatible build of `@techstark/opencv-js` —
dropped from the current WASM build (5.0.0), and the last version that has
it (4.10) hangs indefinitely in Node (its WASM instantiation path is
browser-only, no fallback). Robin approved switching to `FaceDetectorYN`
mid-build (still OpenCV, still local, still no separate native runtime
dependency) after confirming this. If revisiting the detector choice,
know that Haar cascade is a dead end with this package on Node — a
different package (`opencv4nodejs`, native compile) or a pure-JS Haar
implementation would be needed to actually use it here.

**Rotation sweep, not a single upright pass.** Calibrating against the
exact clips that produced WP5's finding (`briefs/WP5-report.md` §5 —
"four hole-punched tags" and "a grid of paper squares") showed the faces
are tilted at extreme, non-upright angles; YuNet's single upright pass
scored them at exactly 0 across the whole clip. An 8-angle sweep (0°,
45°, ..., 315°) per frame recovers them (scores 0.24-0.74 depending on
angle). See "The investigation" for why raw score alone still isn't
enough and what `MIN_ANGLES_AGREEING` does about it.

**Wired into two separate render paths**, both of which needed their own
copy of the same logic since neither shares code with the other:
- `lib/stream.ts` (`Stream.render`, the live player's path): after
  `generateClip` resolves and before `this.queue.push`, gated behind a
  new `faceGate: boolean` constructor param (see the switch below). A
  detection re-renders the same shot once (new seed, same prompt); a
  second detection adds the shot to `failedShots` and returns without
  queuing it — reuses the exact "drop and hold last frame" mechanism the
  catch block already had for render failures, so a dropped beat behaves
  like any other failed shot: skipped by `skipFailed()`, no blank frame,
  `lastFrame` for the *next* beat is whatever the last *accepted* clip's
  frame was.
- `scripts/render.mts` (the headless CLI path used for all prior WPs'
  measurement — it reimplements `generateClip` directly against fal,
  bypassing `lib/stream.ts` entirely per this file's own header comment):
  same retry/drop logic, gated behind a new `--face-gate on|off` flag.
  I added this because it's the tool this WP's own testing needed to use
  for reproducible results, and because rule 6 enforcement is meaningless
  if the codebase's other first-class render path skips it entirely.

**`FACE_GATE=on|off` switch, default OFF** (`lib/config.ts`), threaded
through `app/api/config` → `lib/programme.ts`'s `SessionSwitches` →
`lib/render.ts`'s `createRenderer` → `Stream`'s constructor, mirroring how
`MUSIC` already flows. **This default is the load-bearing decision in this
handoff — see "The investigation" before changing it.**

**Logging** (`lib/recorder.ts`'s new `logFaceGate`, `app/api/record/route.ts`'s
new `kind: "faceGate"` branch): one `<n>-facegate-<attempt>.json` per gate
check, written as its own file rather than merged into `<n>.json` — a
rejected clip's own `<n>.json`/`<n>.mp4` gets overwritten by the re-render
that follows it (existing `onClip`/record-route behaviour, unchanged), so
the sidecar file is what "log the event" and CLAUDE.md rule 7 ("save
everything") actually cash out to for a clip that never becomes the
beat's permanent record. Each sidecar carries the per-frame/per-angle
scores, the outcome (`clean` / `rerender` / `dropped` / `gate-error`), and
the checked clip's own metadata (`expandedPrompt`, `rawUrl`, `requestId`,
`renderMs`) so a rejected clip's data isn't just gone.

**`npm run report`** (`scripts/report.mjs`): reads every `<n>-facegate-*.json`
in a session and prints one summary line — check count, hits, re-renders,
drops, gate-error count, and latency p50/max. Verified against all three
sessions in "The investigation" (exact numbers there).

**Vocabulary** (brief item 3): removed `"hole-punched tags"` from style
sheet line 4 (`lib/prompt.ts`, `CLAUDE.md`); line 7 (headline typography)
now adds "Chips carry lettering only — never an image, photograph,
portrait or face." `STYLE_SHEET_SIGNALS` (and its mirror in
`scripts/report.mjs`) updated to match. **Not touched, deliberately**:
`lib/translator.ts` rule 8 (subject vocabulary for the translator itself)
still lists `"hole-punched tags"` as an example subject — the brief's
scope and its own "Out of scope" line both say sheet line 4 only, not the
translator, so I left it. Worth a follow-up: it's the exact phrase that
produced WP5's finding, and a translator that keeps suggesting it as
subject vocabulary will keep asking the video model to draw four small
rectangular tags in a "comparison" context — precisely the composition
WP5 found prone to this failure mode, gate or no gate.

**Dependencies**: `@techstark/opencv-js` (new, pinned `5.0.0-release.1`)
and `sharp` (moved from `devDependencies` to `dependencies` — it's now
used at runtime by `app/api/face-gate`, not just build/dev scripts) added
to `next.config.ts`'s `serverExternalPackages` alongside the existing
`ffmpeg-static` entry, same reasoning: native/WASM binaries loaded by
path, not meant to be bundled. `npm run build` passes with all three
external.

**New file**: `models/face_detection_yunet_2023mar.onnx` (232,589 bytes,
Apache-2.0, downloaded from `opencv/opencv_zoo`'s `main` branch — the repo
uses git-lfs for this file, so a plain raw-GitHub URL returns the LFS
pointer, not the binary; fetched via `media.githubusercontent.com/media/...`
instead). Committed to the repo (not gitignored, small enough not to need
lfs here).

## The investigation — why FACE_GATE defaults to off

**Offline calibration (before any live render) looked solid.** Against
the exact WP5 face-producing clips already on disk in the shared
`../tessera-recordings/` (`20260905-102615-live-resulticks-v0-4-.../6.mp4`
and `7.mp4`, `20260905-103447-live-esg-competitors-v0-4-.../7.mp4`) plus
all six pinned-spine clips (`20260905-103727-diginex-v0-4-spine-.../`,
1-6.mp4, as known-clean negatives), a single rotation-swept detection pass
couldn't separate true from false: the genuine tilted face on resulticks
beat 6 topped out at score 0.403, while a spurious detection on a
completely clean spine beat (a hand-pointing beat, no coins even) hit
0.485 — *higher* than the real face. Raw score doesn't separate them.
What does, measured across those 9 clips: the genuine face is corroborated
by multiple rotations (4-7 of the 8 canonical 45°-apart angles agree,
i.e. score ≥0.2 at that angle); every false positive found agreed at only
2-3 of 8. `MIN_ANGLES_AGREEING = 4` in `lib/faceGate.ts` sits exactly one
notch above the worst false positive measured in that set — all 9 cases
classified correctly.

**Then I ran it against fresh, live content, per the brief's own test
item 5, and the false-positive rate was severe.** Three real renders via
`scripts/render.mts --face-gate on` (all real fal/ElevenLabs spend, at
the pre-7-Sept-2026 promo rate):

| session | beats | face-gate hits | re-renders | drops |
|---|---|---|---|---|
| `20260905-151418-wp5-1-verify-resulticks-saskia-chain-on` | 10 | 1 | 1 | 0 |
| `20260905-151956-wp5-1-verify-esg-saskia-chain-on` | 8 (2 dropped by the translator's own rule, unrelated) | 2 | 1 | 1 |
| `20260905-152342-wp5-1-verify-spine-saskia-chain-on` | 6 | 4 | 3 | 1 |

**I inspected every flagged frame by eye. All five hits were false
positives. Zero were real faces.** (Frames saved alongside each session:
`1-facegate-1-frame.png` in the resulticks session; `6-facegate-1-frame.png`
and `6-facegate-2-frame.png` in the ESG session; `1-facegate-1-frame.png`
and `3-facegate-2-frame.png` in the spine session — pulled from the
rejected clip's own `rawUrl`, which the sidecar JSON preserves, before the
fal CDN link expired.)

- Resulticks beat 1: "a paper platform slab" lowering onto "a cream paper
  chip" — completely clean, no face, no person, exactly the intended
  composition. 4/8 angle agreement, score 0.283 — right at the threshold.
- ESG beat 6 (both attempts): a paper map with pins and string tying
  points together — the *exact* CLAUDE.md-approved diagram vocabulary
  (style sheet line 4), no face anywhere. 4/8 agreement both times
  (0.403, 0.342).
- Spine beats 1, 2, 3: **coin stacks** — the halftone embossed rim/relief
  pattern on a stack of paper coins, one of the style sheet's named
  approved subjects (line 3: "objects... coins"), scored 4/8 agreement
  and up to **0.654** — higher than the strongest genuine face score in
  calibration (0.744 on resulticks beat 7, but that was corroborated at
  7/8 angles; these coin false positives corroborated at only 4/8, at the
  threshold, yet still with a high raw score). The concentric rings and
  raised rim of a coin, photographed in halftone, apparently reads enough
  like an eye/iris to this detector at some rotations to pass the bar.

**No genuine face appeared in either live re-render of the two WP5
questions this time** — expected; video diffusion is stochastic, and the
brief's own item 5 anticipates re-running rather than guarantees
reproduction. This means **acceptance criteria 1 and 4 (a real detection
being caught) are untested in this round**, not failed — I have no fresh
evidence either way beyond the offline calibration against WP5's original
clips (which did work: those 3 clips classified correctly, see above).
Combined with the false-positive findings, criterion 3 (zero false
positives) **fails outright, repeatedly, on real content** — including on
a fresh render of the six-beat spine itself, the exact test the brief
names for that criterion.

**One more consequence, discovered incidentally**: `npm run check` on the
ESG and spine sessions above reports `FAIL: scene N has 1 beat(s)
(expected 2-3)` for the scenes that lost a beat to a drop. Dropping a
beat doesn't just remove one clip — it can break the translator's own
scene-grouping invariant, since the translator wrote that scene assuming
all its beats would render. Not something this WP fixes; worth knowing
before treating a "dropped" outcome as a clean, contained failure mode.

**Why off by default, not a lower threshold or fewer angles**: I did not
find a configuration in the time available that both catches the kind of
extreme-tilt, stylized face WP5 found (needs the full rotation sweep and
a threshold low enough to register 4/8 on a 0.24-score angle) *and*
excludes coins/maps at the same sensitivity — the false positives and the
weakest true positives overlap in both raw score and angle-agreement
count. A tighter fix likely needs either a better/second-opinion model,
a geometric heuristic that specifically down-weights near-circular
symmetric detections (coins), or per-content-type tuning — none of which
I built. Shipping this on by default would mean coins — a core, named,
approved subject of this style sheet — routinely trigger wasted
re-renders and occasional wrongful drops of correct, on-spec beats. That
is a worse outcome for the product than the status quo (a prompt-only
rule, unenforced in code, but not actively damaging correct content).
**The gate is real, wired, logged, and reported on — Robin/PM's call
whether to flip `FACE_GATE=on` as-is, wait for better tuning, or treat
this WP as infrastructure for a follow-up.**

## Gate latency (acceptance criterion 2) — fails, and by a lot

Measured via `npm run report` on the three sessions above: **p50 ≈
8,200-8,300ms, max 8,934ms per gate check** — not the ~150ms the brief
asks for. This isn't close enough to call a rounding difference. Two
components:
1. The rotation sweep itself: up to 3 frames × 8 angles × one
   `FaceDetectorYN.detect()` call, each involving a `sharp` rotate+decode.
   This is the dominant cost and is required for the recall the brief's
   own test case (the tilted face) needs — a single-angle pass is instant
   but scores 0 on that exact clip (see above).
2. Downloading the clip from fal's CDN before ffmpeg can seek it (both
   `app/api/face-gate` and `scripts/render.mts`'s direct call to
   `checkRemoteClipForFaces` do this) — not measured separately from (1)
   here, but real and unavoidable without changing how clips reach the
   gate.
The early-exit (stop sweeping once `MIN_ANGLES_AGREEING` is hit, stop
sampling further frames once one confirms) helps the true-positive case
but not the common clean-beat case, which is the majority of real usage
and always pays the full 24-call cost. I did not attempt to reduce this
further (e.g. fewer angles, a faster/smaller model) — flagging it rather
than picking a number that would look better without being re-validated
against the same true/false-positive set above.

## How to run it

```
git worktree add ../tessera-wp5-1 -b wp5-1     # already done for this WP
cp .env.local from the main checkout            # secrets aren't tracked
cd ../tessera-wp5-1 && npm install
npm run typecheck                               # clean
npm run build                                   # clean, confirms the new
                                                 # native/WASM deps bundle correctly
```

Gate off by default — nothing changes from pre-WP5.1 behaviour unless you
opt in. To exercise it:

```
# live player: set in .env.local (or export) before starting the dev server
FACE_GATE=on npm run dev -- -p 3100

# headless (what this WP's own testing used throughout):
npx tsx scripts/render.mts --question "What is the cash position and runway?" \
  --voice saskia --chain on --face-gate on --base http://localhost:3100 --suffix "my-run"
```

`npm run report <RECORDINGS_DIR>/<session>` prints the face-gate summary
line automatically when a session has any `<n>-facegate-*.json` files;
silent (no line printed) for sessions rendered with the gate off.

`npm run check` is unaffected by anything in this WP except as noted
above (a dropped beat can trip the pre-existing scene-size check on that
specific session — not a new rule, a pre-existing one interacting with a
new way for a beat to go missing).

## Not verified / open — do not mark these as passed

1. **Acceptance criterion 1** ("a clip with a detected face never reaches
   the queue; log shows frame, score, re-render"). The retry/drop/log
   mechanics are verified end-to-end (see the table above — real
   re-renders, a real drop, real sidecar JSONs with frame/score/outcome).
   What's *not* verified: a real face actually being caught in a live
   player session (`lib/stream.ts`'s path specifically) — all three live
   tests ran through `scripts/render.mts`, not the browser. The two code
   paths share the same `runFaceGate`/`logGate` logic shape by design but
   are separate implementations; I did not additionally drive the actual
   browser UI this round.
2. **Acceptance criterion 2** (gate latency < 150ms). Fails, measured at
   ~8,200-8,900ms per check. See "Gate latency" above.
3. **Acceptance criterion 3** (zero false positives on the six spine
   clips). Fails on a fresh live render: 3 of 6 spine beats triggered a
   detection, one beat dropped entirely. My offline calibration against
   the *old, pre-existing* spine clips showed zero false positives — that
   result did not generalize to a new render of the same content. This is
   the headline finding of this handoff.
4. **Acceptance criterion 4** (the two WP5 translations re-run, hits
   logged, no face in any played clip). Partially exercised: both
   translations were re-run (fresh live translations, not the identical
   cached WP5 beats — see note below), gate checks logged for every beat,
   and no face reached the final programme in either session (the one
   real hit self-corrected on re-render; the one drop was a false
   positive, so nothing was lost that shouldn't have rendered anyway).
   But since no genuine face appeared in either fresh render, this round
   provides no evidence about whether a *real* violation would be caught
   in the live-player path specifically (see point 1).
   **Note**: TRANSLATE_CACHE is on by default, but both cached entries for
   these two questions were written under `translator-v0.4` (WP5's schema,
   `events`/`labels`); this worktree's translator is the current
   `translator-v0.3.1`. The version mismatch means both re-renders served
   *fresh* live translations, not WP5's original cached beats — different
   beat content, different subjects, not literally "four hole-punched
   tags" or "a grid of paper squares" (those exact beats only exist in the
   old recorded `.mp4`s I used for offline calibration, not in a live
   re-render). Both data/translations cache files were overwritten with
   the fresh v0.3.1 translations as a side effect (pre-existing
   cache-version-mismatch behavior, not something this WP changed).
5. **Acceptance criterion 5** (`npm run report` shows gate counts).
   Verified — see the exact output in "The investigation."
6. **The live-player path (`lib/stream.ts`) itself.** Code-reviewed,
   typechecked, and structurally identical to the headless path that *was*
   tested live, but not separately exercised through the actual browser
   UI this round, given the false-positive finding made further live
   spend (this time through the browser) a lower priority than writing
   this up accurately.
7. **`FACE_GATE=off` (the default) path.** The guard is a single `if
   (this.faceGate)` / `if (faceGate === "on")` around already-tested code
   — reasoned through and typechecked, not re-verified with a fresh paid
   render, since the risk surface is materially smaller than the gate
   logic itself.
8. **`lib/translator.ts` rule 8's `"hole-punched tags"` vocabulary.** Not
   touched (out of scope per the brief), but it's the literal phrase that
   caused WP5's original finding and nothing here prevents a future
   translation from writing it into a beat's `subjects` again.

## Acceptance criteria

1. A clip with a detected face never reaches the queue; log shows frame,
   score, re-render. **Mechanism verified; a genuine live catch is not** —
   see "Not verified" #1.
2. Gate latency under 150ms per clip, measured. **Not met.** Measured at
   ~8,200-8,900ms.
3. Zero false positives on the six spine clips. **Not met on a live
   render** — 3 of 6 spine beats flagged, one dropped.
4. The two WP5 face-producing translations re-run with hits logged and no
   face in any played clip. **Partially met** — re-run, logged, no face in
   the final programme, but the two catches produced were both false
   positives on different (fresh) beat content, not the original faces —
   see "Not verified" #4.
5. `npm run report` shows gate counts. **Met** — verified output above.

**I am not marking this WP as passed.** The infrastructure (detector,
rotation sweep, retry/drop logic, two wired render paths, logging,
reporting, the `FACE_GATE` switch) is real, working, and — most
importantly — *off by default* precisely because turning it on
unconditionally would trade a rare, hard-to-catch rule-6 violation for a
frequent, easy-to-trigger degradation of ordinary correct content. That
trade isn't one I'm willing to make silently by shipping a misleadingly
green checklist; it's Robin/PM's call, made with the actual numbers above.
