# WP0 — Fork unreel, retarget to Diginex, Tessera style, voice A/B

Owner: Builder · Status: Briefed · Depends on: `.env.local` with `FAL_KEY`, `ELEVENLABS_API_KEY` and `ANTHROPIC_API_KEY`; `data/diginex.json`

Read `CLAUDE.md` first. This brief assumes you have.

## Goal

Turn the unreel fork into a working Tessera prototype on one company (Diginex), in the Tessera collage style, with two switches that let the team compare voice architectures and chained vs unchained rendering. Produce the numbers and reels that decide those two questions.

## Translator exemplar

The exemplar sequence acceptance criteria 6 and 7 refer to. Each row is one beat; `Picture` maps to the beat's `subjects` + `action`.

| # | Ground | Line (spoken) | Headline | Picture | Handoff |
|---|--------|----------------|----------|---------|---------|
| 1 | violet | At the end of September, Diginex held one point eight five million dollars in cash. | $1.85M | A single halftone stack of paper coins on a cream chip | the coin stack |
| 2 | violet | Six months earlier it was three point one one million — the burn shows a company mid-transition. | $3.11M → $1.85M | The stack shrinks; a torn-paper arrow points down | the arrow |
| 3 | magenta | Operating burn ran about one point three million a month. | $1.3M / MONTH | The arrow becomes a paper calendar strip; coins slide off it month by month | the strip |
| 4 | magenta | At that rate, the cash on hand covered roughly one point four months. | 1.4 MONTHS | The strip is a runway; it's torn short with a cutout aircraft near the end | the runway |
| 5 | lime | An eleven point four million warrant exercise kept the company afloat — and October added thirteen point eight million more. | +$13.8M | Fresh paper coins are taped onto the runway, extending it | the extended runway |
| 6 | lime | Survival depends on capital markets; the next two quarters show whether revenue can narrow the gap. | NEXT 2 QUARTERS | Two paper calendar pages land; a hand points at the second | the pointing hand |

## Scope

Keep the runtime untouched: shot queue, render buffer, last-frame chain, two-element swap, media proxy, fal server proxy.

1. **Answers in.** Replace `catalog/titles.mjs` with a single Diginex title. Its premise comes from `data/diginex.json`: an array of `{ question, answer, followups }` records captured from the live CurationAI. Load it behind an interface (`lib/curation.ts`, e.g. `getAnswer(question) → { answer, followups }`) that a streaming endpoint will later satisfy without changing callers.
2. **Translator.** Replace the Gemini showrunner with the Tessera translator in `lib/translator.ts`: a Claude prompt that takes one answer and returns beats in the schema in `CLAUDE.md`. Enforce the translator rule in code: any beat without a `source` is dropped and logged. Write the prompt fresh — Script Dojo is retired and not a dependency.
3. **Style.** Replace the visual style with Tessera Style Sheet v0.1 from `CLAUDE.md`, compiled in this order: style sheet → beat (ground, subjects, action, handoff, headline) → copy list → audio block. Put the compiler in `lib/prompt.ts`.
4. **Switches.** Three environment variables read at runtime, no code changes needed to flip them:
   - `VOICE=native|saskia`. Native: audio block A with the beat's line quoted. Saskia: audio block B (wordless), and the player plays an ElevenLabs track of the same lines (voice ID `QMSGabqYzk8YAneQYYvR`) as a continuous narration aligned sentence-to-clip. No attempt at tight sync.
   - `CHAIN=on|off`. On: image-to-video from the previous clip's last frame (existing unreel path). Off: text-to-video every clip.
   - `RENDER=queue|director`. Queue: build this. Director: stub that throws `'not implemented in WP0'`.
5. **Program guide.** Port from live-classroom: suggestions under the screen drawn from the answer's `followups`, an "up next" slot, and auto-continue to the top suggestion after 10 seconds idle. Interrupting cancels stale renders and keeps the current picture up until the first frame of the new answer exists.
6. **Recording.** Save every clip, its beat, its prompt and fal's `expanded_prompt` to `recordings/<session>/<n>.{mp4,json}`.
7. **Deflection and fallback records.** Records with kind `deflection` render as a single beat with the link as the headline and the answer's follow-ups as suggestions. Records with `no_suggestions_returned` true fall back to the spine questions for suggestions.

## Out of scope

Voice input. Multi-company. Client embeds. Localisation. Save/share. Production persistence. UI polish beyond what the runtime already has.

## Acceptance criteria

1. `npm run dev` starts; typing a Diginex question plays a programme of ≥6 chained beats with no blank frames between clips.
2. `VOICE` and `CHAIN` switches work without code changes.
3. Interrupting mid-segment starts the new answer without the screen going blank; stale renders are cancelled.
4. Suggestions appear under the screen and auto-continue fires after 10s idle.
5. Every beat records its source sentence(s); `npm run check` flags any beat with no source and exits non-zero if found.
6. `briefs/WP0-report.md` contains: render time per clip (p50, max); cost per clip and projected per 60s at post-promo rates ($0.025/s at 480p); Whisper word-match per clip for native voice; subjective voice-consistency 1–5 across the six spine clips; contact sheet of first frames; which style-sheet lines survived in `expanded_prompt` and which were dropped; headline and number render accuracy per clip.
7. `recordings/` contains two demo reels (native, saskia) of the six spine beats and one chained-vs-unchained comparison.

## Handoff

When done, write `briefs/WP0-handoff.md`: what you built, how to run it, what is untested, anything in this brief you could not do and why. Do not mark criteria as passed — that is the reviewer's job.

## Hard stop

All renders before 7 Sept 2026.
