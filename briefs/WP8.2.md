# WP8.2 — Voice-led sections: the audio sets the timecodes and the clip length

Owner: Builder · Status: Briefed · Depends on: wp8 merged to main (scene generation, per-scene Saskia). Own worktree; recordings shared.

Read `CLAUDE.md` first, then `briefs/WP8.1-report.md` and Decisions Log D36 (`briefs/decisions-D36.md` if not present).

## Why

In scene mode the prompt states section timecodes at fixed 5 s intervals and the player starts each line at those marks. The model front-loads, so the picture for beat 2 often lands before Saskia has finished line 1: the voice lags the visuals. Saskia's audio is generated per scene *before* the video renders, so her timings are known. Use them.

## What to build

1. **Order of operations.** Per scene: translate → generate Saskia (already per scene, with timestamps) → compute per-beat durations from the timestamps → compile the video prompt → render. Today the last two steps don't depend on the audio; make them.
2. **Section boundaries from audio.** Each beat's section in the scene prompt runs from the end of the previous line to the end of its own line, plus a fixed lead: `[0 – d1+0.4 s] beat 1`, `[d1+0.4 – d1+d2+0.8 s] beat 2`, … Write them to one decimal place. Beat 1 starts at 0 regardless.
3. **Clip duration from audio.** Request the scene's total narration length plus 1.0 s of air, rounded up to the nearest second, clamped to fal's allowed range (record the range you find; if only fixed durations are accepted, choose the smallest that fits and pad the final section). Aspect ratio stays 16:9 explicitly on every request; record the returned aspect ratio (the WP8 screen-fill issue).
4. **Player.** Line N starts at its computed section start, not at a fixed interval. If audio for the scene is late, the existing hold-first-frame behaviour applies.
5. **Recording.** The recording JSON stores per-beat audio durations, the computed section boundaries, the requested and returned clip duration.
6. **Fallback.** If timestamps are unavailable (silence-gap path), use the split file durations; log which path was used.

## Render and compare

- Spine in scene mode, voice-led (this WP) vs fixed 5 s sections (WP8.1), same beats, same Saskia takes if cacheable.
- `reels/spine-scene-fixed-vs-voiceled.mp4`, side by side, voice-led audio.
- `briefs/WP8.2-report.md`: per beat — section start requested vs the frame at which the beat's headline first appears (from frames, seconds), and the line's audio start; the difference is the lag. Report mean and max lag for both versions. Also requested vs returned duration, and returned aspect ratio.

## Out of scope

Style, palette, translator content rules, face gate.

## Acceptance criteria

1. Section boundaries and clip duration are computed from the scene's audio; visible in the recording JSON.
2. Mean lag (headline first-appearance minus line start) under 0.5 s, max under 1.0 s, on the six-beat spine; both numbers reported for fixed and voice-led.
3. Every request asks for 16:9; returned aspect ratio recorded and equal to 16:9, or the deviation reported.
4. Spine plays through in the app with no blank frames and lines starting on their pictures.
5. Reel and report exist.

## Handoff

`briefs/WP8.2-handoff.md`. Do not mark criteria as passed.
