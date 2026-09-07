# WP4.2 handoff — console optics, readout, pause, ask affordance

Built against `briefs/WP4.2.md` on branch `wp4.2`, own worktree (`../tessera-wp4.2`), dev server on port 3420 (added as `tessera-wp4.2` in `.claude/launch.json`). `RECORDINGS_DIR` untouched, so recordings still land in the shared `../tessera-recordings`.

## What changed

### 1. Optics — the video sits in the screen (`components/console.tsx`, `app/globals.css`)

Three additions inside `.console-screen` (theatre only — this div doesn't exist in plain mode), all after `{children}` so they draw over the video, and all clipped by the parent's `overflow: hidden`:

- **Exposure match**: `filter: brightness(var(--screen-exposure-brightness)) contrast(var(--screen-exposure-contrast))` on `.console-screen` itself, `0.9` / `1.05` by default (brightness down ~10%, a slight contrast lift) — the two custom properties are the one place to tune it, per the brief.
- **Inner shadow**: a `.console-screen-shadow` div, `box-shadow: inset 0 0 6px 3px rgba(0,0,0,0.6)` — no `filter` or `mix-blend-mode` of its own, so it can't trip the Chromium `filter`+`mix-blend-mode` composite bug (CLAUDE.md → Notes; WP4.1 hit this on the key/seam glow and worked around it the same way — box-shadow, not `filter: blur()`).
- **Glass highlight**: a `.console-screen-glass` div, a 128° diagonal `linear-gradient` band, `mix-blend-mode: screen`, `opacity: 0.05` (within the brief's 4–6%), static — no animation.

I put the exposure filter on `.console-screen` (the container) rather than only on the video, so the "assembling"/"end"/"deflection" status text and the two overlay divs above sit in the same graded light as the picture — it read as one recessed panel in testing, not a filtered video floating inside an unfiltered frame. The filter is on an *ancestor* of the blend-mode element (the glass div), not the same element, which is the specific combination the Chromium bug does not affect — confirmed live (see Verified live, below).

### 2. Ticker readout on the bezel (`components/console.tsx`, `components/player.tsx`, `app/globals.css`)

- **New bounds** in `console.tsx`: `READOUT_BOUNDS = { left: 0.1317, right: 0.62, top: 0.748, bottom: 0.807 }`, measured directly off `public/console-cutout.png` by sampling pixel rows (Python/Pillow) rather than eyeballing — the aluminium reads flat from `y=0.7415` (the screen's own bottom edge) to `y≈0.81`, then drops sharply into the bevel's shadow. Right edge stops well short of `KEY_BOUNDS.left` (0.643). `Console` takes a new `readout?: ReactNode` prop and renders it absolutely positioned inside those bounds, alongside the existing key/seam elements — nothing existing moved.
- **Persistence**: `Player` now keeps `cardByCompany: Record<string, Record<string, unknown>>` in state, keyed by `lib/curation.ts`'s `COMPANY` constant (there's only one company in the WP0 fixture; keying by company rather than hardcoding "the current card" is what "store per company" in the brief asks for, and costs nothing extra). An effect writes into it only when `sessionState.answer.card` is non-null, so a record with no card (and no boilerplate for `extractCard` to lift one from) leaves the previous entry untouched rather than clearing it. `readoutText = formatCard(cardByCompany[COMPANY] ?? null)` is what actually renders, everywhere — never the live answer's own `card` directly.
- **Rendering**: the same `readout` node (a `<span className="readout">`) is handed to `<Console readout={...}>` in theatre and dropped into a plain `<div className="readout-plain">` right after `.screen-wrap` in plain mode — "same type, same persistence," per the brief. Nothing renders (not even an empty band) until the first card has been seen.
- **Bottom strip**: `formatCard(...)` is no longer called for the bottom `.strip` — it's `information, not investment advice` alone now, unconditionally.

### 3. Pause (`lib/voice.ts`, `components/screen.tsx`, `components/player.tsx`, `app/globals.css`)

- `Narrator` (`lib/voice.ts`) gained `pause()`/`resume()`, both operating on `this.audio` (the beat currently sounding) only — fetches in flight are untouched, unlike `stop()`.
- `Screen` (`components/screen.tsx`) takes a new `paused: boolean` prop. A `useEffect` keyed on `[paused, front]` calls `video.pause()`/`video.play()` on whichever slot is currently front. It never touches the back (preloading) slot, and it's a no-op the moment nothing is loaded yet. Toggling `front` (a genuine clip swap) re-runs the effect too, but that's harmless — the swap's own `play()` call already started the new clip; this just confirms it.
- `Player` owns a `paused` boolean, flipped by `togglePaused()` — wired to `onClick` on the `.screen-frame` div (the same element in both theatre, inside `Console`'s children, and plain, inside `.screen-wrap`, so one handler covers "click the screen" and "click the video" from the brief) and to a `window` `keydown` listener for `Space` that no-ops when `inputFocused` is true. `togglePaused` itself no-ops when there's no `session` yet — nothing to pause on the idle screen.
- Paused freezes, together: the front video (above), Saskia (`sessionRef.current.narrator.pause()`/`.resume()` in an effect on `paused`), the music bed (`!paused` folded into the existing `musicPlaying` condition), and the auto-continue countdown (the `setInterval` reads a `pausedRef` — a ref, not the state itself, so toggling pause mid-count doesn't reset the interval and restart the ten seconds; it just holds the current number).
- Visual: the ask-line cursor's `blink` animation gets a `.paused` modifier dropping `animation-duration` to 2s; the console seam (and its reflection) gets a `--pause-mult` custom property (1 normally, 0.5 while paused) multiplied into both its `steady` opacity and its `filling` keyframe's peak opacity, so either seam state dims to half rather than needing two separate paused variants.
- `ask()` sets `paused` back to `false` on every call (both a typed question and a suggestion click go through it), so interrupting while paused resumes into the new programme, per the brief.

### 4. Ask-line placeholder (`components/player.tsx`, `app/globals.css`)

A `<span className="placeholder">ask about diginex</span>` renders right after the cursor, only when `!typed && !inputFocused`. No box, border or background — `color: var(--text)` at `opacity: 0.4`, `pointer-events: none` so it never steals the click from the ghost input beneath it.

## Out of scope, untouched

Style sheet, translator, cache, `lib/stream.ts`'s buffer logic, the media proxy, the fal proxy, the deflection screen, states other than pause.

## How to run

```bash
npm install                       # this worktree had no node_modules; see below
npx next dev -p 3420              # or the "tessera-wp4.2" entry once your tool reads this worktree's launch.json
npm run typecheck                 # passes clean
```

One thing to flag on "how to run": this session's `mcp__Claude_Browser__preview_start({name: ...})` reads `.claude/launch.json` from the *main checkout* (`Project Tessera`), not from the worktree it's actually driving — so a `name` lookup for `"tessera-wp4.2"` fails even though I added the entry here (I did not add it to the main checkout's `launch.json` too — that's a different, currently-active checkout with its own uncommitted state, not mine to edit for this). I ended up starting the dev server directly (`npx next dev -p 3420`, backgrounded) and pointing `preview_start` at `{url: "http://localhost:3420"}` instead. Worth knowing if the next builder hits the same "server not found" error.

`node_modules` isn't present by default in a fresh `git worktree add` (it's gitignored, and worktrees don't share it) — `npm install` took about 25s here, no lockfile changes.

## Verified live (Browser pane, port 3420, `AUDIO=off`)

- **Optics**: before/after screenshots shown directly in this build session (stashed my changes, reloaded, screenshotted; popped the stash, reloaded, screenshotted the same cached clip) — the after version reads visibly moodier/darker at the edges with a faint diagonal sheen; no console errors from the filter/blend-mode combination. Could not export either screenshot to a file — same limitation WP4.1's handoff hit (Browser-pane screenshots return inline for me to inspect; no export-to-disk path). If Robin needs them on disk, that needs either a manual capture or a small Playwright/Puppeteer script.
- **Readout persistence** (criterion 2): asked "What is Diginex" (has boilerplate → card) then "What is the Resulticks acquisition..." (no boilerplate → `card: null`) back to back — the bezel readout kept showing `dgnx · $1.38 · +1.47% · $37.83m` unchanged through the second answer. Plain mode (700px) checked separately: readout directly under the video, disclosure alone at the page bottom.
- **Pause** (criterion 3), all via `javascript_tool` reading real DOM/element state, not just screenshots:
  - Click on screen → `video.paused === true`, `currentTime` identical across two checks 2s apart (frozen, not just slow).
  - Cursor class `cursor blink paused`, computed `animation-duration: 2s`; seam class gains `paused`, computed opacity `0.225` (half of `steady`'s `0.45`).
  - Click again → `video.paused === false`, `currentTime` advancing over an 800ms window.
  - Space bar (dispatched as a real `KeyboardEvent`, and separately via the `computer` tool's own key-press) toggles the same way when the ghost input isn't focused; typing into a focused input including a literal space character was unaffected (no pause), confirmed by the typed value containing the space.
  - Paused, then clicked a suggestion: cursor back to plain `cursor blink`, video `paused === false` a few seconds later once the new programme's first clip landed — the interrupt resumed as specified.
- **Placeholder** (criterion 4): present and reading `ask about diginex` when empty and unfocused; absent while focused (even with an empty value); present again after blurring an empty input.
- **Widths** (criterion 6): 900 / 1280 / 1400px viewports — console and readout bounds scale together with no drift (they're the same fraction-based `boundsStyle()` used by every other console element already verified in WP4/WP4.1).
- **Typecheck**: `npm run typecheck` passes clean, both before and after a `git stash`/`stash pop` round-trip used to get the before/after screenshots.
- **`npm run check`**: pre-existing translator/beat-structure FAILs and warnings across old recordings, all unrelated to this WP (scene beat counts, headline-number heuristics, an old bookend mismatch) — none touch console/player/screen/voice, and none are new; left alone per "out of scope: translator, cache."

## Untested / not done

- **Interface-rule read on criterion 5**: the console's own visual system (glows, box-shadows, gradients) already predates this WP (key/seam glow, WP4.1) and isn't, in my reading, what CLAUDE.md's Interface section governs — that section is about the page's own chrome (ask line, suggestions, strip), which I left alone (no new border, card, radius, icon or emoji anywhere in this diff). Flagging this reading explicitly rather than asserting it, since "no gradients... drop shadows" is close enough to what §1 asks for that it's worth Robin's eyes.
- **Narrator pause/resume against a genuinely in-flight beat**: `pause()`/`resume()` only touch `this.audio`, the beat *currently* sounding. If a pause lands in the narrow gap between one beat's audio finishing and the next one's `Audio` element being constructed (still awaiting its fetch promise inside the `playing` chain), that next beat will start audible on schedule, ignoring the pause — because nothing gates the chain itself, only the currently-live element. In practice the video is also frozen at that point, so the beat-boundary events that would call `narrator.play(n)` don't fire either, which should close the gap, but I didn't specifically construct a test for this race and couldn't verify it with `AUDIO=off` in the way I could verify video pause via `currentTime`.
- **Cross-browser**: only checked in the Browser pane's Chromium, same as prior WPs.
- **A real live render** (not cache) with `AUDIO=on` and a listener, end to end with pause/resume mid-narration — not attempted, to avoid burning fal/ElevenLabs credits during UI verification; everything above used cached clips (`CACHE=on` default) and `AUDIO=off`.
