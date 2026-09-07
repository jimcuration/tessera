# WP9 — Handoff

Worktree `../tessera-wp9`, branch `wp9`. Do not mark acceptance criteria as passed — this doc reports what was built, run and observed; it does not grade itself against the brief's acceptance list.

## What was built

**1. `KEY_GLOW=on|off`, default off.**

- `lib/config.ts`: new `KeyGlowSwitch`/`Switches.keyGlow`.
- `components/console.tsx`: `Console` takes a new `keyGlow: boolean` prop. When false, `.console-key`/`.console-key-reflection` are not rendered at all (not just made transparent) — verified in the DOM (`document.querySelectorAll('.console-key').length === 0`). The seam is untouched either way.
- `components/player.tsx`: new `useKeyGlow()` hook (same `/api/config` pattern as `useMusicOn`/`useTheatre`). `cursorRendering` is now `(!theatre || !keyGlow) && Boolean(renderingShot)` — with the default `KEY_GLOW=off`, the ask-line cursor carries the rendering-ground-colour fill in **both** theatre and plain mode; `KEY_GLOW=on` restores the old split (theatre leaves it to the key, plain already showed it on the cursor).

**2. Four screen states.**

- `components/screen-status.tsx` (new): a small overlay component with no state of its own — `idle` (blinking cursor, low-left), `assembling` (`assembling` + cursor, and a sub-stage line beneath), `playing` (renders nothing unless `showHoldCursor`, in which case the same low-left cursor), `end` (the end line + cursor; screen dimming is applied by the caller, not this component).
- `components/player.tsx`: `screenState` = `session === null ? "idle" : pending ? "assembling" : isEndState ? "end" : "playing"` (`pending` is the pre-existing "no picture yet" condition, per the brief's own instruction to reuse it). The `<Screen>` element and the new overlay are wrapped in a `.screen-frame` div (new CSS, sized identically to `.screen`/`.screen--theatre`) so the overlay lines up in both modes without touching `screen.tsx`.
- **Assembling sub-stage** (`assemblingStage()` in `player.tsx`): `reading the answer` (no `answer` yet) → `writing the programme` (`answer` known, `!streamState.rendering && streamState.rendered === 0`) → `voicing scene 1` (Saskia only: rendering has started, `narrator.isReady(1)` false) → `rendering scene 1` (native once rendering starts, or Saskia once track 1 resolves). `lib/voice.ts`'s `Narrator` gained `isReady(n)` (a `resolvedTracks` Set populated in `prefetchScene`'s `.then`, regardless of success/failure) and `useCachedTrack(n, url)` (for the cache path, below). Because `isReady` isn't itself observable, `player.tsx` polls it at 250ms only while `screenState === "assembling" && voice === "saskia"`, self-cancelling once ready.
- **Playing / hold cursor**: `onEnded` starts a 2000ms timer (`HOLD_CURSOR_MS`); if it fires before `onStarted` clears it, `console.info("[player] hold > 2s")` and the corner cursor renders. Both callbacks also clear the timer on interrupt (`ask()`).
- **End**: `screen--dim` (`filter: brightness(0.4)`, plain, no `mix-blend-mode` nearby per `CLAUDE.md`'s Notes) is applied to the `<Screen>` element's own className; `focusInput()` fires in an effect keyed on `isEndState`.

**3. Cached playback.**

- `lib/cache.ts` (new, server-only, `node:fs`): `findCachedProgramme(input)`, `isCompleteRecording(dir, expectedBeatCount, voice)` (exported so `scripts/cache.mts` runs the *identical* check), `listMatchingSessions(input)`. Match rule: `session.json`'s `matchedQuestion` normalises (via `lib/curation.ts#normalise`) to the resolved answer's own question; `switches.voice`/`chain`/`clipSeconds` equal; `translatorVersion`/`styleSheetVersion` equal current. Completeness: every beat `1..N` covered by some shot file's own `beats` list **and** that shot's `<n>.mp4` exists; under Saskia, every beat `1..N` also has its own `<n>.mp3`. Ties broken by most-recent `savedAt`.
- `app/api/cache/lookup/route.ts` (new): `POST {question}` → `getAnswer` (same as `/api/translate`) → `readSwitches()` → `findCachedProgramme`. A hit returns the answer header (built from the **live** `getAnswer()` result, not from the recorded session — see "card" note below), the flat `beats`, and per-shot descriptors (`videoUrl`/`duration`/`resolution`/per-beat `audioUrl`) built against `/api/recording`. `{hit:false}` (404) otherwise.
- `app/api/recording/route.ts` (new): serves `RECORDINGS_DIR/<session>/<file>` only, `session` against the existing `/^[A-Za-z0-9._-]{1,120}$/` pattern, `file` against `^\d+\.(mp4|mp3)$`, path re-checked to stay inside `recordingsDir()`. Long `cache-control`. **Range**: implemented by reading the whole file into a buffer and slicing it, not a true streamed read — see "Not done / approximate" below.
- `lib/stream.ts`: **one** additive method, `hydrateFromCache(shots, readyClips)` — pushes ready clips straight into the queue and marks `finished`. `render()`/`pump()`/`advance()`/`skipFailed()`/`peekNext()` bodies are unchanged (checked by reading the diff, not just by memory).
- `lib/programme.ts`: new private `Session#tryCache()`, called from `run()` right after `switches` is built (see "Ordering" below), before `createRenderer`. On a hit: sets `answer`/`beats`, builds a `Stream` via the normal `createRenderer` (needed so the player's existing subscriptions see a real `Stream`), builds `Shot[]`/`ReadyClip[]` from the response, seeds Saskia's `Narrator` with `useCachedTrack` per beat, calls `stream.hydrateFromCache(...)`, logs `` `[session] beat ${n}: source: cache (${sessionId})` `` once per **shot** (i.e. per clip — matches the brief's "log source: cache per clip"), and returns `true` without ever calling `recordSession()` (a cache-hit replay is not a new recording).
- `scripts/cache.mts` (new): loads `.env.local` the same way `render.mts` does; for the current effective `VOICE`/`CHAIN`/`CLIP_SECONDS` and `TRANSLATOR_VERSION`/`STYLE_SHEET_VERSION`, calls `lib/cache.ts#findCachedProgramme` directly (no HTTP) for all 12 `data/diginex.json` records, prints a status table, then shells out to `scripts/render.mts` for whatever's missing, against a running dev server (fails fast with a clear message if unreachable — never starts one itself). `package.json`: `"cache": "npx tsx scripts/cache.mts"`.
- `.claude/launch.json`: added `"tessera-wp9"` on port 3909 (`npx next dev -p 3909`).

**A real bug, found live and fixed**: `scripts/cache.mts`'s first version passed each record's question as a raw CLI argument to `render.mts` via `spawnSync(..., {shell:true})`. Live testing surfaced two distinct Windows failures from this: a question containing `&` ("...given the M&A spend?") had cmd.exe read the `&` as a command separator (`'A' is not recognized as an internal or external command`), and a question containing an em dash ("What would change your mind on Diginex — what's the exit signal?") was rejected outright by npm's own arg parser. Worse than an outright failure: one run *completed* against the **wrong** question — the mangled argument still matched something via `getAnswer`'s fuzzy matcher, silently recording a "What is Diginex" session under a `cache-what-is-the-timeline-for-the-c-...` directory name. `scripts/render.mts` gained an additive `--question-file <path>` flag (reads and trims the file; `--question` is untouched for direct CLI use); `cache.mts` now writes each question to a temp file and passes only the file path on the command line. `shell:true` is still required on Windows (spawning `npx.cmd` directly without a shell fails with `EINVAL`), but the only thing that ever touches the command line now is a path this script constructs itself, never arbitrary question text. Reproduced before the fix, confirmed gone after — see the "Verified live" section.

**5. Fast start — not attempted.** Time went to making 1–4 solid and to chasing the shell-quoting bug above; `FAST_START` was not built, and no `FAST_START` switch was added since nothing reads it. Left for a future pass; see the brief's own explicit permission to report this as not done.

## A related, smaller bug fixed in auto-continue (§4)

Auto-continue's "never repeat" tracking (`playedQuestions` in `player.tsx`) originally recorded the **matched** question only (`sessionState.answer.question`). An auto-continue target that never resolves to a captured answer (`status: "none"`/`"error"`) never sets `answer`, so it would never be marked played — the countdown would retry the exact same unanswerable question every 10 seconds forever rather than moving on. Fixed by also recording the as-typed question when a session resolves to `"none"`/`"error"`. This did not manifest against the actual 12-record fixture (every suggestion and spine question in it happens to resolve to something), so it was found by reasoning about the code, not by hitting it live — flagged here because a future content change could hit it.

## How to run it

```
cd ../tessera-wp9
npm install                      # this worktree's own node_modules; not shared with other worktrees
cp <a sibling worktree's>.env.local .env.local   # this worktree had none checked out; copy an existing one (same FAL_KEY/ELEVENLABS_API_KEY/ANTHROPIC_API_KEY as every other worktree — see CLAUDE.md rule 2, never printed here)
npx next dev -p 3909             # or add "tessera-wp9" to .claude/launch.json (done) and use your own tooling's preview
```

`npm run cache` — lists cache status for all 12 records under the current `.env.local` switches, then renders whatever's missing against a **running** dev server:
```
npx next dev -p 3909   # in one terminal
npm run cache           # in another — or npx tsx scripts/cache.mts --base http://localhost:3909 --voice saskia --chain on --clip-seconds 15
```

`RECORDINGS_DIR` was not overridden here — it resolved to the shared `../tessera-recordings`, so cached sessions created by this work (and by earlier work packages) all live in the one folder, as CLAUDE.md rule 8 intends.

## Verified live (browser, this worktree's own server on :3909)

- **`KEY_GLOW=off` (default)**: `document.querySelectorAll('.console-key').length === 0` in theatre mode, confirmed via the DOM, not just by reading the conditional.
- **Cursor carries render state in theatre mode now**: during a live render, `.ask .cursor`'s computed `color` was the beat's ground colour (e.g. `rgb(194, 23, 122)`, magenta) with the `blink` class removed — previously theatre mode never showed this at all.
- **Idle**: blinking cursor, low-left, nothing else — confirmed in both theatre (`>=900px`) and plain (`700px` forced via `resize_window`) viewports.
- **Assembling, all four sub-stages observed in sequence on a real (uncached) ask**: `reading the answer` → `writing the programme` → `voicing scene 1` → (transition to playing, i.e. `rendering scene 1` implicitly, confirmed by the stage text disappearing exactly when the first real fal-media video appeared).
- **Cached playback**: multiple real cache hits (pre-existing Sep-5 recordings and ones created live in this session) — `console.info` showed `` `[session] beat N: source: cache (<id>)` `` once per shot; network showed `POST /api/cache/lookup → 200`, then `GET /api/recording?...&file=N.mp4`/`.mp3 → 206 Partial Content` (Range requests worked), and critically **no** `/api/translate` or `/api/fal/proxy` calls for a cache hit. Precise first-frame timing (see table below): a script clicked a cached suggestion and polled `video.reel:not(.back)`'s `readyState` — 103–153ms, well under the brief's 1s.
- **Playing / hold cursor**: dispatching synthetic `ended` events on the front `<video>` (to fast-forward through already-buffered cached clips without waiting out real playback — see caveat below) reliably produced `[player] hold > 2s` in the console and the corner cursor rendered exactly when no next clip was queued.
- **End state, reached organically**: after chaining through several real questions (mixing live renders, cache hits, and unanswerable follow-ups), the screen showed `ask me anything about diginex`, `document.querySelector('.screen').className` included `screen--dim`, `getComputedStyle(...).filter === "brightness(0.4)"`, and `document.activeElement` was the ask-line's own `<input class="ghost">` — all four matching the spec exactly.
- **Auto-continue never-repeat, observed directly**: after "What is Diginex" and "What is the cash position and runway?" had both played, the suggestions fell back to the spine list (`what is diginex`, `what is the cash position and runway?`, `what are the key risks for diginex?`) and the `· up next in Ns` marker landed on **risks** (the third item), not either already-played one — confirmed the up-next marker now tracks the real auto-continue target rather than always index 0.
- **`npm run cache`**: confirmed it correctly reports 3 pre-existing Sep-5 recordings as cached (before touching the browser at all) via a dry run against an unreachable `--base`, confirmed it fails fast with a clear message when the dev server isn't up, and — after the fix above — confirmed a question containing `&` renders and caches correctly (see the bug writeup above for the before/after).
- `npx tsc --noEmit`: clean.
- Manual diff review: `lib/stream.ts`'s `render()`/`pump()`/`advance()`/`skipFailed()`/`peekNext()` bodies are untouched; the only addition is `hydrateFromCache()`. No changes to the media proxy (`app/api/media/route.ts`) or the fal server proxy.

**Caveat on the "reached end" and "hold cursor" observations**: real cached-clip playback is real video (multiple 10–15s shots per programme), so walking the full chain organically would take several minutes of wall-clock time per cycle. To keep this pass affordable, cached-clip playback was fast-forwarded by dispatching synthetic `ended` events on the front `<video>` element from the browser console — this exercises exactly the same `onEnded`/`advance()`/`onStarted` code path a real clip ending does, just without waiting out the real duration. It is **not** a substitute for watching a full session play out at real speed, which was not done end-to-end in this pass.

## Time-to-first-frame

All under Saskia, `CHAIN=on`. Sample sizes are small and reported honestly, per the brief's own allowance — no attempt was made to hit "ten runs each."

| Path | n | Samples (ms unless noted) | p50 | max |
|---|---|---|---|---|
| Cached answer | 3 | 153, 103, 152 | 153ms | 153ms |
| New scene-mode programme (`CLIP_SECONDS=15`) | 3 | 78.8s, 39.5s, 44.3s | 44.3s | 78.8s |
| New 5s-clip programme (`CLIP_SECONDS=5`) | 1 | 47.4s | — | — |

Scene-mode and 5s-mode numbers are askedAt → the first shot's `.mp4` file being saved by `/api/record` (from the recorded `session.json`/`1.json` timestamps), not a client-side instrument — the actual on-screen appearance is within roughly the same second (the proxy fetch/decode is fast relative to a 40–80s translate+render wait). The 5s number is not obviously faster than 15s-mode despite dispatching only one beat's shot instead of a whole scene: in both modes the dominant cost is Claude's own latency to emit even the *first* beat (27–43s observed across the scene-mode samples), which doesn't depend on `CLIP_SECONDS`. Worth more samples before drawing a real conclusion.

**Hold count in a 3-programme session**: not measured under organic real-time playback in this pass (see the fast-forward caveat above) — the mechanism itself is confirmed working (console log + corner cursor, both observed), but an honest "how often does this actually happen at real speed" count needs a session played out in real time, which this pass didn't do.

## Ambiguities / interpretations flagged for Robin/PM

1. **"Palette" in the cache key (brief §3)**: there is no separate palette switch anywhere in this codebase — the style sheet's ground palette (`GROUND_HEX` in `lib/prompt.ts`) is versioned by `STYLE_SHEET_VERSION` itself. `lib/cache.ts` treats a `STYLE_SHEET_VERSION` match as covering "palette" per the brief's own wording ("Cache key includes the versions so a sheet **or palette** change invalidates cleanly" — a palette change would in practice be a style-sheet version bump). Flagging the interpretation explicitly rather than silently assuming it.
2. **"Log `source: cache` per clip"**: implemented as one `console.info` per **shot** (one shot = one rendered clip = one `.mp4`, which at `CLIP_SECONDS=15` can cover 2-3 beats) rather than per beat. Read "clip" as "the video file," which is a shot, not a beat.
3. **Cache lookup ordering in `lib/programme.ts#run()`**: the brief's §3 implies checking the cache "right after the existing `/api/config` fetch." This build keeps the pre-existing `FAL_KEY`/`ELEVENLABS_API_KEY` missing-secret checks *before* the cache lookup (so those checks still run even when nothing will actually render) rather than moving the cache check earlier than they are. A cache-hit session that also happens to be missing `ELEVENLABS_API_KEY` would currently fail before ever reaching the cache, which it wouldn't need to. Not changed here — flagging the trade-off rather than restructuring failure-handling further.
4. **Range support on `/api/recording`**: implemented via `readFileSync` + `Buffer.subarray`, not a streamed `fs.createReadStream`/`Readable.toWeb` pipe. Simpler and reliable for these clip sizes (single-digit MB), but reads the whole file into memory per request rather than truly streaming — worth revisiting if `RECORDINGS_DIR` files grow much larger.

## Addendum: final `npm run cache` population state

After this handoff's own drafting, `npx tsx scripts/cache.mts` was run to completion against all twelve fixture records (current switches: `saskia`/`chain=on`/`clipSeconds=15`). Final result: **10 of 12 cached, 2 failed.**

The two that fail — "Should I buy Diginex shares?" and "What would change your mind on Diginex — what's the exit signal?" — render their video correctly (all 4 scene shots complete, `t2v`/`i2v` as expected, no face-gate drops) but every `POST /api/voice` call for both of them returned `500`, four times each (once per scene), so no per-beat narration `.mp3`s were written and `lib/cache.ts`'s completeness check correctly refuses to call them cached (video-only would silently break Saskia narration on "playback"). Retried once from a clean re-render; same result both times. This looks like an external ElevenLabs failure (rate limit or transient outage) rather than a bug in this work's code — the same `/api/voice` route and `Narrator`/`render.mts` call path that already works for the other 10 records failed consistently for exactly these two, and several other worktrees' dev servers may have been active against the same `ELEVENLABS_API_KEY` concurrently (CLAUDE.md rule 8: one shared key across every checkout). Not chased further to avoid spending more fal/ElevenLabs credit on retries without a diagnosed cause — worth a look with fresh eyes (check `/api/voice`'s own error body, not just the 500 status, and whether it correlates with concurrent ElevenLabs usage elsewhere at that moment).

Practical effect: `npm run cache` and cached playback work correctly for 10 of the 12 fixture records right now; the other 2 will render live (uncached) until this is diagnosed. This does not affect the auto-continue/end-state verification above, which only needs *some* answered questions to chain through, not all twelve specifically cached.

## Untested / not verified

- Fast start (§5): not attempted at all (see above).
- A full, real-time (not fast-forwarded) walk through all twelve records confirming auto-continue never repeats and reaches **end** — the state machine was exercised and reached **end** correctly once, using the fast-forward technique described above, not through twelve real-time programmes.
- Plain mode was checked for `idle` and the general `.screen-frame`/no-key-divs structure only; `assembling`/`end` were not separately re-screenshotted in plain mode (they share the exact same `ScreenStatus` component, CSS classes and `player.tsx` state logic as theatre mode, so the risk of a plain-mode-only bug is low, but it wasn't independently confirmed).
- `npm run cache`'s Range-serving `/api/recording` route was exercised for real (206 responses observed) but not stress-tested with malformed `Range` headers beyond the one real browser video-scrubbing pattern seen live.
- The exact "voicing scene 1" window's duration was not independently timed — the brief itself expects it may be very short (scene 1's video shot and its narration are dispatched at nearly the same moment in `lib/programme.ts`), and that matched what was observed (the stage was visible for at least one poll tick, i.e. ≥250ms, but no longer measurement was taken).
- Concurrent multi-worktree recording-directory activity: `../tessera-recordings` is shared across every checkout (CLAUDE.md rule 8). During this pass, some pre-existing recordings unrelated to this session's own asks were found in that shared folder (from earlier work, not from a worktree active *during* this session — confirmed only one process was listening on any port in the 3000–4000 range at the time). Nothing in this build assumes exclusive ownership of that folder, but it's worth knowing the cache can and will pick up recordings made by other worktrees' sessions too, by design.

## Files touched

New: `lib/cache.ts`, `components/screen-status.tsx`, `app/api/cache/lookup/route.ts`, `app/api/recording/route.ts`, `scripts/cache.mts`.
Changed: `lib/config.ts`, `components/console.tsx`, `components/player.tsx`, `app/globals.css`, `lib/voice.ts`, `lib/stream.ts` (one additive method only), `lib/programme.ts`, `scripts/render.mts` (one additive flag only), `package.json`, `.claude/launch.json`.
Not touched: `lib/translator.ts`, `lib/prompt.ts`, `app/api/face-gate/route.ts`, `app/api/media/route.ts`, `lib/fal.ts` (the media proxy and fal server proxy — CLAUDE.md rule 3), `components/screen.tsx`.
