"use client";

/**
 * WP9: the four screen states layered over components/screen.tsx's video
 * element, inside the same box (the plain 16:9 box, or the console's
 * cut-out screen bounds in theatre mode) — drawn in the Interface style
 * (CLAUDE.md → Interface): #F7F7F7 on #0E0E0F, lowercase (inherited from
 * .tessera's own text-transform), no spinners, no icons, no progress bars.
 *
 *   idle       — no programme yet: one blinking square cursor, low-left.
 *   assembling — a question is pending: "assembling" + cursor, and one
 *                small line beneath it for the current pipeline sub-stage
 *                (components/player.tsx derives which one).
 *   playing    — normal video; this component renders nothing UNLESS the
 *                clip on screen has held its last frame for more than 2s
 *                (showHoldCursor), in which case a lone cursor blinks in
 *                the same low-left corner until the next clip starts.
 *   end        — nothing left to auto-continue into: the dimming itself is
 *                applied to the <Screen> element by the caller (a CSS
 *                filter, not this overlay — see app/globals.css's
 *                .screen--dim, and CLAUDE.md's note that filter + a
 *                mix-blend-mode element don't composite in Chromium, which
 *                is why the dim is plain brightness() with no blend mode
 *                nearby); this renders only the end line + cursor, kept at
 *                full brightness so it stays readable over the dimmed
 *                picture.
 */

export type ScreenState = "idle" | "assembling" | "playing" | "end";

export interface ScreenStatusProps {
  state: ScreenState;
  /** assembling only: "reading the answer" | "writing the programme" | "voicing scene 1" | "rendering scene 1". */
  stage?: string | null;
  /** playing only: the clip has held its last frame past the 2s threshold. */
  showHoldCursor?: boolean;
  /** end only. */
  endLine?: string;
}

export function ScreenStatus({ state, stage, showHoldCursor, endLine }: ScreenStatusProps) {
  if (state === "idle") {
    return (
      <div className="screen-status" aria-hidden="true">
        <span className="cursor blink" />
      </div>
    );
  }

  if (state === "assembling") {
    return (
      <div className="screen-status" aria-hidden="true">
        <div className="screen-status-line">
          <span>assembling</span>
          <span className="cursor blink" />
        </div>
        {stage && <div className="screen-status-substage">{stage}</div>}
      </div>
    );
  }

  if (state === "end") {
    return (
      <div className="screen-status screen-status--end" aria-hidden="true">
        <div className="screen-status-line">
          <span>{endLine ?? "ask me anything"}</span>
          <span className="cursor blink" />
        </div>
      </div>
    );
  }

  // playing
  if (showHoldCursor) {
    return (
      <div className="screen-status" aria-hidden="true">
        <span className="cursor blink" />
      </div>
    );
  }
  return null;
}
