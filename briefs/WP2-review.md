# WP2 — Review

Reviewed against `briefs/WP2.md` acceptance criteria only (handoff not read first). Tested by reading `CLAUDE.md`, `lib/prompt.ts`, `lib/translator.ts`, `scripts/check.mjs`, `app/api/voice/route.ts`, `lib/voice.ts`, `components/player.tsx`/`screen.tsx`, `scripts/saskia-settings.mts`, `scripts/reel.mjs`; running `npm run typecheck` and `npm run check` (whole tree and targeted files); a synthetic people-lexicon test; extracting and hashing decoded PCM audio from the three Saskia settings reels; silence-detecting the chained Saskia reel; and diffing the pinned exemplar against `lib/translator.ts`'s in-code exemplar and the CLAUDE.md style sheet against the brief's, both line-by-line in code. Did not run `npm run build` — a dev server is live on port 3000 in this checkout (CLAUDE.md rule 8 forbids building alongside a running dev server; the report itself documents hitting this hazard mid-WP).

## 1. Style sheet v0.2 in `CLAUDE.md` and `lib/prompt.ts`; `expanded_prompt` has no bare prohibition lines

**PASS.**

- `CLAUDE.md`'s 11 numbered lines match the brief's verbatim (programmatic line-by-line diff, 11/11 match).
- `lib/prompt.ts`'s `styleSheet()` returns the same 11 lines verbatim (manual comparison against `CLAUDE.md` and the brief).
- Scanned `expandedPrompt` across all 39 clips rendered today under v0.2 (the three spine sessions + two live translations) for standalone sentences starting "No ..." at ≤8 words (a bare-prohibition shape): **0 found**. Every "no glow", "no lettering" etc. instance appears folded into a descriptive sentence, matching the brief's intent.

## 2. `npm run check` fails over-budget lines, fails people-in-subjects, warns on derived counts; passes on the updated exemplar

**PASS.**

- Ran `npm run check` against the full tree: correctly FAILs every beat over 12 words (confirmed against dozens of v0.1-era recordings still on disk, e.g. 14–19-word lines), and correctly warns on derived headline counts (e.g. `headline number "4" not stated as a figure in cited sentences (ok if a derived count)`).
- Synthetic test: a beat with `subjects: ["a CEO figure", ...]` is hard-FAILed (`subject "a CEO figure" names a person (matches "figure")`) — the people-lexicon check fires as specified.
- `npm run check data/translations/a14c3cdf12f849c0042f91f76b36ac9b41ea65ba.json` (the pinned spine exemplar) passes clean: 6 beats, 0 failures, 0 warnings. Verified this file is byte-for-byte identical (JSON-equal) to `EXEMPLAR_NDJSON` in `lib/translator.ts`.
- Note, not a failure: `npm run check` with no target fails loudly (146/397 beats) because `recordings/` and `data/translations/` still hold v0.1-era artifacts kept for the WP0/WP2 comparison — expected, and the report says so.

## 3. `VOICE=saskia` default; audio generated per line, starts on clip's first frame

**PASS.**

- `lib/config.ts`: `voice: pick<VoiceSwitch>(process.env.VOICE, ["native", "saskia"], "saskia")` — saskia is the fallback default.
- `app/api/voice/route.ts` generates one ElevenLabs call per beat line (`text` = one beat's line), not per programme.
- Code path for "starts on first frame": `components/screen.tsx`'s `play()` calls `video.play()` at `currentTime = 0` and then `onStarted(clip)` in the same call; `components/player.tsx`'s `onStarted` calls `live.narrator.play(clip.shot.n)` right there — narration for beat N is triggered at the exact moment clip N's video is told to play from frame 0, not on a timer.
- Independent check on the actual recorded reel: silence-detected `recordings/reels/spine-saskia-chained-v0.2.mp4` — no `silence_start` at t=0; the first silence gap begins at 4.06s (after line 1 finishes), confirming line 1's narration is present from the first frame with no lead-in gap.

## 4. Three Saskia settings reels exist

**PASS.** `recordings/reels/spine-saskia-v0.2-{a,b,c}.mp4` all present.

## 5. `WP2-report.md` has side-by-side tables; survival grid shows every v0.2 line ≥15/18

**FAIL, as the report itself states.** The side-by-side tables are present and complete (§1, §3, §6, §7 vs WP0). But the survival grid in §6 shows three lines below the 15/18 threshold: line 6 ("no glow/neon/bloom") at **7/18** (worse than v0.1's 11/18), line 10 (16:9/5s/one cut) at **6/18**, and line 11 (identity anchor) at **14/18**. The report names this explicitly ("Acceptance criterion 5 ... is not met") and gives a plausible explanation (line 6 still carries a literal prohibition clause even though it's appended to a description; line 10 is a technical/format instruction fal's rewriter drops regardless of phrasing). This is an honest, well-evidenced fail, not a discrepancy I need to chase further — the numbers in the table are internally consistent with the counting method used in WP0.

## 6. Chained headline exact-at-mid-clip ≥5/6 under v0.2, or explained

**PASS.** §7's table: native chain-on 6/6 (up from WP0's 4/6), saskia chain-on 5/6 (down from WP0's 6/6, one new miss — beat 2's headline chip never renders). Both chained sessions individually clear the ≥5/6 bar. The report also correctly flags and explains the saskia regression (a dropped chip, not a layout-law failure) rather than hiding it.

## 7. Lettering outside the copy list — fewer clips than WP0, counts stated

**PASS.** WP0 baseline (`WP0-report.md` §7): extra text described as present across effectively all 18 spine clips ("extra text on every calendar, coins, documents, aircraft... all runs"). WP2 §7 states 6/18 clips with a stated per-session breakdown (native chain-on 3/6, saskia chain-on 2/6, native chain-off 1/6) and per-beat detail. Fewer clips, count stated, consistent with WP0's own §7 wording that I cross-checked directly.

## Saskia settings finding (additional check requested)

**The three reels' final audio is not byte-identical — confirmed genuinely different, not just re-encoded.** Extracted each reel's audio to raw PCM (`ffmpeg -vn -acodec pcm_s16le`) and hashed: three distinct SHA-256 hashes, despite identical decoded byte-length (2,709,582 bytes each, i.e. identical total duration, as expected since all three reuse the same video). This rules out "same audio, different container/encode" and confirms the ElevenLabs calls actually produced different speech per profile.

**No per-line MP3s or request JSON were saved for the settings pass, and none currently exist on disk to inspect.** `scripts/saskia-settings.mts` synthesizes each profile's six lines into a temp directory (`os.tmpdir()/tessera-saskia-<profile>-<timestamp>`), mixes them into the reel, then deletes the temp directory (`rmSync(work, { recursive: true, force: true })`) — nothing is written to `recordings/`. A `grep -r voice_settings recordings/` across the whole tree returns nothing. So:
- The claim that different `voice_settings` were sent per reel is **only verifiable from source** (`scripts/saskia-settings.mts` lines 66-70: profile a sends no `voice_settings` override — account defaults; profile b sends `{stability: 0.35, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true}`; profile c sends `{stability: 0.2, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true}`) — there is no recorded request log to independently confirm what was actually sent over the wire for each reel.
- This isn't a strict acceptance-criterion breach (the brief's §3 only asks for the three `.mp4` reels, not a saved request log, and CLAUDE.md rule 7's "save everything" is written about video clips/prompts, not the ElevenLabs settings pass), but it's a real gap if Robin or a later reviewer wants to audit what was actually sent rather than trust the script's current source. Worth a one-line addition to `saskia-settings.mts` (write a `<out-prefix>-settings.json` with the three profiles and their `voice_settings`) if this pass is repeated.
- Separately, worth noting: the live app's actual default `voice_settings` (`app/api/voice/route.ts`: `stability: 0.5, similarity_boost: 0.8, style: 0.0`) do not match any of the three settings-pass profiles (profile a sends no override at all, i.e. whatever ElevenLabs' account-level default is, which may or may not equal `stability 0.5/style 0.0`). If Robin picks profile b or c by ear, the live route's hardcoded values will need updating to match — the settings pass doesn't wire its winner back into the app.

## Summary

| # | Criterion | Result |
|---|---|---|
| 1 | Style sheet v0.2 + no bare prohibitions in expanded_prompt | PASS |
| 2 | `npm run check` behaviour + passes on exemplar | PASS |
| 3 | Saskia default, per-line audio, starts on first frame | PASS |
| 4 | Three Saskia settings reels exist | PASS |
| 5 | Report tables + survival grid ≥15/18 every line | **FAIL** (lines 6, 10, 11 below threshold; report explains why) |
| 6 | Chained headline exact-at-mid-clip ≥5/6 | PASS |
| 7 | Lettering outside copy list — fewer than WP0 | PASS |

6 of 7 criteria pass. Criterion 5 fails on its own stated numbers, which the report surfaces honestly rather than obscuring — this reads as a genuine finding about style-sheet line 6 (the appended prohibition still costs survival) and line 10 (a format instruction fal keeps dropping) rather than a shortfall in how the WP was executed or measured.
