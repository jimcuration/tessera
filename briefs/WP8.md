# WP8 — Ten-second beats, per-scene Saskia

Owner: Builder · Status: Briefed · Depends on: main. Own worktree; recordings shared. Does not touch the style sheet, palette or console (WP7's files) or the face gate (WP5.1's).

Read `CLAUDE.md` first, then `briefs/WP0-report.md` §1 (render timing) and Decisions Log D31 (paste in `briefs/decisions-D31.md` if not present).

## Why

The narration feels stilted. A 12-word line is a headline, not a sentence, and each line is a separate ElevenLabs request, so Saskia starts every sentence cold. Render time is ~3 s per 5 s clip but only ~0.5 s of that is inference; the rest is fixed per request. A 10 s clip should render in ~4 s against 10 s of playback, so the runway gets more comfortable. Interruption granularity mattered when the voice was baked into the clip; with Saskia detached, an interrupt cuts her instantly and the picture holds.

## 1. Clip length as config

- `CLIP_SECONDS=5|10`, default 5 for now. Passed to the fal request duration.
- The translator's word budget scales: 12 words at 5 s, 22 words at 10 s (hard limit in `npm run check`). The translator is told a 10 s beat may contain one internal shape-match cut at ~5 s, written as two timecoded halves in `action` (`[0–5 s] … [5–10 s] …`), and that the line is one sentence, or two short ones, not a list.
- Recording JSON records `clip_seconds`; `npm run report` groups timing by it.
- Player: nothing changes except that the buffer target is expressed in seconds of playback (≥ 10 s ahead), not clip count.

## 2. Saskia per scene

- Generate audio per **scene** (2–3 lines in one request, with the `delivery` tags), not per line. Request word-level timestamps from ElevenLabs; split the returned audio at sentence boundaries into one file per beat. If timestamps are unavailable on the model in use, fall back to silence-gap splitting and report it.
- Start each beat's audio on its clip's first frame, as now. If a scene's audio for beat N runs past clip N, it continues (no stretching), as now.
- Every request still recorded to `recordings/<session>/voice-*.json` with model, settings, text, timestamps.

## 3. Render and compare

- Spine at `CLIP_SECONDS=5` (current) and `CLIP_SECONDS=10`; both with per-scene Saskia; both chained, music on. Two live translations at 10 s.
- `reels/spine-5s-vs-10s.mp4` side by side (each with its own audio; the viewer toggles, or produce two reels).
- `briefs/WP8-report.md`: render time per clip vs clip length (p50, max, and the ratio render/playback); time to first frame; words per line; Whisper on nothing (Saskia is TTS) but a check that each beat's split audio contains its own `line` text and no neighbour's (use ElevenLabs timestamps or a quick Whisper pass on the split files); seam count per minute at each length; subjective notes left blank for Robin.

## Out of scope

Style sheet, palette, console, face gate, translator content rules beyond the word budget and the internal-cut instruction.

## Acceptance criteria

1. `CLIP_SECONDS` switches 5/10 without code changes; fal requests carry the right duration; `npm run check` enforces 12/22 words accordingly.
2. At 10 s, p50 render time per clip is below 60% of playback time (≤ 6 s), measured.
3. Saskia audio is generated per scene and split per beat; each split file contains only its own line (verified).
4. Every voice request recorded with timestamps.
5. Reels and report exist; the 10 s spine plays through in the app with no blank frames.
6. No people in any clip (or face-gate hits reported if WP5.1 is merged).

## Handoff

`briefs/WP8-handoff.md`. Do not mark criteria as passed.
