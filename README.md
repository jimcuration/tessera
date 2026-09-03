# UNREEL

**Endless television. Written and rendered while you watch.**

A streaming service where nothing on it existed until you pressed play.
Every cover is painted by [Nano Banana 2](https://fal.ai/models/fal-ai/nano-banana-2).
Every clip is rendered live by [MiniMax H3 Max Turbo](https://fal.ai/models/minimax/h3-max-turbo/text-to-video)
on [fal](https://fal.ai), which generates video *faster than it plays*.
That single fact is what makes an infinite channel possible: the next shot
is always finished before the current one ends.

## What is on it

- **Original films.** Pick a title and a showrunner LLM writes the episode
  in batches of shots. Each shot chains from the exact last frame of the
  previous one (image-to-video), so the film is one continuous take that
  actually tries to tell its story. Dialogue is scripted word for word and
  shown as subtitles.
- **Live channels.** Brainrot, on purpose: Capybara News Network, Goblin
  Tax Season, Toaster Court, Dad Rock Volcano. Hard cuts, escalating,
  never the same twice.

22 titles ship in the catalog. Add your own in `catalog/titles.mjs`.

## How it works

```
browse ──► press play ──► pre-generated preview plays instantly (cold open)
                               │
                               ▼
        showrunner LLM writes 10 shots ──► shot 1 renders from the preview's last frame
                               │              while the preview is still playing
                               ▼
        player swaps to the next ready clip the instant the current one ends
        (the buffer grows, because Turbo renders ~2x faster than realtime)
```

- **Catalog build** (`npm run catalog`): one Nano Banana 2 key-art cover and
  one 6-second Turbo preview per title, written to `public/catalog/`.
  The preview is the card hover, the billboard loop, *and* the cold open.
- **Stream** (`lib/stream.ts`): a small state machine that keeps up to
  three rendered clips buffered. Story titles chain (continuity is the
  frame); chaos channels hard-cut and render two shots in parallel.
- **Showrunner** (`lib/showrunner.ts`): Gemini via fal's LLM router writes
  shot prompts with a beginning, escalation, and an end hook per batch, and
  hands a synopsis forward so the next batch continues the story.
- **Speech**: the video model babbles unless voices are declared wordless,
  and pronounces a line cleanly only when it is quoted verbatim. The prompt
  grammar handles both; captions show the scripted line.
- Your `FAL_KEY` stays server-side (`@fal-ai/server-proxy`); clips stream
  through a same-origin media proxy so last-frame grabs never hit CORS.

## Quick start

```bash
npm install
cp .env.example .env.local   # add your fal key
npm run catalog              # paints 22 covers + films 22 previews (~2 min)
npm run dev
```

Get a key at [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys). The
catalog build costs about $0.08 per cover and $0.06 per preview.

## Cost while watching

A story title renders an 8-second 768P shot roughly every 8 seconds of
playback; a chaos channel renders 5-second shots. At Turbo's current rate
that is well under a dollar for a ten-minute session, plus a few small LLM
calls. Close the tab to stop.
