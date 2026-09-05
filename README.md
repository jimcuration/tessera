# tessera

CurationAI's video surface. A visitor asks CurationAI about a company; Tessera takes the answer and renders it, live, as a short programme in the Curation collage style with a presenter voice. Suggested follow-ups sit under the screen; the viewer can interrupt at any point, and if they don't, the programme continues into the top suggestion.

Tessera is a bridge, not a brain. It stages what CurationAI says and never adds a fact. Read `CLAUDE.md` before touching anything; the work packages live in `briefs/`.

Forked from [blendi-remade/unreel](https://github.com/blendi-remade/unreel) (MIT). Its runtime is kept: the shot queue and render buffer (`lib/stream.ts`), last-frame chaining, the two-element video swap, the media proxy and the fal server proxy.

## How a programme works

```
a question
  │
  ├─ lib/curation.ts finds the captured CurationAI answer (data/diginex.json)
  ├─ /api/translate streams beats from the translator (Claude) as NDJSON;
  │  any beat without a source is dropped and logged
  ├─ lib/prompt.ts compiles each beat: style sheet → beat → copy list → audio
  └─ lib/stream.ts renders beat 1 text-to-video, then every beat after it
     image-to-video from the previous clip's last frame (CHAIN=on)
        │
        ▼
  the player swaps to the next clip the instant the current one ends,
  or holds the last frame until it exists; interrupting keeps the picture
  up until the new answer's first clip is painted
```

Every clip, its beat, its prompt and fal's `expanded_prompt` are saved to `<RECORDINGS_DIR>/<session>/<n>.{mp4,json}` — `RECORDINGS_DIR` (`lib/config.ts`) defaults to `../tessera-recordings`, shared by every checkout and worktree (CLAUDE.md rule 8).

## Quick start

```bash
npm install
cp .env.example .env.local   # add FAL_KEY, ELEVENLABS_API_KEY, ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000, type a Diginex question (or click a suggestion), press Enter.

## Switches

Read from `.env.local` on every request; change them and ask again.

| Variable | Values | Meaning |
|---|---|---|
| `VOICE` | `native` \| `saskia` | native: the video model speaks the line. saskia: wordless clips, ElevenLabs narration layered in the player |
| `CHAIN` | `on` \| `off` | on: image-to-video from the previous clip's last frame. off: text-to-video every clip, two at a time |
| `RENDER` | `queue` \| `director` | queue: the unreel shot queue. director: not implemented in WP0 |
| `TRANSLATE_CACHE` | `on` \| `off` | serve translations from `data/translations/` when present (the spine is pinned there) |

## Scripts

```bash
npm run check                                   # translator rule: flags any recorded beat with no source, exits 1
npm run reel -- recordings/<session> --out recordings/reels/x.mp4 [--narration]
npm run contact -- recordings/<session> [--at first|mid|last]
npm run whisper -- recordings/<session>        # word-match per clip (openai-whisper, CPU)
npm run report -- recordings/<session> [...]   # numbers for the WP report
```

## Stack

Next.js 15, React 19, TypeScript. fal for video (MiniMax H3 Max Turbo, 480P, 16:9, 5s), Anthropic for the translator, ElevenLabs for the Saskia voice. `ffmpeg-static` for the recording scripts.
