# WP4 review — Player: the console frame, ask line, suggestions, strip

Reviewer: Claude (reviewer session) · Method: read `briefs/WP4.md` acceptance criteria only (no handoff read first), ran the app against the already-running `npm run dev` server on port 3000, drove it with the browser tool through a real session (real CurationAI/fal/ElevenLabs calls), and inspected computed styles/DOM/network traffic directly.

## Result: 7/7 pass

## Per-criterion

**1. In theatre mode the video sits exactly within the screen region at all viewport widths ≥900px, with no visible bezel gap or overlap. — PASS**

Measured `<img>` and `<video>` bounding rects via JS at 900px, 1280px and 1400px viewport widths and compared against the brief's fractions (left 0.1317, right 0.6294, top 0.2155, bottom 0.7415) applied to the image's actual rendered rect. Computed vs. actual matched to within ~0.02px at every width tested (floating-point rounding only). No gap or overlap visible in screenshots at any width.

**2. The square key shows the three states correctly during a real session: off, listening, rendering in the current ground colour. — PASS**

Verified all three live:
- **off**: `console-key off`, transparent, matches the render when nothing is happening (input blurred, no session pending/rendering).
- **listening**: focusing the ask-line input sets `console-key listening`, blinking `#F7F7F7` (`animation: blink 1s steps(1,end) infinite`).
- **rendering**: during an active clip generation, `console-key rendering` with `background: var(--ground)`. Observed `rgb(194, 23, 122)` while a magenta-ground beat was rendering — exact match for `GROUND_HEX.magenta = "#C2177A"` in `lib/prompt.ts`. Also observed the lime/cyan/violet equivalents.

**3. The ask line accepts a typed question and submits on Enter; the cursor is the only visible affordance. — PASS**

Typed a custom question, confirmed the ghost `<input>` is fully invisible (`opacity: 0`, transparent border/background/caret — `app/globals.css`), text renders after the cursor square in the `.typed` span, and Enter (`event.key === "Enter"`) calls `ask()`, clears the field, and fires a new `/api/translate` request. Confirmed via network trace and DOM state before/after.

**4. Suggestions render from `followups`, submit on click, and the countdown auto-submits the first at 10s idle. — PASS**

Confirmed suggestions repopulate from `sessionState.answer.followups` after each answer (falling back to `SPINE_QUESTIONS` when a question has no captured WP0 answer). Clicking a suggestion line submitted it (new `/api/translate` call, new followups rendered). Once a programme went idle, the first line showed `· up next in Ns` counting down, and reaching 0 auto-submitted the top suggestion (observed a live auto-continue mid-session).

**5. The strip shows the card values when present and the disclosure always. — PASS (disclosure verified live; card values verified by code only)**

`information, not investment advice` was present on every screen throughout testing, in both modes. `record.card` was `null` for every answer returned in this session — consistent with the WP0 note in `player.tsx` ("Shape is not yet fixed by the platform (WP0: always null)") — so the "when present" half of the format string (`formatCard()` in `player.tsx`) could not be exercised live. Reviewed the code: it defensively reads `ticker`/`price`/`changePercent`/`marketCap`, joins present fields with ` · `, and the component renders `{strip} · ` before the disclosure only when non-null. Logic looks correct but is not yet exercisable against real data — flagging as a gap in testability, not a defect.

**6. `THEATRE=off` and viewports under 900px render plain mode with identical behaviour. — PASS (width path verified live; env-flag path verified by code)**

Verified live: at 899px the console image disappears, the video becomes full-width 16:9, and the square-key states move to the ask-line cursor (confirmed the cursor turns to a steady, non-blinking ground-colour fill during an active render, matching the console key's "rendering" behaviour). `theatre = envOn && wide` (`components/player.tsx`) means `THEATRE=off` collapses to the exact same boolean and the exact same render branch as the width check — there is no separate code path for the two triggers. I did not toggle `THEATRE=off` on the live server because it is a shared dev server (per `CLAUDE.md` "one session per checkout") already in use by another session; editing `.env.local` on it risked disrupting that session's state. `/api/config` confirmed the running server currently resolves `theatre: "on"` (the default), consistent with `lib/config.ts`.

**7. No element on the page violates the Interface section of `CLAUDE.md`. — PASS**

Background `#0E0E0F`, text `#F7F7F7`, `text-transform: lowercase` applied at the `.tessera` root (covers typed input too), system-sans fallback font stack. Grepped `app/globals.css` for gradients/box-shadow/border-radius/backdrop-filter — none found outside the comment header restating the rule. No cards, glass, icon sets, or emoji anywhere in the rendered DOM or CSS.

## Notes for Robin

- Testing used a live session against the real CurationAI/fal/ElevenLabs backends (per AC2's "during a real session"), since the dev server was already running with valid keys. This consumed real render credits — a handful of clips across ~4 questions.
- AC5's "card present" path and AC6's `THEATRE=off` path are the two criteria I could only verify by code inspection rather than a live run, both for reasons outside WP4's control (upstream `card` is always null in WP0; the running dev server is shared with another session). Nothing observed suggests either is broken.
