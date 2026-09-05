# WP3 — Handoff

Built in a separate git worktree, `../tessera-wp3` (branch `wp3`), not the main checkout — another session already had a dev server live there when this WP started, and CLAUDE.md rule 8 (added since WP2, in response to exactly that kind of collision) says parallel work uses separate worktrees. `node_modules` is a directory junction to the main checkout's (`New-Item -ItemType Junction`); `.env.local` was copied over by hand (never committed). Robin/PM: the diff lives on branch `wp3` in that worktree, not on `main` in the primary checkout — merge or `git worktree remove` it if you want, or ask a future session to move it.

## What changed

1. **Strip fix.** `lib/curation.ts` now parses the platform's own ticker-card boilerplate out of the raw answer text (`extractCard`, a regex for the `"$X USD" / "+X% today" / "$Xm USD" / "Market Cap"` block every captured record already carries inline) when the fixture's own `card` field is null — which it always was; nothing had ever extracted it. Used as a fallback in `toAnswer`, so a record's explicit `card` (if the platform ever supplies one) still wins. 6 of the 12 fixture records carry this boilerplate; the strip now shows `dgnx · $1.38 · +1.47% · $37.83m · information, not investment advice` for those, plain `information, not investment advice` for the other 6. Verified in the browser (screenshot in this session, not saved to disk) and via `/api/translate` directly.

2. **Style Sheet v0.3**, in both `CLAUDE.md` and `lib/prompt.ts` (`styleSheet()`, `STYLE_SHEET_VERSION`, `STYLE_SHEET_SIGNALS`), exactly as the brief specified: line 3 (subjects) gets the appended "reflecting only the room light / plain blank face" sentence; the standalone v0.2 line 6 ("no glow, neon, bloom") is deleted; line 4 (diagram elements) widens to the full new vocabulary; line 7 (headline typography) caps width at a third of the frame with a hero exception up to half; a new line 8 (scale variety) is inserted; line 10 (format) is untouched. `beatBlock()` in `lib/prompt.ts` also now tells the model each beat's `scale` (a plain-English sentence per value) and marks the `hero` beat explicitly, so the composition instruction actually reaches the per-beat prompt, not just the general sheet text. `scripts/report.mjs`'s `SIGNALS`/`LINE_NAMES` updated to match (11 lines, renumbered).

3. **Translator v0.3**, `lib/translator.ts`: `Beat` gains `hero: boolean`, `scale: "oversized"|"small"|"diagram"`, `delivery: string`. `validateBeat` parses and hard-validates `delivery` (tags must be from `DELIVERY_TAGS` — `presenting to camera`, `excited`, `fast-paced` — at most one, and stripped of tags must equal `line` exactly); `scale` soft-falls-back to `"small"` with a warning if missing/invalid, mirroring how `ground` already behaves; `hero` defaults false. New `validateProgramme(beats)` checks programme-level rules a single beat can't: at most one `hero`, no `scale` held three beats running. `deflectionBeat` (code-built, not LLM) sets `hero: false, scale: "small", delivery: line`. `TRANSLATOR_SYSTEM` gets the new keys in the beat-shape line, rules 12–14 for hero/scale/delivery, and rule 8's subject vocabulary widened to match sheet line 4. `EXEMPLAR_NDJSON` updated (beat 4, the runway figure, is `hero`; scale runs oversized/small/diagram/oversized/small/diagram; three delivery tags — opener, one turn, the hero beat, none on the close) and the pinned cache file `data/translations/a14c3cdf12f849c0042f91f76b36ac9b41ea65ba.json` kept byte-for-byte matching it (same discipline WP2's review checked).

4. **Voice route**, `app/api/voice/route.ts`: switched to ElevenLabs `eleven_v3` (the model that honours square-bracket audio tags); no `voice_settings` override (matches the "account default" profile the WP2 settings pass actually tested, not a hand-picked untested one). Every request — model, voice id, settings, text, duration, timestamp — is now written to `recordings/<session>/voice-<n>.json` beside the mp3 (measured via `scripts/ffmpeg.mjs`'s `durationOf`, imported into the route; `next.config.ts` gained `serverExternalPackages: ["ffmpeg-static"]` so the bundler leaves the binary-path resolution alone). `lib/programme.ts`'s live session now prefetches `beat.delivery`, not `beat.line`; `scripts/render.mts` sends `beat.delivery` to `/api/voice` too. Concurrency in `lib/voice.ts` untouched (still 2).

5. **New script**, `scripts/saskia-delivery.mts`: reuses one already-rendered saskia/chain-on session's clips (no extra fal cost) to cut `<prefix>-plain.mp4` (narrates `line`, no tags) and `<prefix>-tagged.mp4` (narrates `delivery`, with tags) on the expressive model, and writes `<prefix>-requests.json` — the per-request log WP2's review flagged as missing from `scripts/saskia-settings.mts`.

6. **`scripts/render.mts`**: `generateClip` now retries a failing fal call up to twice with backoff before giving up. This was necessary today — fal's H3 Max Turbo endpoint returned repeated `downstream_service_error` 500s all session (confirmed independently, not caused by this WP's code) — and it is a reasonable permanent hardening of the measurement pipeline either way.

7. **`scripts/check.mjs`**: mirrors all of the above — hard-fails a bad `delivery` tag or a `delivery`/`line` mismatch per beat, and a new `checkProgramme()` hard-fails more than one `hero` or a three-in-a-row `scale` per session/translation file.

## How to run it

From `../tessera-wp3` (or wherever this branch ends up):

```bash
npm install   # only if node_modules isn't a working junction/copy
npm run dev -- -p 3100   # or any free port; don't share one with another live session
npm run typecheck
npm run check                          # whole tree
npm run check data/translations/a14c3cdf12f849c0042f91f76b36ac9b41ea65ba.json   # exemplar only

npx tsx scripts/render.mts --question "What is the cash position and runway?" \
  --voice saskia --chain on --base http://localhost:3100

npx tsx scripts/saskia-delivery.mts --session recordings/<a saskia/chain-on session> \
  --out-prefix recordings/reels/spine-saskia-v0.3

npm run report recordings/<session> [recordings/<session> ...]
npm run whisper recordings/<a native session>
node scripts/contact-sheet.mjs recordings/<session> --at mid
```

`briefs/WP3-report.md` has the full numbers and the reels/contact sheets it references.

## What is untested / known gaps

- **Headline width (criterion 5) does not hold**, measured, not just suspected: 1 of 33 non-hero clips came in at ≤⅓ frame width, and that one is the missing-chip case, not a genuinely narrow one — true rate is 0/33. The sheet's wording change survives into `expanded_prompt` as text (18/18 in §6) but the render doesn't act on it. This needs a different lever next WP — possibly the hero/non-hero distinction needs to be far more emphatic in the beat block, or width needs to be stated as an explicit pixel/percentage fraction rather than "a third," or this may be a case (like line 10's aspect ratio) where fal's rewriter or the model itself just doesn't reliably act on a relative-size instruction. Do not report this criterion as met.
- **Style-sheet line 8 (scale) survives at 10/18 in `expanded_prompt` text**, below the ~15/18 the other content lines clear — but the actual renders show three distinct, varied compositions per session (verified visually via contact sheets and the `scale` field recorded per beat), so the instruction appears to be working through the beat-block text (`SCALE_TEXT` in `lib/prompt.ts`) even where it doesn't show up in fal's own rewritten-prompt echo. Not fully understood; flagged rather than dismissed.
- **Today's render times are not comparable to WP0/WP2** — fal's H3 Max Turbo endpoint was intermittently returning `downstream_service_error` 500s throughout this session (confirmed with a bare fal SDK call, unrelated to this project's code); `scripts/render.mts` now retries, but §1's numbers include retry backoff and queue re-entry, not clean render latency.
- **Lettering count (criterion 6) is a spot-check, not exhaustive** — same method WP0/WP2 used (zoomed the two historically-offending beats — coin rims, calendar pages — per session, not every pixel of every clip). 4/18 measured this way, fewer than WP2's 6/18, but a full frame-by-frame pass could find more or fewer.
- **Ground-hold rule missed once**: "What are the key risks for Diginex?" holds magenta for a single beat (beat 3) before switching to cyan, which is a real miss of "hold two or three, then change," not the end-of-programme exception WP0/WP2 noted elsewhere. Soft prompt-adherence issue, not code-enforced, so it renders fine.
- **The "What is Diginex" live-translation session's translation came from a same-day cache**, not a genuinely fresh live call — an earlier ad hoc browser click (verifying the strip fix visually) regenerated it under v0.3 and wrote the cache before the measured render ran. The other live translation ("key risks") is genuinely live. Same caching behavior WP2 documented, not new.
- **Browser-side UX timings** (time-to-first-frame after Enter, autoplay, `readyState` at swap) were **not** re-measured this WP — same gap WP2 left, for the same reason (a headless driver was used instead of the live player for the controlled measurement runs). One live browser session was used only to screenshot the strip fix.
- **Saved but out-of-scope recordings**: asking "What is Diginex" in the browser to check the strip triggered the player's own 10-second auto-continue, which chained through several more questions under the worktree's `VOICE=native` default before the tab was closed. Those sessions exist under `recordings/` (rule 7 — nothing was deleted) but are not part of the five measured sessions and are not reflected in the report's tables or this handoff's numbers.
- **Did not run `npm run build`** anywhere — no need to, and the main checkout had a live dev server for most of this session (CLAUDE.md rule 8).
- **ElevenLabs cost** is reported as a call count (37 today), not a dollar figure — CLAUDE.md doesn't carry an ElevenLabs price, same gap WP0/WP2 left.

## Acceptance criteria — self-assessment, not a pass/fail claim

1. Strip shows the ticker line for records with a card, disclosure always — built and verified in the browser.
2. Sheet v0.3 in `CLAUDE.md` and `lib/prompt.ts` as specified, no standalone glow line — done.
3. `npm run check` fails a bad `delivery`/tag, passes on the updated exemplar, catches >1 hero and 3-in-a-row scale — done, verified with synthetic tests and a real live drop.
4. Voice route uses the expressive model, sends `delivery`, records every request — done, verified on disk.
5. Headline width ≤⅓ frame on ≥15/18 non-hero spine clips — **measured and does not hold** (0/33 non-hero clips across all five sessions once the dropped-chip case is set aside correctly).
6. Lettering outside the copy list fewer than WP2's 6/18 — **4/18 measured**, by spot-check, same method as WP0/WP2.
7. Both Saskia reels and the live-translation reel exist, report states which beats carry tags — done: `spine-saskia-v0.3-plain.mp4`, `spine-saskia-v0.3-tagged.mp4`, `live-what-is-diginex-tagged-v0.3.mp4`; §4 of the report has the tag table.
