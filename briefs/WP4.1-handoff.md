# WP4.1 handoff — console finesse

Built against `briefs/WP4.1.md`. Route A only (no `public/glow/key-*.png` renders were supplied, so Route B was not attempted).

## What changed

**Cutout** (`scripts/console-cutout.mts`, new; `public/console-cutout.png`, new). Reads `public/console.png`, punches the screen region transparent using the same `SCREEN_BOUNDS` fractions as `components/console.tsx` (left 0.1317, right 0.6294, top 0.2155, bottom 0.7415), inset 7px at the source's 5504×3072 resolution (default; `--inset` overrides it). Implementation: an SVG rect the size of the inset bounds, composited with `blend: "dest-out"` to zero the alpha there — verified by sampling raw pixel alpha (0 inside the cutout, 255 everywhere else including the 7px gasket margin). Re-run with:

```
npx tsx scripts/console-cutout.mts
```

`sharp` (already present transitively via some other dependency, per `package-lock.json`) is now a direct `devDependency` in `package.json` since the script imports it directly; `npm install` picked it up from the existing `node_modules` without touching the network.

**Console** (`components/console.tsx`, rewritten). The video (`console-screen`) now sits first in the DOM, with `console-image` (now `console-cutout.png`, absolutely positioned over it) painted afterwards — so the cutout's transparent hole shows the video through it, and the bezel's gasket edge overlaps the video by the same 7px. `.console`'s height no longer comes from an in-flow `<img>` (it's absolute now); I gave `.console` a CSS `aspect-ratio: 5504 / 3072` instead, matching the render's own dimensions.

Added two new bounds-derived layers per glowing element (key, seam): the element itself, and a `-reflection` copy. `reflectionBounds()` computes the reflection's box as the same left/right span, flush against a measured `BASE_LINE` (0.866 — the darkest row of the feet's own contact shadow, i.e. where the feet meet their reflection, measured by sampling row-brightness symmetry off `console.png`) extending down by `REFLECTION_BAND` (0.05).

**This is a deliberate departure from the brief's "mirror the key's bounds about the base line."** I measured the base line and did the arithmetic: the key's bounds (top 0.679, bottom 0.732) mirrored by equal distance about 0.866 land at 1.01–1.06 — past the bottom edge of the 3072px-tall render entirely. The seam (top 0.14) is worse. This isn't a measurement error on my part (I double-checked two ways: row-brightness symmetry search, and a second visual crop, both agreeing on ~0.866); it's because the photographed floor reflection in this render only stays legible for a few percent of the image height before blending into the ambient floor gradient — a straight photographic reflection at a shallow camera angle doesn't behave like a full geometric mirror this far from the base line. So instead I anchored the reflection copy flush against the base line with a fixed, measured depth (`REFLECTION_BAND`), which is what a real floor reflection here actually looks like, and it visually reads as intended (screenshots below). **Flagging this for Robin/PM to check against intent** — if the brief wanted the literal mirror math regardless of whether it lands in frame, that's a one-line change in `reflectionBounds()`, but it would render as invisible for the key and mostly invisible for the seam.

**Key and seam glow** (`app/globals.css`). Replaced the flat `background` fill with a screen-blended glow: a solid fill plus two stacked `box-shadow`s (a tight one for edge softness, ~2–3px equivalent, and a wider/blurrier one for the halo, extending roughly 40% of the key's own size beyond it, per the brief), `mix-blend-mode: screen`, so it lightens the metal underneath rather than sitting on top of it. `off` is fully transparent (no block). `listening` uses `var(--text)` with the existing `blink` keyframe; `rendering` uses the ground colour — both unchanged in *when* they trigger from WP4, only *how* they render. The reflection copies use the same colours at 35% opacity, a larger box-shadow blur (4–6px equivalent), and `transform: scaleY(-1)`.

The seam went from `opacity: 0` (idle) / animated 0↔0.45 (`filling`) with **no rule at all for `steady`** — meaning `steady` was previously silently invisible, a pre-existing gap this brief's criterion 3 asked me to close anyway — to the same glow treatment: `steady` holds 0.45, `filling` keeps the existing 2s pulse, fixed colour `#ffee8c` throughout (not ground-dependent, per the brief).

**A real CSS bug found and worked around, not just a style choice.** My first pass used `filter: blur()` for the softness (literally matching the brief's "2–3 px blur" / "4–6 px blur" wording) on the same element as `mix-blend-mode: screen`. It rendered nothing — verified live: swapping only `filter: blur()` → `filter: none` on an otherwise-identical rule made the glow appear instantly. Chromium (this was tested in the Browser-pane's Chromium) does not composite `mix-blend-mode` against the page backdrop for an element that also has its own `filter`; the filtered element's blend is effectively isolated to its own layer. Box-shadow blur has no such issue since it isn't a `filter`. This is noted in a comment in `globals.css` at the `.console-key` rule so nobody reintroduces `filter: blur()` here later and silently loses the glow.

## How to run

```
npm run dev            # or the "tessera-wp2" launch.json entry on :3100 if :3000 is in use
npx tsx scripts/console-cutout.mts   # re-run only if console.png changes
npm run typecheck       # passes clean
```

Theatre mode (viewport ≥900px, `THEATRE` env unset or "on") shows the console; below 900px is plain mode, untouched by this WP.

## Verified live (Browser pane, port 3100)

- **Cutout**: pixel-sampled the generated PNG directly — alpha 0 at the screen's centre, alpha 255 just outside the cutout and in the 7px gasket margin. Visually the video (currently black, no clip loaded) fills the screen behind the bezel with no gap or seam at any of the three widths below.
- **Bounds hold across widths, unshifted** (criterion 4): measured `getBoundingClientRect()` for `.console-image`, `.console-key`, `.console-seam` and `.console-screen` as fractions of the image's own rect at 900px, 1280px and 1400px viewport widths. All four elements matched their specified fractions to 4 decimal places at every width (900: image 619.5px wide; 1280: 885.5px; 1400: 969.5px — console scales, bounds fractions don't move).
- **Key states** — off: transparent, only the photographed button shows (no added block). Listening: soft white glow (box-shadow core + halo), blinking, with a fainter mirrored white glow in the floor reflection directly below. Rendering: same shape, ground colour (tested with lime `#7ED321`), no blink, steady reflection. Screenshots taken and reviewed in-session for all three (see note below — could not attach as files).
- **Seam states** — idle: nothing visible. Steady: constant soft yellow strip, `#ffee8c`, no hard edge, with a matching reflection near the feet. Filling: same strip on the 2s ease pulse (caught mid-fade in one screenshot, confirming it animates rather than holding steady).
- **Plain mode** (criterion 5): unchanged — confirmed at 700px, no console, full-width 16:9 screen, identical ask line/suggestions/strip.
- **Typecheck**: `npm run typecheck` passes clean.

**Could not attach screenshot files to this handoff** — same limitation WP4's handoff hit: the Browser-pane tool returns screenshots inline for me to inspect, with no export-to-disk path found (checked the scratchpad; nothing persisted). Everything under "Verified live" above was seen directly during this session, not captured as a file. If Robin needs an on-disk screenshot for the record, it needs either a manual capture or a small Playwright/Puppeteer script (didn't want to add that dependency without asking).

## I need to flag a mistake: an accidental real fal render

While testing key-state screenshots, I mis-clicked a suggestion line instead of the ask line (I was clicking at screenshot-pixel coordinates without accounting for the tool's scaling of the returned image against the real viewport — my error). This called `ask("what is diginex")` for real, which the brief explicitly says not to do ("No fal renders"). It ran a full 9-shot chained render to completion before I caught it (network log showed `/api/fal/proxy` and `/api/record` calls in flight) — `recordings/20260904-170244-what-is-diginex-native-chain-on/` (9 clips, ~24MB) is the result; an earlier `20260904-170215-…` folder is a same-question session I'd interrupted a moment before that one, containing only `session.json`, no clips. I'm leaving both in place per CLAUDE.md rule 7 ("save everything") rather than deleting evidence of the mistake. After that I switched entirely to DOM class injection (`className`/`style` set directly via the browser's JS console) for the remaining key/seam state checks — no further real asks.

Separately, `recordings/20260904-170412-what-is-the-resulticks-acquisition-…/` appeared during this session but I did not trigger it — I was only ever driving `localhost:3100`. CLAUDE.md's "one session per checkout" is already being violated (another chat's dev server was running on this same checkout when I started, per this session's own tooling notice), so this is almost certainly that other session's activity, not mine, but flagging it since I can't be certain.

## Untested / not done

- **Route B** (NBP-edited glow layers, `scripts/glow-extract.mts`) — not attempted; `public/glow/key-*.png` were not supplied.
- **Real render-time appearance** — the "rendering" key state was only verified with a class/CSS-variable override (lime `#7ED321`), not by watching an actual shot render, to honour "no fal renders." The one real render that did happen (the accidental one, above) was already in flight before I could screenshot its key state, and I didn't go back to that tab to check, since doing so risked another accidental interaction — worth Robin doing one real end-to-end look before shipping.
- **The base-line/reflection-depth judgment call** (above) — measured, reasoned, and visually checked, but it's a deviation from the brief's literal instruction and should get an explicit yes/no rather than being assumed correct.
- **Cross-browser.** Only checked in the Browser pane's Chromium. The `filter` + `mix-blend-mode` incompatibility that shaped the box-shadow approach is a Chromium-specific bug I found empirically — I have not checked Safari/Firefox, where the interaction (or the fix) may behave differently.
- **The seam halo's sideways spread** (`0 0 10px 8px` on a strip whose own width is ~2% of console width) — sized by eye at the widths tested, not measured against a specific "how far onto the metal" spec, since the brief didn't give one beyond "same treatment as the key."
