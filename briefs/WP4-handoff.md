# WP4 — Handoff

Builder: Claude (Sonnet 5), 4 September 2026.

Criteria are not marked passed here; that is the reviewer's job.

## What I built

**Console** (`components/console.tsx`, new). `public/console.png` at `width: 70%` (max 1400px), the video screen, the square key and the yellow seam positioned over it as CSS percentages of the image, so they scale together on resize instead of being recomputed in JS. Bounds:

- **Screen**: the brief's numbers (left 0.1317, right 0.6294, top 0.2155, bottom 0.7415), unchanged — I checked them against the render (the screen's right edge lands at pixel 3465 of 5504, i.e. 0.6294 exactly) and they're correct as given.
- **Square key**: the brief flagged "roughly x 0.65–0.69, y 0.68–0.74 — verify". I measured it directly off the 5504×3072 PNG (gridded crops + pixel sampling in the browser) and it sits at **left 0.643, right 0.673, top 0.679, bottom 0.732** — a bit further left and up than the brief's estimate. Used the measured values.
- **Seam**: measured the same way. The glow's bright core is x 0.698–0.706; I used a slightly wider box (**left 0.688, right 0.708, top 0.14, bottom 0.81**) so the pulse overlay covers the visible glow's soft edge too.

**Player** (`components/player.tsx`, rewritten). Same session/stream wiring as before (untouched — `lib/stream.ts` was not touched, per CLAUDE.md rule 3), with the WP4 chrome layered on:

- Ask line now has the `curation` label the brief specifies (§2) — it was missing entirely before WP4; I added it and reordered so typed text follows the cursor rather than precedes it, matching "typing appears after the cursor."
- Square key state (`off | listening | rendering`) computed once and handed to `<Console>` in theatre mode: `rendering` when a shot is in flight (`stream.renderingShot()`), `listening` while the input has focus or a question is pending (asked, no picture yet), else `off`.
- Seam state (`idle | steady | filling`): `idle` before any session exists, `steady` once `buffered >= 2`, `filling` (2s pulse) otherwise.
- Suggestion squares now cycle the four ground colours in order (`GROUND_HEX[GROUNDS[i % 4]]`) instead of a flat white square.
- The strip: one fixed line at the bottom of the viewport, `<card values> · information, not investment advice`, card segment omitted when `answer.card` is null.
- `THEATRE=on|off` switch (`lib/config.ts`, follows the existing `VOICE`/`CHAIN`/`RENDER` pattern — read server-side, fetched from `/api/config`), combined with a live `window.innerWidth >= 900` check. Below 900px theatre is always off regardless of the switch, per the brief.

**Screen** (`components/screen.tsx`) — one addition only: an optional `className` prop so theatre mode can add `screen--theatre` (fills its container and `object-fit: cover` instead of the default 16:9-box-and-contain). The swap/buffer/last-frame logic is byte-for-byte what it was.

**Two-mode split.** Theatre and plain render the same `<Screen>`/ask-line/suggestions/strip tree; only the wrapper differs (`<Console>` vs a plain div) and two small state differences the brief calls for explicitly:

- Theatre: the ask-line cursor only ever shows idle (`#FFEE8C`, blinking) or pending (`#F7F7F7`, blinking) — the square key carries the ground-colour "rendering" state.
- Plain: there's no key, so the cursor absorbs all three states, per §Plain mode ("the square-key states move to the cursor") — idle yellow blink, pending white blink, and a **steady** (non-blinking) ground-colour fill while rendering, matching the key's own rendering behaviour.

This is a judgement call where the brief doesn't spell out the exact transition boundaries (e.g. whether "pending" ends the instant the first clip paints, or only once every beat has rendered); I used "pending" = asked but no picture on screen yet, which is unambiguous and matches "a question is pending" most literally.

**Strip card shape.** `answer.card` has never been populated by WP0's fixture (`data/diginex.json` — 0 of 12 records) and no field-name shape exists anywhere in the codebase. I wrote a defensive formatter (`formatCard` in `player.tsx`) that reads `ticker`/`symbol`, `price`/`last`, `changePercent`/`change`, `marketCap`/`mcap` and renders whatever is present in the brief's format (`dgnx · $1.38 · +1.47% · $37.83m`). This is a guess at the shape — flag to PM/Charles if the live platform's card object uses different keys.

## A bug the live test caught

Reading `window.innerWidth` inside a `useState` initializer for the 900px breakpoint produced a hydration mismatch (server has no `window`, so it always guessed "wide"; the client's first render — before any effect runs — could legitimately measure narrower). Fixed by always starting deterministic (`wide = true` on both server and first client render) and correcting it in a `useEffect` immediately after mount. No visible flash at any width I tested; console is clean on a fresh load.

## How to run

```bash
npm run dev   # http://localhost:3000
```

`THEATRE=on` is the default (add `THEATRE=off` to `.env.local` to force plain mode at any width). Ask a question; below 900px viewport width theatre mode is off regardless of the switch.

## What I verified live

I ran this against the real pipeline (fal render, not a mock) in the Browser pane:

- **Screen alignment** (criterion 1): confirmed at 1280px — the video sits exactly within the photographed screen bezel with no gap or overlap, at both the idle black state and with a real clip playing (`object-fit: cover` fills the box cleanly; the video element's own rect matches the console-screen bounds, not a 16:9 box).
- **Square key, all three states** (criterion 2): `off` on load (transparent, shows the photographed button), `listening` (white, blinking) on input focus, `rendering` (steady fill in the beat's ground colour — saw violet and lime across two different beats) while a clip generates. Confirmed via the DOM (`.console-key` class + computed style) and visually.
- **Ask line** (criterion 3): typed "What is Diginex", pressed Enter, `typed` cleared immediately, suggestions updated to the answer's real `followups` from a live Claude Opus 5 translation.
- **Suggestions** (criterion 4): three lines, squares cycling lime/cyan/violet, click-to-submit confirmed. I did not sit through a full 10-second idle window to watch the countdown auto-fire (each test question started a fresh session and I moved on to the next check) — the countdown/auto-continue code itself is unchanged from the working pre-WP4 player, so I'm not flagging it as a regression risk, just not re-confirmed by me today.
- **Strip** (criterion 5): disclosure line renders always; card segment untestable end-to-end since no fixture record has a populated `card` (see above).
- **Plain mode** (criterion 6): confirmed at 700px viewport width — console image drops, full-width 16:9 screen, identical ask line/suggestions/strip beneath, cursor carries the ground-colour rendering state directly (no key).
- **Interface compliance** (criterion 7): no gradients, cards, glass, rounded corners, shadows, icon sets or emoji anywhere in the new CSS; lowercase throughout; `#0E0E0F`/`#F7F7F7` base colours unchanged.
- Watched a real multi-beat programme play through two beats ("ONE PLATFORM" on violet, then "$77B MARKET" on lime) with clean hard cuts and no console errors.

**I could not attach screenshot image files to this handoff.** The Browser-pane tool in this session returns screenshots inline for me to look at, but I found no way to export them to a file on disk (checked the scratchpad and temp directories — nothing persisted). Everything above was seen directly, just not captured as a file. If a screenshot file is needed for the record, it'll need a manual capture or a headless-screenshot script added to `scripts/` — didn't want to add a new dependency (Playwright/Puppeteer) for that without asking first.

**Note on the test session:** this repo had a second `npm run dev` running concurrently for most of my testing (WP2, working in the same working directory at the same time — visible in `git status` and confirmed by `.next` cache ENOENT errors and repeated "Fast Refresh had to perform a full reload" in the server log). That caused several dropped/aborted requests and one stretch where the dev server 500'd on every request. None of it was caused by WP4's code — typecheck stayed clean throughout, and every failure traced to `.next/routes-manifest.json` or `.next/cache/webpack/*.pack.gz` races between the two processes. Restarting my own preview server (once) resolved it. Worth flagging to Robin/PM: two builders should not `npm run dev` in the same checkout at once.

## What is untested

- The strip with a populated `card` (no fixture data exists for it — see above).
- The 10-second countdown actually reaching zero and auto-submitting (logic unchanged from the pre-WP4 player, not re-watched today).
- `npm run build` / `next start` (only ran under `next dev`, consistent with WP0's note on the same).
- Saskia voice mode with the new chrome (`VOICE=saskia`) — I only exercised native voice; nothing in WP4 touches audio, so I don't expect an interaction, but didn't click through it.
- The exact 900px boundary pixel-for-pixel (tested at 700px and 1280px; the breakpoint itself is a plain CSS-free `window.innerWidth` check, not a media query, so it's exact by construction — just not re-verified at 899/900px specifically).
