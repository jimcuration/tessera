# WP10 handoff — the translator writing brief: one person talking

Builder handoff. Per CLAUDE.md, this describes what was built and how to check it — it does **not** mark any acceptance criterion as passed; that call belongs to the reviewer.

## What was built

### 1. Structure — write the scene, then cut it (`lib/translator.ts`)

- New required `Beat` field `narration: string` — the scene's whole flowing passage, identical on every beat of the scene (the same pattern WP8.1 used for `connector`, since the NDJSON streaming protocol emits one beat object per line and has no separate scene-level message).
- `translatorSystem()`'s rule 5 now instructs the model, explicitly, to write the scene's `narration` first and only then mark beat boundaries inside it; `line` is defined as "the passage's own text between its boundaries, verbatim." Rule 19 states `narration`'s own requirements (word budget, no invented content).
- **Nothing in `lib/programme.ts`, `app/api/translate/route.ts`, or `app/api/voice/route.ts` needed to change.** `app/api/voice/route.ts` already builds a scene's full spoken text by joining each beat's own text with a single space (`sceneText`/`sceneTextForTTS`, for one ElevenLabs request per scene) — with `line`s that concatenate correctly (which the checker now enforces), that reconstruction already *is* `narration`, word for word. This is by design, not an oversight: it's why `narration` didn't need a bigger, riskier change to the streaming protocol.

### 2. Voice (`lib/translator.ts`'s `translatorSystem()`)

- A `VOICE` section, verbatim from `briefs/WP10.md` §2 (the full house-style brief: contractions, varied rhythm, "and"/"but" openers, fragments, "you"/"we", the avoid-list, and the two override rules — style is free but substance is inherited; at most one aside per scene).
- An `EXAMPLE PASSAGES` section, verbatim from `briefs/WP10.md` §3 (the three worked scene passages), with one added clarifying sentence (not altering the quoted text) noting the illustrative beat-count and ground-colour label don't always survive the real word budget/bookend rule — see "Two deviations" below.
- Rule 16 (`delivery`) is reworded to place the `[presenting to camera]`/`[excited]`/`[fast-paced]` tags at the passage/programme level (opener, turn, close) rather than describing them per isolated beat, per brief §4.
- A banned-phrase list (`BANNED_PHRASES`, brief §2's "avoid" list) fails a beat outright (`validateBeat`, hard).
- First-person opinion markers (`OPINION_MARKERS`: "I think", "I'd", "honestly I", ...) are a soft warning **unless** the beat's own cited sentence(s) contain no hedge language of their own (`HEDGE_LEXICON`), in which case it's a hard failure — brief §5's exact rule.

### 3. Checks (`npm run check`, i.e. `scripts/check.mjs`)

Mirrors everything above in plain JS (the script runs under plain `node`, not `tsx`, so it can't import `lib/translator.ts` directly — this mirroring convention predates WP10):

- `narration` presence (per beat) and — per scene, in `validateProgramme`/`checkProgramme` — agreement across the scene's beats, and that it equals those beats' `line`s concatenated with a single space (hard fail on either).
- Scene word budget: `maxSceneWords(clipSeconds) = maxLineWords(clipSeconds) * 3` — 36 at 5s, 66 at 10s/15s (hard fail).
- Banned phrases and un-hedged opinion markers (hard fail, per-beat).
- A **soft, heuristic** numeric-grounding warning: `spelledNumbersIn()` converts a spelled-out figure in `narration` back to a decimal string and checks it against the cited sentences' own digits. This is explicitly *not* a full parser or a semantic sentence-mapper — see its doc comment in `lib/translator.ts` and `briefs/WP10-report.md` §3b for two concrete false-positive patterns it has (source uses `$7B+`/`$34M` shorthand rather than full digits; a spoken year like "twenty twenty-six" doesn't reassemble into "2026"). It is the closest code-checkable proxy I could build for brief §5's "every sentence in narration maps to a cited sentence" without a much larger effort (real NLP/semantic matching), and it's why that check is a warning, never a hard failure — a hard failure here would sometimes kill an accurate beat over the heuristic's own gap, not the beat's.
- `validateProgramme`'s return type changed from `string[]` to `{failures, warnings}` — confirmed via `grep` that nothing besides `scripts/check.mjs`'s own independent mirror calls it (`app/api/translate/route.ts` only calls `validateBeat`, per-beat, live), so this was safe.

### 4. Pinned exemplars re-pinned (`data/translations/`)

- `ecc17ec....json` (15s) — a **live** v0.4.0 translation of the spine question, generated against the running dev server, promoted to pinned (`"pinned": true` + note) after `npm run check` passed on it cleanly (0 failures, 0 warnings, 11 beats / 4 scenes). This is real model output, not hand-written.
- `a14c3cdf....json` (5s) — **hand-authored** (`lib/translator.ts`'s `EXEMPLAR_NDJSON_5S`), not a live run. A live 5s attempt was tried first and read well, but dropped 3 of 12 beats for exceeding the 12-word cap, and the resulting scene gaps then failed the new narration/connector consistency checks — see `briefs/WP10-report.md` §3a/§4 for the mechanism (a pre-existing kind of fragility, not new to WP10) and the file's own note for the exact dropped lines. Using the live run would have left a pinned exemplar that doesn't pass its own checker, so the hand-authored one is pinned instead.
- Two other cache files (`1cb5e3e79....json`, `9e249802....json` — the two "live translation" test questions) were refreshed automatically by the live renders, the same way any translator-version bump stales and regenerates cache; not specially curated.

### 5. Prompt exemplars for the model itself

`lib/translator.ts` exports two NDJSON constants embedded in the prompt (`EXEMPLAR_NDJSON_5S`, 12-word/beat; `EXEMPLAR_NDJSON_WIDE`, 22-word/beat) — `translatorSystem(clipSeconds)` now picks whichever matches the clip length actually in force, so the model is never shown an example that doesn't fit its own current word budget (a real gap in the pre-WP10 prompt: one shared exemplar was used at every clip length). `EXEMPLAR_NDJSON` is kept as an alias to `EXEMPLAR_NDJSON_WIDE` so nothing importing the old name breaks (nothing outside `lib/translator.ts` did, confirmed by `grep`).

**Two deviations from brief §3's exact worked passages**, both in `EXEMPLAR_NDJSON_WIDE`'s own doc comment and needed to keep it passing `npm run check` (used the brief's exact wording otherwise):
- Scene 3's passage is 47 words; two beats at the 22-word cap hold at most 44, so it's cut into 3 beats (a 7-beat programme total, still within rule 4's 6-10), not the brief's illustrative "beats 5-6."
- Scene 3 is `violet` here, not the brief's illustrative "lime" — `validateProgramme`'s bookend rule requires the final beat's ground to equal scene 1's, and scene 1 is violet. (The brief's `EXAMPLE PASSAGES` section, quoted verbatim in the prompt, still says "lime" — I added one sentence after the quotes, not inside them, noting the bookend rule overrides the illustrative colour.)

## How to run / verify

1. `cd` into this worktree, `npx next dev -p 3110` (CLIP_SECONDS=15, from `.env.local`) for the default path; a second instance with `CLIP_SECONDS=5 npx next dev -p 3111` if you want to exercise the 5s path.
2. `npm run check` (`node scripts/check.mjs`) — scans every recording in `../tessera-recordings` and every `data/translations/*.json`. As of this handoff: `59 beat(s) checked, 7 without a valid source, 6 warning(s)` across the four new live sessions (both re-pinned exemplars pass with 0/0) — see `briefs/WP10-report.md` §3 for exactly which beats/scenes and why, before assuming any of it is a WP10 bug.
3. `npx tsc --noEmit` passes clean.
4. Render commands used (repeatable): `npx tsx scripts/render.mts --question "<question>" --voice saskia --chain on --clip-seconds 15 --base http://localhost:3110 --suffix <name>` (15 for port 3110's server; 5 + port 3111 for the 5s path — the two must agree, per `scripts/render.mts`'s own header comment, or you silently test the wrong thing).
5. Reels: `node scripts/reel.mjs <session dir> --out <path>.mp4 --narration --music ../tessera-recordings/music/bed-v2.mp3`, then `node scripts/concat-reel.mjs a.mp4 b.mp4 out.mp4` — see `briefs/WP10-report.md` §8 for the exact sessions/paths used.
6. `python scripts/saskia-split-check.py <session dir> --model medium` for split integrity (the relevant tool for a Saskia session); `python scripts/whisper-match.py <session dir> --model medium` also runs cleanly but reports 0% by design for a wordless (Saskia) clip — see report §7.

## Judgement calls made (materially changed what was built)

1. **`PALETTE=c` was not implemented.** The brief describes it as "an existing switch" to check `lib/config.ts`/`lib/prompt.ts` for; it is not — `PALETTE` appears nowhere on `main` except `briefs/WP7.md` (which specifies it as something to *build*) and this WP10 brief. WP7 was briefed but never merged (no `WP7-handoff.md`/`WP7-report.md`, no code, confirmed by `git log` and `grep -r PALETTE`). Building it from scratch here would mean implementing a different work package's whole scope and inventing colour values CLAUDE.md explicitly says not to invent without Jim's confirmation. See `briefs/WP10-report.md` §9 for the full reasoning, including a leftover `spine-palette-a-b-c.mp4` reel found in the shared recordings folder (evidence WP7 was attempted somewhere, just never merged to what this worktree is forked from).
2. **Scene 3's ground is violet, not the brief's illustrative "lime,"** in both hand-authored prompt exemplars — the bookend rule (final beat's ground must equal scene 1's) makes "lime" for scene 3 structurally impossible when scene 1 is violet. The brief's `EXAMPLE PASSAGES` quote is still reproduced verbatim in the prompt; a sentence after it (not inside the quote) flags the override.
3. **Scene 3's passage split into 3 beats, not the brief's illustrative "beats 5-6"** (2 beats), in `EXEMPLAR_NDJSON_WIDE` — the passage is 47 words and two 22-word beats can't hold it.
4. **The 5s pinned exemplar is hand-authored, not a live run** — see "Pinned exemplars" above.
5. **The numeric-grounding check ("every sentence in narration maps to a cited sentence," brief §5) is implemented as a soft, number-only heuristic, not the literal claim.** A real semantic sentence-to-sentence mapper is a materially larger undertaking (NLI/embedding-based entailment, or a second model call to verify each sentence) than this brief's scope suggested for one bullet in a checks list; I judged the concrete, checkable core of that claim — no invented figures — to be the right-sized proxy, documented its two known false-positive shapes with real examples from the actual live renders, and kept it soft specifically because those false positives are real and would otherwise wrongly kill accurate beats.
6. **"The two live translations"** were not named in the brief; I identified them from `briefs/WP5-report.md`/`WP5-handoff.md` (which introduced and named the pair) and confirmed the naming persists through later briefs' unchanged phrasing (`briefs/WP6.md`, `briefs/WP8.md`) — Resulticks and ESG-competitors-positioning. If Robin meant a different pair, only these two were rendered.

## What's untested / not verified

- **Acceptance criterion 4** ("three live-translation passages... read as one person talking... reviewer reads them against the answers") is inherently a human read; `briefs/WP10-report.md` §5 gives the reviewer the three passages and their source sentences side by side, but I did not (and per CLAUDE.md's Builder/Reviewer split, should not) declare it passed.
- **The player itself** (the actual browser UI at `theatre=on`, suggestions, interrupt/auto-continue) was not opened or tested with the new voice — all verification here is headless (`scripts/render.mts` against the dev server's API), matching the practical notes in the brief. `docs`/UI behaviour around a scene whose narration is longer/differently-paced than before (WP8.2's voice-led timing, `computeVoiceLedTiming`) was not specifically re-verified, though nothing in WP10 touches `lib/prompt.ts` or the timing code, and the split-check numbers (§7 of the report) suggest the splits still land cleanly.
- **`face-gate`** was left at its default (`off`) for every render in this WP, per `lib/config.ts`'s own documented default (WP5.1's false-positive finding) — not re-tested here.
- **Only two live-translation questions and the spine were rendered.** The other ~10 questions in `data/diginex.json` will translate live (and cache) the next time they're asked under `translator-v0.4.0`, but weren't proactively rendered or checked here.
- **The `spelledNumbersIn` number-word parser is not a general English-number parser** — it's scoped to the shapes the style guide's own examples use (see its doc comment). It was patched once during this WP (a "twenty twenty-six" spoken-year case was summing to a wrong figure, 46, before two consecutive tens/ones words were treated as a boundary instead of an addition) but almost certainly has other unhandled shapes; since it only ever produces a soft warning, this is a bounded risk, not a correctness risk to the translator itself.

## Follow-up worth flagging (not fixed here, out of scope)

When a beat is dropped mid-scene (word-budget overshoot, a person-lexicon hit, etc.), the surviving beat(s) in that scene reliably fail every scene-level consistency check that exists — WP8.1's connector/tag rules, and now WP10's narration rules. This WP found two live, real examples of it (see `briefs/WP10-report.md` §3a). Fixing it means validating a whole scene atomically before any of its beats reach the client, which touches `app/api/translate/route.ts`'s per-beat streaming design — bigger than a "keep both in sync" checker change, and out of this brief's scope. I've flagged this as a spawn-task suggestion for a separate session rather than fixing it here.

## Files touched

`lib/translator.ts` (rewritten), `scripts/check.mjs` (mirrored), `data/translations/a14c3cdf12f849c0042f91f76b36ac9b41ea65ba.json` (rewritten, hand-authored 5s exemplar), `data/translations/ecc17ec629f11bb87564de73ee03ae4a3171ca3b.json` (rewritten, live 15s exemplar), `data/translations/1cb5e3e7960d72d74569e9dca7c6a9b2c7864a7f.json` and `data/translations/9e24980da052ee34135442ffe9a0ceb3901a0520.json` (auto-refreshed by live renders), `.claude/launch.json` (pre-existing uncommitted worktree setup, committed alongside), `briefs/WP10-report.md`, `briefs/WP10-handoff.md` (this file). Nothing in `lib/stream.ts`, `lib/programme.ts`, the media proxy, or the fal server proxy was touched. New recordings and reels are in `../tessera-recordings/` (shared `RECORDINGS_DIR`), not committed to git (outside the repo).
