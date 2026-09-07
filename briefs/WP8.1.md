# WP8.1 — Scene generation at 15 s, connector and tag rules, music bed v2, pronunciation map

Owner: Builder · Status: Briefed · Depends on: WP8 (branch `wp8`). Same worktree. Decisions Log D33 is the source; this file is its definition.

## Why

The reference short is one 15 s generation: the model composed four compositions together, so a ribbon runs from one element to another and a small tag points at it. Tessera renders independent 5 s (or 10 s) clips; relational elements — connecting lines, small pointing labels — need two things in the same generation. This addendum tests generating one **scene** per fal request.

## 1. `CLIP_SECONDS=15` — one generation per scene

- A scene (2–3 beats, same ground, as already defined in the translator) becomes **one** fal request of 15 s. The compiled prompt writes the scene's beats as timecoded sections — `[0–5 s]`, `[5–10 s]`, `[10–15 s]` — each carrying its beat's `action`, `headline`, `handoff` and copy list entry, in the reference prompt's own shape (see `briefs/reference/reference-prompt.md`, the per-composition sections).
- A 2-beat scene renders as 10 s. Chaining continues from the scene's last frame into the next scene.
- Saskia per scene (already built) lines up one-to-one: one audio request, one video request, per scene.
- Player: beats within a scene are timestamps in one clip, not clip swaps. Suggestions, auto-continue and the key colour update on beat boundaries as now.
- The word budget stays 22 per beat.

## 2. Connector rule (translator, all lengths, applied at scene level)

Every scene names **one connector**: a paper ribbon, arrow or string that runs from one named element to another named element in the scene, in one direction, described physically ("an orange paper ribbon runs from the coin stack on the left to the calendar strip on the right"). The connector appears in one beat and persists for the rest of the scene. Field: `connector: { kind, from, to, colour }` on the scene. `npm run check` fails a scene without a connector or whose `from`/`to` aren't in the scene's `subjects`.

## 3. Tag rule (translator, scene level)

Each scene may carry **at most one small round paper tag, the size of a coin**, printed with one figure or ≤ 2 words taken verbatim from a cited sentence, pointing at the connector with a short black line. Described physically, never as a "label" or "chip". Field: `tag: { text, source } | null`. The tag text goes into the copy list. `npm run check` fails a tag whose text is not found in the cited sentence, or more than one tag per scene.

## 4. Music bed v2

Generate `RECORDINGS_DIR/music/bed-v2.mp3`: 2–3 minutes, same register (plucked bass, dry drum hits, short marimba phrases, sparse, beneath a voice), with a crossfaded loop point. Do not overwrite `bed.mp3`. Add `MUSIC_BED=bed|bed-v2` (default `bed` until Robin has heard v2). Record the prompt and licence.

## 5. Pronunciation map

`data/pronunciations.json`: `{ "Diginex": "Didge-in-ex" }` to start. Applied to `delivery` only, never to `line`, the copy list or the checks. Add "Diginex" occurrences to the Whisper split check as a consistency count (same transcription each time = pass).

## Render and compare

- Spine at 15 (scene generation) with connector and tag rules; the two live translations at 15.
- `reels/spine-5-vs-10-vs-15.mp4`, each with its own audio (three files or one with a toggle).
- `briefs/WP8.1-report.md`: render time per scene vs playback (ratio); time to first frame; per scene — connector present and joining the named elements (yes/no), tag present, correct text, coin-sized (yes/no); beats within a scene distinct at 5/10/15 s frames (yes/no); Diginex transcription consistency; split integrity as WP8.

## Acceptance criteria

1. `CLIP_SECONDS=15` renders one request per scene with timecoded sections; player treats beats as timestamps; no blank frames.
2. Connector and tag fields emitted and check-enforced as above; exemplar updated and passing.
3. Spine at 15: ≥ 2 of 3 scenes show the connector joining the named elements; ≥ 2 of 3 tags render coin-sized with correct text.
4. p50 render/playback ratio at 15 s ≤ 0.6; time to first frame reported.
5. `bed-v2.mp3` exists with a crossfaded loop; `MUSIC_BED` switch works; `bed.mp3` untouched.
6. Pronunciation map applied to `delivery` only; Diginex transcribes consistently in ≥ 8/10 occurrences.
7. Reels and report exist.

## Handoff

`briefs/WP8.1-handoff.md`. Do not mark criteria as passed.
