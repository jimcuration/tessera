# WP4.2 — Console: optics, readout, pause, ask affordance

Owner: Builder · Status: Briefed · Depends on: main at 2b73f4a or later. Own worktree; recordings shared. Test with `AUDIO=off`.

Read `CLAUDE.md` first (Interface section), then `components/console.tsx`, `components/player.tsx`, `components/screen-status.tsx`.

## Why

Robin, 7 Sept, after running the merged build: the video still feels like it sits on top of the console rather than in its screen; the ticker gets lost at the page bottom and disappears on some answers; there's no way to pause; and the ask line wasn't obvious as an input.

## 1. Optics — the video sits in the screen

- **Inner shadow:** a 3–6 px soft dark gradient inside the screen edge, over the video and under the cutout, so the panel reads as recessed behind the gasket.
- **Glass highlight:** one faint diagonal lighter band across the screen at 4–6% opacity, screen blend, static.
- **Exposure match:** a CSS filter on the screen layer pulling the video's brightness down ~8–12% with a slight contrast lift, so the clip sits in the console's lighting rather than glowing above it. Tunable from one place.
- All three theatre-mode only. Before/after screenshot in the handoff.

## 2. Ticker readout on the bezel

- Move `dgnx · $1.38 · +1.47% · $37.83m` from the page-bottom strip to the bezel strip beneath the screen — the flat aluminium band between the screen's bottom edge and the console's lower chamfer, left of the square key. Oskari (or fallback), lowercase, small, `#F7F7F7` at ~70%, tracking slightly open, like a digital readout printed on the metal. Positioned by measured fractions like everything else on the console.
- **Persistence:** the readout shows the company's *last known* card for the session. If a record has no `card`, keep showing the previous one; never blank. Store per company in session state.
- The disclosure (`information, not investment advice`) stays at the page bottom, alone.
- Plain mode: the readout sits directly under the video, same type, same persistence.

## 3. Pause

- Click anywhere on the screen (theatre) or the video (plain) to pause: video, Saskia, music bed and the auto-continue countdown all stop together. Click again to resume. Keyboard space does the same when the ask line isn't focused.
- While paused, the ask-line cursor blinks slower (2 s) and the seam light dims to 50%. No pause icon, no overlay text.
- Interrupting (clicking a suggestion or asking) while paused resumes into the new programme.

## 4. Ask-line affordance

- Placeholder after the cursor: `ask about diginex` in `#F7F7F7` at 40% opacity, disappearing on focus and returning when empty and unfocused. Still no box, no button, no border.

## Out of scope

Style sheet, translator, cache, states other than pause, the deflection screen.

## Acceptance criteria

1. Video reads as recessed in the screen; before/after screenshot; no change in plain mode.
2. Readout renders on the bezel in theatre and under the video in plain mode; persists the last known card across records without one (test: play a card record, then a no-card record; readout unchanged).
3. Click pauses and resumes video, narration, music and countdown together; space works when the input isn't focused; interrupt while paused resumes into the new programme.
4. Placeholder shows until focus, returns when empty.
5. Nothing on the page violates the Interface section.
6. Positions stable at 900 / 1280 / 1400 px.

## Handoff

`briefs/WP4.2-handoff.md`. Commit on your branch before writing it. Do not mark criteria as passed.
