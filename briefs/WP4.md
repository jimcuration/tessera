# WP4 — Player: the console frame, ask line, suggestions, strip

Owner: Builder · Status: Briefed · Depends on: WP0 handoff; `public/console.png` (the frontal console render, 5504×3072)

Read `CLAUDE.md` first, including the Interface section.

## Goal

Replace unreel's chrome with the Tessera player: the video playing on the screen of the Curation console, with the ask line, suggestions and strip beneath it. Two modes, one component. No other UI.

## The page

Background `#0E0E0F`. Nothing on the page except the elements below. Oskari where available; system sans fallback. Lowercase throughout. No gradients, cards, glass, rounded corners, drop shadows, icon sets or emoji.

## 1. The console (theatre mode)

- Render `public/console.png` centred, width 70% of the viewport (max 1400px), top margin 6vh. Preserve aspect ratio.
- The video element is positioned absolutely over the screen region of the image. Screen bounds as fractions of the image: **left 0.1317, right 0.6294, top 0.2155, bottom 0.7415.** Use `object-fit: cover`. Recompute on resize.
- The **square key** below the screen's bottom-right corner is a live element drawn over the image. Measure its bounds from the image (it is the only square element on the face; roughly x 0.65–0.69, y 0.68–0.74 — verify). States: **off** (matches the render); **listening** (blinks `#F7F7F7` at 1Hz while the input has focus or a question is pending); **rendering** (steady fill in the ground colour of the beat currently being generated — lime, cyan, violet or magenta as defined in the style sheet).
- The **yellow seam** between the two modules: steady while ≥2 clips are buffered; gentle 2s pulse while the runway is filling. Implement as a translucent overlay on the seam's bounds, not by editing the image.
- Knobs and small keys are decorative in WP4.

## 2. The ask line

Directly below the console, left-aligned to the screen's left edge. The text `curation` in `#F7F7F7`, followed by the cursor: a square the height of the x-height, blinking at 1Hz, in `#FFEE8C` when idle. The input field is invisible; typing appears after the cursor in the same type. Enter sends the question to `lib/curation.ts`. While a question is pending the cursor turns `#F7F7F7` and the square key on the console blinks in sync.

## 3. Suggestions

Three lines below the ask line, from the current answer's `followups` (fallback per WP0 when none). Each: a small square (0.6em, one of the four cursor colours, cycling in order) then the question in `#F7F7F7` at 80% opacity, 100% on hover. Clicking a line submits it. The first line carries a trailing countdown `· up next in 10s` in `#FFEE8C`, counting down while idle; at zero it auto-submits. Any interaction resets it. This replaces live-classroom's queue panel; do not port its layout.

## 4. The strip

One line at the bottom of the viewport, small, 60% opacity: `dgnx · $1.38 · +1.47% · $37.83m` from the record's `card` (omit if null), then `information, not investment advice`. Nothing else.

## Plain mode

`THEATRE=on|off` env switch, and always off below 900px viewport width. Plain mode drops the console image; the video is full-width at 16:9 with the same ask line, suggestions and strip beneath. The square-key states move to the cursor in the ask line.

## Out of scope

Chapter navigation, save/share, voice input, the knobs doing anything, animation of the console itself.

## Acceptance criteria

1. In theatre mode the video sits exactly within the screen region at all viewport widths ≥900px, with no visible bezel gap or overlap.
2. The square key shows the three states correctly during a real session: off, listening, rendering in the current ground colour.
3. The ask line accepts a typed question and submits on Enter; the cursor is the only visible affordance.
4. Suggestions render from `followups`, submit on click, and the countdown auto-submits the first at 10s idle.
5. The strip shows the card values when present and the disclosure always.
6. `THEATRE=off` and viewports under 900px render plain mode with identical behaviour.
7. No element on the page violates the Interface section of `CLAUDE.md`.

## Handoff

Write `briefs/WP4-handoff.md`: what you built, how to run it, what is untested. Include a screenshot of theatre mode and plain mode.
