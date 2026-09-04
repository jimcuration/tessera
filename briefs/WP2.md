# WP2 — Style Sheet v0.2, Translator v0.2, Saskia audio path

Owner: Builder · Status: Briefed · Depends on: WP0 done (report in `briefs/WP0-report.md`); WP4 may run in parallel (it touches the player, this touches prompts and audio)

Read `CLAUDE.md` first, then `briefs/WP0-report.md` §6 and §7 — this brief exists because of them.

## Goal

Rewrite the style sheet and the translator using what WP0 measured, make Saskia the default voice with a better audio path, and re-run the same three spine sessions so v0.2 is compared against v0.1 like for like.

## Why each change

- fal's rewriter copied every *descriptive* line (1, 2, 3, 5, 7, 8: 18/18) and dropped both *prohibitions* (9, 10: 0/18). v0.2 states prohibitions as descriptions of the world.
- Line 6 (no glow) survived 11/18. Same fix.
- Chained clips inherited the previous composition and occluded 2 of 6 headlines. v0.2 adds a layout law and an explicit exit instruction so chaining keeps its seams without losing headlines.
- Native voice was silent 1 clip in 6 and drifted. Saskia is the voice (D20). Her delivery was flat and loosely aligned; v0.2 improves both cheaply.
- One 19-word line made the narrator rush. The hard budget is 12.
- Reviewer saw faces in two clips. The people ban is enforced in code (D23).

## 1. Style Sheet v0.2

Replace the sheet in `CLAUDE.md` and `lib/prompt.ts` with this. Keep it numbered. Every line is a description; nothing is phrased as a prohibition except where a short one is appended to a description.

1. Modern editorial paper collage: bold magazine composition, refined 2D motion design, photographed flat under soft room light.
2. One flat block-colour paper ground fills the frame: lime green, pale cyan, soft violet or deep magenta, as the beat specifies. The ground is a single unbroken colour.
3. Subjects are black-and-white halftone photographic cutouts with rough white torn-paper edges: objects, machines, buildings, maps, coins, screens, vehicles, anonymous paper hands. Every cutout is a plain, unmarked object: calendar pages, documents, coins, screens and vehicles are blank and unprinted, with no lettering, numerals, symbols, liveries or marks on them.
4. Diagram elements are flat matte paper shapes and ribbons in cream, black, pale yellow, or the ground's contrasting colour, with real paper texture, print dots and small pieces of tape.
5. One consistent light from the upper left; each paper layer casts a small soft shadow.
6. Every surface is matte printed paper reflecting only the room light: cutouts, chips, ribbons and ground all read as photographed paper, with the same flat finish edge to edge. No glow, neon, bloom or halo anywhere.
7. Layout: the headline chip owns the upper third of the frame and stays uncovered; subjects and diagrams occupy the lower two-thirds. When the frame opens on a previous composition, its elements slide off or are covered in the first second and the new headline lands on clear ground.
8. Headline typography: one extra-bold sans-serif in black or cream, printed on a cream or black paper chip, large, with safe margins. Letterforms are accurate, complete and stable from the frame they appear in; the chip is printed once and does not redraw.
9. Motion: elements enter fast with slight overshoot and a stable landing, then hold a clear reading window; one strongest focus at a time; the camera is locked; movement starts on the first frame and a small loop continues at the end; no empty frames.
10. 16:9, exactly 5 seconds, one composition, at most one crisp cut.
11. Identity anchor: rough white torn edges on every cutout; small paper shadow from the upper-left light.

**Copy list block** (this block survived every render; the number rule and the text rule now live here):
"On-screen text: [exact strings]. These strings are printed complete and correct from their first visible frame and never change. They are the only lettering in the frame."

**Audio block (default, wordless):**
"No voice, no speech, no dialogue, no lyrics. Light paper-slap and tape sound effects only; no music."

The native audio block stays in `lib/prompt.ts` behind `VOICE=native` for comparison but is no longer the default.

## 2. Translator v0.2 (`lib/translator.ts`)

Amend the prompt and the checks:

- **Line budget: 12 words maximum, hard.** The translator rewrites to fit; `npm run check` fails a beat over 12.
- **People never appear in `subjects`.** Add to the prompt: subjects are objects, machines, buildings, maps, coins, screens, vehicles, anonymous paper hands; people, faces, figures, characters and named individuals are represented by objects (a chair, a desk, a signature, a nameplate). `npm run check` fails any beat whose subjects match a people lexicon (person, people, man, woman, face, figure, executive, CEO, worker, customer, crowd, character, and proper names).
- **Headline numbers** must appear in a cited sentence, with one allowed derivation: a count of items enumerated in that sentence (e.g. four named acquisitions → `4`). Any such count emits a `check` warning naming the sentence.
- **Exit instruction:** each beat's `action` states which elements of the previous handoff leave and how (slide off, flip, are covered) before the new headline lands.
- **Ground colour** holds for 2–3 consecutive beats and changes on a topic turn (already the behaviour; make it explicit).
- Update the pinned spine exemplar in `data/translations/` to v0.2 (beat 5 is over budget; split or cut it).

## 3. Saskia audio path

- Generate ElevenLabs audio **per line**, not per programme. Start line N on the first frame of clip N. If line N runs past clip N, it continues; if it ends early, silence until N+1. No time-stretching.
- Run a short settings pass on Saskia and record it: three renders of the six-line spine with different stability / style / similarity settings (start from the account's defaults, then lower stability and raise style in two steps). Save all three as `recordings/reels/spine-saskia-v0.2-{a,b,c}.mp4`. Robin picks by ear.
- Concurrency stays at two.

## 4. Re-run and measure

Render the same three spine sessions as WP0 (native/chain-on, saskia/chain-on, native/chain-off) under v0.2, plus the two live translations (`What is Diginex`, `What are the key risks for Diginex?`). Write `briefs/WP2-report.md` with the same tables as WP0 §1, §3, §6, §7, side by side with the v0.1 numbers, plus:

- count of clips with any lettering outside the copy list (WP0: extra text on every calendar, coins, documents, aircraft)
- count of clips with a brand-like mark or livery (WP0: 1)
- headline exact-at-mid-clip for chained runs (WP0: 4/6) — the layout law is judged by this number
- `npm run check` results: beats over 12 words, beats with people, derived-count warnings
- one chained-vs-unchained side-by-side reel under v0.2

## Out of scope

Palette hex changes (Jim's values land as a one-line edit later; use WP0's names for now). Reference-to-video. Director. Player UI (WP4).

## Acceptance criteria

1. The style sheet in `CLAUDE.md` and `lib/prompt.ts` is v0.2 as above; `expanded_prompt` for a fresh render contains no bare prohibition lines.
2. `npm run check` fails a beat over 12 words, fails a beat with people in `subjects`, and warns on a derived count; passes on the updated exemplar.
3. `VOICE=saskia` is the default; audio is generated per line and starts on its clip's first frame (verified in the recorded reel).
4. Three Saskia settings reels exist for Robin to choose from.
5. `briefs/WP2-report.md` contains the side-by-side tables, and the survival grid shows every v0.2 sheet line surviving in ≥15/18 clips.
6. Chained headline exact-at-mid-clip is ≥5/6 under v0.2, or the report explains why the layout law failed.
7. Lettering outside the copy list appears in fewer clips than in WP0, with counts stated.

## Handoff

`briefs/WP2-handoff.md`: what changed, how to run it, what is untested. Do not mark criteria as passed.
