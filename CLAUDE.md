# CLAUDE.md — Tessera

Read this fully before doing anything in this repo. Then read the brief you were given in `briefs/`.

## What Tessera is

Tessera is CurationAI's video surface. When a visitor on the Curation site asks CurationAI about a company, Tessera takes CurationAI's answer and renders it, in real time, as a short programme in the Curation collage style with a Curation presenter voice. Suggested follow-up questions sit under the screen. The viewer can interrupt and steer at any point; if they don't, the programme continues into the top suggestion.

One line: **a more engaging way of talking to CurationAI.**

Tessera is a **bridge, not a brain.** Knowledge, retrieval and guardrails live in CurationAI's backend (owner: Charles Wells). Tessera stages what CurationAI says. It never adds a fact.

## Where this code came from

This repo is a fork of `blendi-remade/unreel` (MIT). Its runtime — shot queue, render buffer, last-frame chaining, two-element video swap, media proxy, fal server proxy — is what we are keeping. Do not reinvent it. Where we borrow ideas, they come from `internetphysics/live-classroom` (program guide, numbered-sheet prompt compiler) and `gokayfem/h3-max-education` (interrupt pattern, code-enforced safety policy).

## Roles

- **Robin** — product owner. Makes product, style and functionality calls. Holds all keys.
- **PM** — a Claude project in claude.ai. Writes briefs and acceptance criteria, reviews handoffs, keeps the Notion Decisions Log. If a brief conflicts with this file, stop and flag it in your handoff.
- **Builder** — you, if your brief is in `briefs/WPn.md`. Build exactly that scope. Write `briefs/WPn-handoff.md` when done: what you built, how to run it, what is untested.
- **Reviewer** — you, if you were told to review. Read only the acceptance criteria. Test each. Write `briefs/WPn-review.md` with pass/fail per criterion. Do not read the handoff first.

## Hard rules

1. **Translator rule.** The translator may compress, reorder and stage a CurationAI answer. It may not add facts, numbers, claims or characterisations that are not in the answer. Every beat carries a pointer to its source sentence(s). If a beat has no source, it does not render.
2. **Secrets.** `FAL_KEY`, `ELEVENLABS_API_KEY` and `ANTHROPIC_API_KEY` live in `.env.local` only. Never print them, log them, commit them, or ask for them. If they are missing, tell Robin and stop.
3. **Do not touch** `lib/stream.ts` buffer logic, the media proxy, or the fal server proxy unless a brief explicitly says so.
4. **Model.** `minimax/h3-max-turbo/text-to-video` and `minimax/h3-max-turbo/image-to-video`, 480p, 16:9, 5-second clips.
5. **No client branding.** Tessera is always Curation style. No client logos, colours or bespoke looks.
6. **No recognisable people** in generated imagery. Objects, machines, buildings, maps, coins, screens, vehicles, anonymous paper hands.
7. **Save everything.** Every clip, prompt and `expanded_prompt` goes to `recordings/` with the beat that produced it.
8. **One session per checkout.** Parallel work packages use separate git worktrees on their own branches; never run `npm run build` in a checkout where a dev server is running.

## The beat

The translator turns one CurationAI answer into a sequence of beats. One beat = one 5s clip.

```json
{
  "line": "spoken sentence, 18 words or fewer",
  "headline": "on-screen words, 4 or fewer, or null",
  "ground": "lime | cyan | violet | magenta",
  "subjects": ["halftone cutout objects, 1–3"],
  "action": "one clear cause-and-effect movement",
  "handoff": "the named shape this beat ends on, which the next beat transforms",
  "source": [0, 1]
}
```

`source` indexes sentences in the CurationAI answer. The translator prompt lives in `lib/translator.ts` and is versioned alongside the style sheet.

## Tessera Style Sheet v0.2

Every clip prompt = STYLE SHEET + BEAT + COPY LIST + AUDIO BLOCK. The style sheet is a numbered list because fal's prompt rewriter copies numbered lists and paraphrases prose. Keep it numbered. WP0 found fal's rewriter drops any line phrased as a prohibition (0/18 survival on "no brands" and "numbers never count up") while descriptive lines survive; v0.2 states everything as a description of the world, with a prohibition appended only where a description alone would not do.

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

Copy list block (this block survived every render; the number rule and the text rule now live here): "On-screen text: [exact strings]. These strings are printed complete and correct from their first visible frame and never change. They are the only lettering in the frame."

Audio block (default, wordless): "No voice, no speech, no dialogue, no lyrics. Light paper-slap and tape sound effects only; no music."

The native audio block (one narrator speaking the line, `VOICE=native`) stays in `lib/prompt.ts` for comparison but is no longer the default; Saskia (D20) is.

Palette hex values are approximate until Jim confirms. Do not invent new colours.

## Transitions

Seamlessness is the product. Every shot after the first renders image-to-video from the last frame of the previous shot. The player swaps video elements the instant one ends, holds the incoming clip's first frame until painted, and freezes on the last frame if the next clip is late. In collage the native transition is the match cut: each beat ends on a named handoff shape and the next beat opens by transforming it.

## Interface

Background `#0E0E0F`, text `#F7F7F7`, lowercase throughout, system sans until the Oskari webfont is added. No gradients, cards, glass, rounded corners, drop shadows, icon sets or emoji.

The square cursor is the input and the status indicator — it blinks while listening and blinks in the next beat's ground colour while rendering.

Suggestions are plain lowercase lines each prefixed with a small cursor square, not buttons.

Strip unreel's existing chrome to this; do not design beyond it.

## Decisions already made (do not relitigate)

Programme you can interrupt, not a chatbot. Suggestions under the screen with 10s auto-continue. 5-second clips. H3 Max Turbo at 480p. Text and graphics allowed in video for the prototype via the copy list. Voice architecture (native vs Saskia) is open and decided by WP0. Script Dojo is retired; the translator is new. Full log: Notion → Videos Wiki → Tessera → Decisions Log.

## Dates

fal promo pricing on H3 Max Turbo ends 7 Sept 2026. All WP0 renders happen before then.

## Notes

`filter: blur()` and `mix-blend-mode: screen` on the same element render nothing in Chromium; use layered box-shadow for soft glows.
