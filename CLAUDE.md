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
- **Builder** — you, if your brief is in `briefs/WPn.md`. Build exactly that scope. Commit all your work on your branch before writing the handoff — a handoff describing uncommitted work is incomplete. Write `briefs/WPn-handoff.md` when done: what you built, how to run it, what is untested.
- **Reviewer** — you, if you were told to review. Read only the acceptance criteria. Test each. Write `briefs/WPn-review.md` with pass/fail per criterion. Do not read the handoff first.

## Hard rules

1. **Translator rule.** The translator may compress, reorder and stage a CurationAI answer. It may not add facts, numbers, claims or characterisations that are not in the answer. Every beat carries a pointer to its source sentence(s). If a beat has no source, it does not render.
2. **Secrets.** `FAL_KEY`, `ELEVENLABS_API_KEY` and `ANTHROPIC_API_KEY` live in `.env.local` only. Never print them, log them, commit them, or ask for them. If they are missing, tell Robin and stop.
3. **Do not touch** `lib/stream.ts` buffer logic, the media proxy, or the fal server proxy unless a brief explicitly says so.
4. **Model.** `minimax/h3-max-turbo/text-to-video` and `minimax/h3-max-turbo/image-to-video`, 480p, 16:9, 5-second clips.
5. **No client branding.** Tessera is always Curation style. No client logos, colours or bespoke looks.
6. **No recognisable people** in generated imagery. Objects, machines, buildings, maps, coins, screens, vehicles, anonymous paper hands.
7. **Save everything.** Every clip, prompt and `expanded_prompt` goes to `RECORDINGS_DIR` with the beat that produced it.
8. **One session per checkout.** Parallel work packages use separate git worktrees on their own branches; never run `npm run build` in a checkout where a dev server is running. `RECORDINGS_DIR` (`lib/config.ts`, default `../tessera-recordings`) is one folder shared by the main checkout and every worktree, so parallel work packages' recordings land in one place instead of scattering across disconnected `recordings/` folders. Set it in each checkout's own `.env.local` only if you deliberately want that checkout's recordings kept apart.

## The beat

The translator turns one CurationAI answer into a sequence of beats. One beat = one 5s clip.

```json
{
  "scene": "1-based; beats sharing a scene share ground and a persistent primary subject, in runs of 2-3",
  "line": "spoken sentence, 12 words or fewer",
  "headline": "on-screen words, 4 or fewer, or null",
  "ground": "lime | cyan | violet | magenta, held for the whole scene",
  "subjects": ["halftone cutout objects, 1–3"],
  "action": "one clear cause-and-effect movement",
  "hand": "true when a paper hand is among this beat's subjects and acts in the action",
  "handoff": "the named shape this beat ends on, which the next beat transforms",
  "hero": "true on at most one beat per programme: the one carrying the answer's central figure",
  "scale": "oversized | small | diagram — varies beat to beat, never three-in-a-row the same",
  "delivery": "line, with at most one ElevenLabs expression tag in square brackets, for Saskia",
  "source": [0, 1]
}
```

`source` indexes sentences in the CurationAI answer. The final beat is the bookend: its `ground` matches scene 1's, and its `handoff` is the exact string scene 1's first beat used. The translator prompt lives in `lib/translator.ts` and is versioned alongside the style sheet.

WP5 also built `events` (three timed clauses, replacing `action`) and `labels` (data chips verbatim from the cited sentence) alongside a v0.4 style sheet, and measured all of it (`briefs/WP5-report.md`, `briefs/WP5-handoff.md`). Merging that work to main, Robin kept `scene`, `hand` and the bookend rule but asked to restore the v0.3 style sheet below and drop `labels` entirely — so `events`/`labels` are not in this codebase; read the WP5 docs as a record of what was built and measured, not as a description of what shipped.

WP7 (`briefs/WP7.md`, Robin: "completely replicate that reference style, retain the transitions, pull the colours into a more modern palette") replaced v0.3 with the style sheet below, v0.6, and restored WP0's chained-transition behaviour that v0.3's layout law had been fighting. The `Beat` schema itself (`scene`, `hand`, bookend, `hero`, `scale`, `delivery`, `source`) is unchanged — only `lib/prompt.ts` (the sheet) and `lib/translator.ts`'s rule 9 moved. See `briefs/WP7-report.md` for what was measured.

## Tessera Style Sheet v0.6

Every clip prompt = STYLE SHEET + BEAT + COPY LIST + AUDIO BLOCK. The style sheet is a numbered list because fal's prompt rewriter copies numbered lists and paraphrases prose. Keep it numbered. WP0 found fal's rewriter drops any line phrased as a prohibition (0/18 survival on "no brands" and "numbers never count up") while descriptive lines survive; v0.2 states everything as a description of the world, with a prohibition appended only where a description alone would not do — v0.2's line 6 ("no glow, neon, bloom") kept a literal prohibition tail and survived *worse* than v0.1 (7/18 vs 11/18, WP2 report §6); v0.3 folded it into a description instead.

v0.6 replaces the surface and motion lines with `briefs/reference/reference-prompt.md`'s own VISUAL SYSTEM and MOTION PRINCIPLES paragraphs (the prompt behind `halftone-science-short.mp4`), each kept as one numbered line, adapted three ways: the reference's one named human character is removed — subjects are objects, machines, buildings, maps, coins, screens and vehicles that carry no lettering, numerals, symbols or liveries (folding in WP6.1's finding that the video model invents an airline livery on an unbranded aircraft cutout unless told outright it carries none, `briefs/WP6.1-report.md` §3), with the anonymous paper hand as the one recurring actor; the reference's fixed colour names are replaced by whichever palette is selected (`lib/palette.ts`, `PALETTE=a|b|c`, below — unset by default); the reference's character-description sentences are replaced outright by this file's rule 6 wording (line 1, "never a person's face..."). Everything the brief marks out of scope is unchanged: materials (halftone, torn edges), the headline width cap and hero exception, 12-word lines, `scene`/`hand`/`delivery`/source pointers.

1. Palette-dependent VISUAL SYSTEM line: the palette's main colours (named, and hexed when a palette is set) plus black and the palette's light chip colour for typography; one dominant background colour per composition; subjects are halftone photographic cutouts with rough white torn-paper borders, consistent shot to shot — objects, machines, buildings, maps, coins, screens, vehicles carrying no lettering, numerals, symbols or liveries, and the recurring anonymous paper hand; every cutout's surface is plain and unmarked — never a person's face, portrait or headshot, printed or photographic, however small or partial, on any tag, card, document or photograph in the frame; bold magazine collage, refined 2D motion design, real paper texture, print dots, a little tape, small paper-layer shadows from consistent upper-left light; every surface flat matte printed paper — no glow, no neon, no bloom, no light halos, no luminous or backlit edges, nothing emits light; not glossy 3D animation or a live-action presenter.
2. One flat block-colour paper ground fills the frame: the beat's ground, resolved through the active palette — named with its hex when a palette is set, name only (no hex) at the unset default. The ground is a single unbroken colour.
3. Diagram elements are flat matte paper shapes and ribbons, tape, rubber stamps, string and pins, stencilled arrows, paper bar charts, stacked sheets, grid paper, torn strips, hole-punched tags, paper clips, in the palette's ribbon colours for this ground (below), with real paper texture and print dots.
4. Cuts are shape-match cuts: the closing shape of one composition becomes the opening shape of the next.
5. Headline typography: one extra-bold sans-serif, printed on the palette's chip material for this ground, one line, no wider than a third of the frame width, with safe margins, the chip sitting clear of the subjects. Letterforms are accurate, complete and stable from the frame they appear in; the chip is printed once and does not redraw. Chips carry lettering only — never an image, photograph, portrait or face. When the beat marks a hero number, that number alone may be printed larger, up to half the frame width.
6. Palette-independent MOTION PRINCIPLES line: high energy comes from major changes of scale, shape-matching and typographic composition, not incessant camera shake — some compositions oversized, some small-scale, some diagrams; each beat forms its composition rapidly, then holds a short clear reading window; objects enter with fast deceleration, slight overshoot and a stable landing; headlines retain clear letterforms after landing; cause and effect happen sequentially, one strongest visual focus at a time; the camera is locked; movement starts on the first frame, a small loop continues at the end; no empty waiting frames.
7. 16:9, exactly 5 seconds, one composition, at most one crisp cut.

> **What v0.6 deleted (WP7 item 1):** v0.3's line 6 — "the headline chip owns the upper third and stays uncovered; ... previous elements slide off or are covered in the first second" — is gone from both the sheet and `lib/translator.ts` rule 9, which used to require every beat to say how the previous headline chip leaves before the new one lands. Headline occlusion is accepted, not fought: WP0 found chaining inherits the previous composition, which is what makes the cut seamless and is also what covered a headline sometimes (`briefs/WP0-report.md` §7). Line 4 above is what replaces it — a positive statement of the shape-match cut, verbatim from the brief.

> **Note (WP5 merge, carried forward):** a WP5 live render put recognisable human faces on paper "tags" whose text description was fully rule-6-compliant (`briefs/WP5-report.md` §5) — a real CLAUDE.md rule 6 violation from the video model itself, not the translator. Line 1 above carries the face sentence forward for the same reason it did in v0.3: it stays until a proper code-side face gate lands, not because the sentence alone is considered sufficient. WP6.1 found the same failure mode on a different subject class (an unbranded aircraft cutout growing a fake airline livery, `briefs/WP6.1-report.md` §3) — line 1's "carry no lettering, numerals, symbols or liveries" clause is v0.6's attempt at the same kind of mitigation for vehicles; neither is verified against a live render yet.
>
> **Note (WP5.1, carried forward):** rule 6 is no longer a prompt rule alone. `app/api/face-gate/route.ts` samples three frames from every rendered clip and runs a local OpenCV Haar-cascade face detector before the clip reaches the playback queue; a detection discards the clip, logs frame/score to the recording, and re-renders once, and a second hit drops the beat rather than showing it. See `briefs/WP5.1-handoff.md` for what is verified and what is not. `lib/translator.ts` rule 8 still lists "hole-punched tags" as example subject vocabulary for the translator itself — untouched here, out of WP5.1's scope, and worth a future look since it is the vocabulary that produced the original finding.

## Palette system (`PALETTE=a|b|c`, `lib/palette.ts`, WP7)

Three named colour systems for the same sheet and the same beats, switched by environment variable, no code change — plus an unset default. The translator's `Ground` type stays the fixed four-value enum (`lime`/`cyan`/`violet`/`magenta` — `scene`/bookend logic depends on it); a palette maps that fixed set onto its own ordered swatch list by position, modulo the list's length, so a 3- or 2-swatch palette repeats early entries onto later `Ground` keys.

- **Unset (default):** `PALETTE` absent, or any value other than `a`/`b`/`c` — the original four named grounds, lime green, pale cyan, soft violet, deep magenta, no hex. Merging WP7, Robin asked for this as the default: leave production unbranded unless a palette is asked for explicitly.
- **A — Electric Curation:** lime green `#C8F135`, electric cyan `#2BD9F0`, electric violet `#8A5CF6`, hot magenta `#E8338C` — a 1:1 refinement of the four named grounds above. Chips black or warm white `#FFF8E7`; ribbons in black, warm white, or the ground's contrasting colour from the palette.
- **B — Reference**: the reference prompt's own three colours — saturated cobalt blue `#2252FF`, vivid orange `#FF6728`, bright yellow `#FFE14A`. Chips black or cream; ribbons in the palette's other two colours for the current ground.
- **C — Mono-plus-one**: grounds alternate deep near-black `#0E0E0F` and warm white `#FFF8E7`; one hot accent orange `#FF6728` for ribbons and chips; headline type prints cream on the near-black ground, black on the warm-white ground.

Palette hex values are approximate until Jim confirms. Do not invent new colours.

Copy list block (this block survived every render; the number rule and the text rule now live here): "On-screen text: [exact strings]. These strings are printed complete and correct from their first visible frame and never change. They are the only lettering in the frame."

Audio block (default, wordless): "No voice, no speech, no dialogue, no lyrics. Light paper-slap and tape sound effects only; no music."

The native audio block (one narrator speaking the line, `VOICE=native`) stays in `lib/prompt.ts` for comparison but is no longer the default; Saskia (D20) is.

## Transitions

Seamlessness is the product. Every shot after the first renders image-to-video from the last frame of the previous shot. The player swaps video elements the instant one ends, holds the incoming clip's first frame until painted, and freezes on the last frame if the next clip is late. In collage the native transition is the shape-match cut (style sheet line 4): each beat ends on a named handoff shape and the next beat opens by transforming it — including over or through whatever headline is already on screen; occlusion is accepted, not designed against (WP7).

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

Builders test with `AUDIO=off` in `.env.local` (WP9, `lib/config.ts`; default on) — it mutes narration and the music bed in the player only, so several worktrees' dev servers running at once don't all fight over the same speakers. It never changes what gets rendered or saved: every clip and narration track is still generated and written to `RECORDINGS_DIR` exactly as with `AUDIO=on` (rule 7).
