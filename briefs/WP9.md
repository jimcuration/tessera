# WP9 — Player states: waiting, caching, and what happens when the viewer does nothing

Owner: Builder · Status: Briefed · Depends on: wp8 merged to main; WP8.2 in progress (independent files). Own worktree; recordings shared.

Read `CLAUDE.md` first (Interface section), then `components/player.tsx`, `components/console.tsx`, `lib/stream.ts` (read only).

## Why

The picture and voice are settled enough to look at the journey. Robin: the glowing key doesn't need to be there; the real question is how long a viewer waits for the next piece of video, what happens if they do nothing, and how they know what's happening.

## 1. Key glow off

`KEY_GLOW=on|off`, default off. The square key shows as rendered in the image. The seam light stays as the buffer indicator. The ask-line cursor carries listening/working state.

## 2. Screen states (theatre and plain)

The video area has four states, drawn in the Interface style (Oskari, lowercase, `#F7F7F7` on `#0E0E0F`, no spinners, no icons):

- **idle** — no programme yet. Screen shows a single square cursor blinking, centred low-left, nothing else. The console is on and waiting.
- **assembling** — a question has been asked and the first frame isn't ready. Screen shows the word `assembling` with the blinking cursor after it, and beneath it one small line that updates as stages complete: `reading the answer` → `writing the programme` → `voicing scene 1` → `rendering scene 1`. Stage events come from the existing pipeline; add them where missing. No progress bar, no percentages.
- **playing** — video. If a clip is late and the last frame has held for more than 2.0 s, the cursor appears in the screen's lower-left corner, blinking, until the next clip starts.
- **end** — no suggestions left (see §4). Screen holds the last frame dimmed to 40%, with `ask me anything about diginex` and the blinking cursor. The ask line is focused.

## 3. Cached playback

Every rendered clip and Saskia track is already saved. Use them.

- When a question matches a record in `data/diginex.json` (exact or the existing nearest-match), and a complete recorded programme for that record exists under `RECORDINGS_DIR` for the current sheet version, palette, clip mode and voice settings, play it from the recording — first frame within 1 s. Log `source: cache` per clip.
- Otherwise render as now, and the result becomes the cache.
- `CACHE=on|off`, default on. `npm run cache` lists what's cached per record and version, and pre-renders any record that isn't (used before demos).
- Cache key includes the versions so a sheet or palette change invalidates cleanly.

## 4. Auto-continue rules

- Never auto-play an answer already played in this session. Skip to the next suggestion; if all three have been played, draw from the spine questions not yet played; if none remain, enter **end**.
- A viewer's click can replay anything; only auto-continue is restricted.
- Countdown stays 10 s and stays visible on the top suggestion.

## 5. Fast start (if time permits, otherwise report as not done)

In scene mode, render beat 1 alone as a 5 s clip in parallel with the full scene; play it first; the scene's clip takes over at its own beat-2 boundary. Only if the seam is clean; otherwise leave off behind `FAST_START=on|off` default off and report what it looked like.

## Measure

- Time to first frame for: cached answer; new 5 s-clip programme; new scene-mode programme (with and without fast start if built). Ten runs each, p50 and max.
- Count of holds > 2 s in a 3-programme session.
- Confirm auto-continue never repeats and reaches **end** correctly with the twelve records.

## Out of scope

Style, translator, face gate, voice alignment (WP8.2).

## Acceptance criteria

1. `KEY_GLOW=off` by default; key shows as rendered.
2. The four screen states render as specified in theatre and plain mode; stage lines update during a real assembling wait.
3. Cached answers start within 1 s; `npm run cache` lists and pre-renders; cache invalidates on version change.
4. Auto-continue never replays within a session and reaches **end** with the correct card.
5. Time-to-first-frame table reported for the three paths.
6. Nothing on screen violates the Interface section.

## Handoff

`briefs/WP9-handoff.md`. Do not mark criteria as passed.
