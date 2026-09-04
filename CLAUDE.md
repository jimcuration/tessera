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

## Tessera Style Sheet v0.1

Every clip prompt = STYLE SHEET + BEAT + AUDIO BLOCK. The style sheet is a numbered list because fal's prompt rewriter copies numbered lists and paraphrases prose. Keep it numbered.

1. Modern editorial paper collage. Bold magazine composition, refined 2D motion design.
2. One dominant flat block-colour background per shot: lime green, pale cyan, soft violet, or deep magenta, as specified by the beat. Never a rainbow, never a gradient.
3. Subjects are black-and-white halftone photographic cutouts with rough white torn-paper edges: objects, machines, buildings, maps, coins, screens, vehicles, anonymous paper hands. Never a recognisable person's face.
4. Diagram elements are flat matte paper shapes and ribbons in cream, black, pale yellow, or the background's contrasting colour. Real paper texture, print dots, small tape pieces.
5. Consistent upper-left light. Small paper-layer shadows only.
6. Everything is flat matte printed paper. No glow, no neon, no bloom, no halos, no luminous edges. Nothing emits light. Not glossy 3D. Not live action.
7. Headline typography: one extra-bold sans-serif, black or cream, printed on paper chips, large, safe margins. English spelling and letterforms accurate and stable. Only the headline text in the copy list, nothing else.
8. Motion: elements enter fast with slight overshoot and a stable landing, then hold a clear reading window. One strongest visual focus at a time. No camera shake. Movement starts on the first frame; a small loop continues at the end. No empty frames.
9. Numbers, when specified, are printed complete from their first visible frame. Never counting up, never morphing, never redrawn.
10. No brands, logos, watermarks, or text beyond the copy list.
11. 16:9, exactly 5 seconds, one composition, at most one crisp cut.
12. Identity anchor: rough white torn-paper edges on every cutout; small paper shadow from upper-left light.

Copy list: state the exact on-screen strings, then "Exact strings; nothing else appears in frame."

Audio block A (native): "One English narrator, warm, clear, natural, brisk but unhurried, never an advertising shout. Speak the following line exactly once, word for word, beginning on the first frame: "[LINE]". No other dialogue. Light paper-slap and tape sound effects beneath the voice; no music."

Audio block B (wordless, Saskia layered in player): "No voice, no speech, no dialogue, no lyrics. Light paper-slap and tape sound effects only; no music."

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
