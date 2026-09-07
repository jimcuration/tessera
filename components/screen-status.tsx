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
 *   playing    — normal video; this component renders nothing. A late next
 *                clip freezes the picture on its last frame (screen.tsx)
 *                while the console seam carries the buffer state (WP9 §2
 *                left the corner hold-cursor here as a second, redundant
 *                signal — dropped so the seam is the one thing to read).
 *   end        — nothing left to auto-continue into: the dimming itself is
 *                applied to the <Screen> element by the caller (a CSS
 *                filter, not this overlay — see app/globals.css's
 *                .screen--dim, and CLAUDE.md's note that filter + a
 *                mix-blend-mode element don't composite in Chromium, which
 *                is why the dim is plain brightness() with no blend mode
 *                nearby); this renders only the end line + cursor, kept at
 *                full brightness so it stays readable over the dimmed
 *                picture.
 *   deflection — the typed question matched no captured record above
 *                lib/curation.ts's MATCH_THRESHOLD (never the nearest
 *                record below it — that stays a miss). Same dimmed
 *                treatment as end, fixed copy: "curationai hasn't answered
 *                that one yet". The suggestions below the screen are the
 *                spine in this state (components/player.tsx), so the
 *                viewer always has a captured question to fall into.
 */

export type ScreenState = "idle" | "assembling" | "playing" | "end" | "deflection";

export interface ScreenStatusProps {
  state: ScreenState;
  /** assembling only: "reading the answer" | "writing the programme" | "voicing scene 1" | "rendering scene 1". */
  stage?: string | null;
  /** end only. */
  endLine?: string;
}

const DEFLECTION_LINE = "curationai hasn't answered that one yet";

export function ScreenStatus({ state, stage, endLine }: ScreenStatusProps) {
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

  if (state === "deflection") {
    return (
      <div className="screen-status screen-status--end" aria-hidden="true">
        <div className="screen-status-line">
          <span>{DEFLECTION_LINE}</span>
          <span className="cursor blink" />
        </div>
      </div>
    );
  }

  // playing — the console seam is the buffer-state indicator.
  return null;
}
