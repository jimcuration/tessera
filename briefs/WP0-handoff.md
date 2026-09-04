# WP0 — Handoff

Builder: Claude (Fable 5.1), 4 September 2026. Companion documents: `briefs/WP0-report.md` (the numbers and reels), `README.md` (how to run).

Criteria are not marked passed here; that is the reviewer's job.

## What I built

**Answers in** (`lib/curation.ts`, `catalog/titles.mjs`, `data/diginex.json`). One title, Diginex. `getAnswer(question)` resolves a typed question to a captured record: exact match first, then word-overlap above a threshold, else `null` (the UI says "no captured answer for that yet" and offers the spine). Each answer is split into numbered sentences (`splitSentences`) that beats cite. Deflection records and `no_suggestions_returned` records are handled per scope item 7. The spine questions are the five captured questions listed in `SPINE_QUESTIONS`; every one has an answer, so auto-continue never lands on a dead end.

**Translator** (`lib/translator.ts`, `app/api/translate/route.ts`). A fresh Claude prompt (`claude-opus-5`, streaming) that takes the numbered sentences and returns beats as NDJSON, one per line, so the first clip starts rendering while the rest are being written (first beat typically 3.5–4.7 s after asking, whole answer 15–18 s for ten beats). The translator rule is enforced in code by `validateBeat`: a beat with no valid `source` is dropped and logged (server console, the `dropped` event on the stream, and `session.json`). Soft findings (line over 18 words, headline over 4 words, a headline number not present in the cited sentences) are recorded as warnings and never rewrite the text. Translations are cached in `data/translations/<sha1 of answer>.json` so the same answer stages the same beats across voice and chain runs; `TRANSLATE_CACHE=off` bypasses. The six-beat exemplar from the brief is pinned there for the cash-position answer, hand-mapped to sentence indexes, so the spine reels compare like for like. Deflection records build a single beat in code (the link as the headline) with no model call.

**Style** (`lib/prompt.ts`). Tessera Style Sheet v0.1 as a numbered list, compiled style sheet → beat → copy list → audio block. Line 2 is filled with the beat's ground by name (never hex). Audio block A quotes the line for native; block B for Saskia. The prompt is identical across CHAIN modes; only the image conditioning differs.

**Switches** (`lib/config.ts`, `/api/config`). `VOICE`, `CHAIN`, `RENDER` (and the dev knob `TRANSLATE_CACHE`) are read from the environment on every request and fetched by the client at each ask, so flipping them in `.env.local` takes effect on the next question without a restart (verified with Next dev, which reloads `.env.local`). Saskia narration is one ElevenLabs request per beat line (`/api/voice`, voice `QMSGabqYzk8YAneQYYvR`, `eleven_multilingual_v2`), prefetched as beats arrive with a concurrency cap of two and two retries (the account allows five concurrent requests; the first run hit a 429 on one beat before the cap existed). Playback is sentence-to-clip: line N starts with clip N, or when line N−1 finishes if that runs late. `RENDER=director` throws `not implemented in WP0` (`lib/render.ts`) and the UI shows it.

**Program guide** (`components/player.tsx`). Suggestions under the screen from the answer's `followups` (spine fallback), three lines, each with a small cursor square. The top line is the up-next slot: once the programme ends, `· up next in 10s` counts down and auto-submits; typing pauses it. Interrupting cancels the translation fetch, stops the stream, cancels every fal request in flight (`fal.queue.cancel`, visible as `[session] cancelled N render(s)` in the console) and stops the narration; the picture stays up until the new answer's first clip has painted.

**Screen** (`components/screen.tsx`). Two persistent `<video>` slots: front plays, back preloads the next clip; when the front ends and the next is decoded the roles swap. If the next clip is late the front freezes on its last frame until the incoming first frame is painted. Every swap logs its `readyState` (`[screen] beat n → …`); all observed swaps were at readyState 3 or 4, i.e. no blank frames. This replaced unreel's re-keyed element, which showed a black frame while the new element fetched through the media proxy.

**Recording** (`lib/recorder.ts`, `app/api/record/route.ts`). Every clip is saved to `recordings/<session>/<n>.mp4` with `<n>.json` (beat, cited sentences, warnings, compiled prompt, fal's `expanded_prompt`, request id, seed, endpoint, chained flag, render ms, fal timings). `session.json` holds the question, the matched record, the sentences, switches, translation source and timing, beats kept, dropped and warnings. Saskia tracks are saved as `<n>.mp3`. Session ids carry the switches: `<stamp>-<question-slug>-<voice>-chain-<on|off>`.

**Scripts** (`scripts/`). `check.mjs` (`npm run check`): scans recordings and translations, fails on any beat without a valid source, lists soft warnings. `reel.mjs`, `compare.mjs`, `contact-sheet.mjs`, `whisper-match.py`, `report.mjs`: the tooling behind the report. `ffmpeg-static` supplies the binary; Whisper uses the locally installed `openai-whisper` (medium model, CPU).

**Interface.** unreel's browse page, billboard, nav, rows, title sheet, profile menu, catalog covers and generate-catalog script are removed. The page is the screen, the ask line with the square cursor (blinks while listening, blinks in the ground colour of the beat being rendered), the suggestions, and a one-line status when something needs saying (`no captured answer for that yet`, `tap for sound`, an error). Lowercase throughout via CSS; system sans; background `#0E0E0F`; nothing else.

## Changes to the runtime (read this)

CLAUDE.md rule 3 says not to touch `lib/stream.ts` buffer logic. The buffer logic is unchanged: `MAX_BUFFER`, `pump()`, `render()` including the lastFrame chain and the frame-grab recovery, `noteRender`, and the player handshake. What I changed around it, each necessary for Tessera and each flagged in the file header:

1. Shots come from the translator via `addShots()` / `finish()` instead of the showrunner's `refill()` batches. There is no cold open: beat 1 is a text-to-video shot rendered by the same `render()`.
2. `CHAIN=on|off` replaces the story/chaos title mode (`isStory` reads the chain flag; unchained programmes render two at a time as chaos channels did).
3. A terminal `ended` phase, set in `advance()` when the translator has finished and every shot has played, so the guide knows when to count down.
4. `renderingShot()` exposes the beat in flight for the cursor colour.
5. **Playback order.** Unchained renders finish out of order; unreel's queue handed clips to the player in completion order, which played beat 2 before beat 1 in the first CHAIN=off run. `peekNext()`/`advance()` now take the shot at `playIndex` in writing order, skipping shots that failed to render. This touches the queue's read side only.

`lib/fal.ts` now uses `fal.queue.submit/subscribeToStatus/result` instead of `fal.subscribe` so requests can be cancelled on interrupt, always sends `prompt_expansion_mode: "balanced"` (the API accepts only `balanced|quality`; the style sheet is written for the rewriter), and reports every clip to the recorder. The media proxy and the fal server proxy are untouched.

## How to run

```bash
npm install
cp .env.example .env.local   # add FAL_KEY, ELEVENLABS_API_KEY, ANTHROPIC_API_KEY
npm run dev                   # http://localhost:3000
```

Type `What is the cash position and runway?` and press Enter for the pinned spine. Any other captured question goes through Claude live (about $0.05–0.10 per answer at Opus 5 rates; cached after the first run). Flip `VOICE` / `CHAIN` / `RENDER` in `.env.local` and ask again. `npm run check` after a session. The reels are in `recordings/reels/`; the report in `briefs/WP0-report.md`.

## What is untested

- `npm run build` / `next start`. Everything ran under `next dev` (I did not want a production build to clash with the running dev server's `.next`). `npm run typecheck` passes.
- Saskia audio as heard. I cannot listen. The narration files exist for every spine beat, the player's chaining logic is exercised (no console errors), the reel muxes them at the computed offsets, and Whisper confirms the Saskia clips themselves are wordless. Whether the ElevenLabs voice sounds right and whether the sentence-to-clip alignment feels natural need a human ear. The same applies to the "subjective voice-consistency 1–5" column in the report: I have left it for Robin and given the objective proxies instead.
- Autoplay-with-sound in a fresh browser profile. In the test browser the Enter keypress counted as the gesture and clips played unmuted; the `tap for sound` fallback is coded but was not triggered.
- The `no captured answer` path was exercised by auto-continue (a platform follow-up with no fixture record); the spine then took over as designed. Not exercised: a deflection record end to end in the player (the deflection beat is built in code and covered by `validateBeat`; `What is the timeline for the company to reach EBITDA breakeven?` will show it).
- Render failures. No fal request failed during the runs, so the skip-a-failed-beat path in `advance()` ran only in reasoning, not in practice.
- Viewports under 900 px. The layout is a single column and should degrade, but WP4 owns the plain mode.

## What I could not do, and why

- **Subjective voice-consistency 1–5 across the six spine clips.** Needs listening. Proxy in the report: Whisper word recall per clip and whether a clip produced speech at all (one of six native clips was silent).
- **Cost per clip at the promo rate.** The brief gives the post-promo rate ($0.025/s at 480P, so $0.125 per 5 s clip and $1.50 per 60 s); I have not found the promo rate in the repo or the brief, so the report states the post-promo figure and the formula. fal's dashboard has the actual spend for today's runs.
- **Palette hex.** The four grounds are named in prompts. The interface needs hex for the cursor, so `GROUND_HEX` in `lib/prompt.ts` holds approximate values, marked as approximate until Jim confirms.

## Things the PM should decide (not relitigating, flagging)

- **Text beyond the copy list.** In every run the model prints its own text on props: calendar pages ("LARY", "Oheiol"), the aircraft's livery, document pages. The headline itself is accurate; the extra text is model behaviour that style-sheet line 10 does not suppress. The report has the per-clip detail.
- **Chained vs unchained.** Chaining gives true continuity (each clip literally opens on the previous frame) but the model then sometimes covers or delays the headline (beat 1's `$1.85M` half-hidden by the coin stack; beat 4's `1.4 MONTHS` appearing late) because the composition is inherited. Unchained clips render the headline cleanly 6/6 and 20–30% faster, but every cut is a hard cut. Both reels and the side-by-side are in `recordings/reels/`.
- **Native vs Saskia.** Native spoke 5 of 6 spine lines word-perfect (allowing for digits vs words) and was silent on beat 6. Saskia clips are reliably wordless and the narration is separate, so the voice is consistent by construction; the trade is that the mouthless narration is not tied to the picture's timing.
- **The exemplar's beat 5 is 20 words**, over the schema's 18-word limit; `npm run check` warns on it. I rendered it as written rather than edit the PM's text.
- **Auto-continue on an unanswerable follow-up.** The platform's own follow-ups are not all in the fixture; when the top one has no record, the programme shows the message and the spine takes over on the next countdown. The live endpoint removes this.

## Housekeeping

- `recordings/` is gitignored except `recordings/reels/` (about 30 MB for the three reels). Session folders stay local.
- `data/translations/` is committed: the pinned spine plus the live translations produced today (`What is Diginex`, `What are the key risks for Diginex?`, `What are the key catalysts for Diginex?`).
- `public/console.png` (WP4's dependency) is untouched.
- Two dependencies added: `@anthropic-ai/sdk`, `ffmpeg-static` (dev).
