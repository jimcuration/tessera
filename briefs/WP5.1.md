# WP5.1 — Face gate: rule 6 enforced in code after render

Owner: Builder · Status: Briefed · Depends on: WP5 merged to main. Runs alone or in its own worktree; recordings are shared.

Read `CLAUDE.md` first, then `briefs/WP5-report.md` §5.

## Why

Rule 6 (no recognisable people) has been a prompt rule. WP5 showed the video model can break it on a fully compliant beat: portraits appeared on "hole-punched tags." A strengthened sheet line held on one re-render, which is not proof. Every other hard rule that has stuck is enforced in code. This one joins them.

## Scope

1. **Face gate.** After a clip renders and before it enters the playback queue, sample three frames (0.5 s, 2.5 s, 4.5 s) and run a face detector — a small local model (OpenCV Haar cascade or a lightweight ONNX detector), no external API. Any detection above a conservative threshold: discard the clip, log the event to the recording JSON with frame index and score, and re-render the same prompt once. A second hit drops the beat and logs it; the programme continues on the existing hold-last-frame behaviour, no blank frame.
2. **Latency budget.** The gate adds less than 150 ms per clip on the server. Measure it and put the number in the report.
3. **Vocabulary.** Remove "hole-punched tags" from sheet line 4. Add to the chip description that chips carry only lettering.
4. **Reporting.** `npm run report` counts face-gate hits, re-renders and drops per session. Every future WP report includes them.
5. **Test.** Re-run the two WP5 translations that produced faces under the gate; report hits and outcomes. Run the six-beat spine to confirm zero false positives on the paper hands.

## Out of scope

Anything else in the sheet, translator or player.

## Acceptance criteria

1. A clip with a detected face never reaches the queue; the log shows frame, score and the re-render.
2. Gate latency under 150 ms per clip, measured.
3. Zero false positives on the six spine clips.
4. The two WP5 face-producing translations re-run with hits logged and no face in any played clip.
5. `npm run report` shows gate counts.

## Handoff

`briefs/WP5.1-handoff.md`: what changed, how to run it, what is untested. Do not mark criteria as passed.
