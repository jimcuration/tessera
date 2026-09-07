"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * The Curation console (theatre mode): public/console-cutout.png (WP4.1 —
 * public/console.png with the screen cut out transparent, see
 * scripts/console-cutout.mts) over the video, with the square key and the
 * yellow seam as light on the metal rather than flat colour blocks, each
 * with a faint reflection below. Bounds measured against the 5504×3072
 * render.
 */

interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Brief-specified screen bounds (verified against the render; must match scripts/console-cutout.mts). */
const SCREEN_BOUNDS: Bounds = { left: 0.1317, right: 0.6294, top: 0.2155, bottom: 0.7415 };
/** The square key below the screen's bottom-right corner, measured directly off the render. */
const KEY_BOUNDS: Bounds = { left: 0.643, right: 0.673, top: 0.679, bottom: 0.732 };
/** The lit seam between the screen module and the knob module. */
const SEAM_BOUNDS: Bounds = { left: 0.688, right: 0.708, top: 0.14, bottom: 0.81 };
/**
 * WP4.2: the flat aluminium band between the screen's bottom edge (0.7415,
 * matches SCREEN_BOUNDS.bottom) and the console's lower chamfer — measured
 * off the render (public/console-cutout.png): the metal reads flat from
 * 0.7415 to ~0.81, then falls into the dark bevel shadow. Right edge stops
 * short of the square key (KEY_BOUNDS.left = 0.643).
 */
const READOUT_BOUNDS: Bounds = { left: 0.1317, right: 0.62, top: 0.748, bottom: 0.807 };

/**
 * Where the feet meet their reflection in the floor: the darkest row of the
 * feet's contact shadow, measured off public/console.png. The render's own
 * reflection stays legible for only a few percent of the image height past
 * that line before it blends into the floor's ambient gradient — well short
 * of a true equal-distance mirror for anything this high up the panel (the
 * key and seam would land at or past the bottom edge of the render). So the
 * glow reflections below are flush against this line and capped to
 * REFLECTION_BAND rather than mirrored the full source-to-baseline distance.
 */
const BASE_LINE = 0.866;
/** How deep the glow's reflection reads before it would just be floor (see BASE_LINE). */
const REFLECTION_BAND = 0.05;

function boundsStyle(b: Bounds): CSSProperties {
  return {
    left: `${b.left * 100}%`,
    right: `${(1 - b.right) * 100}%`,
    top: `${b.top * 100}%`,
    bottom: `${(1 - b.bottom) * 100}%`,
  };
}

/** The same horizontal span, flush under the base line (see BASE_LINE). */
function reflectionBounds(b: Bounds): Bounds {
  return { left: b.left, right: b.right, top: BASE_LINE, bottom: Math.min(BASE_LINE + REFLECTION_BAND, 0.999) };
}

export type KeyState = "off" | "listening" | "rendering";
export type SeamState = "idle" | "steady" | "filling";

export interface ConsoleProps {
  children: ReactNode;
  keyState: KeyState;
  /** Ground colour for the key's "rendering" fill. */
  groundColor: string;
  seamState: SeamState;
  /**
   * WP9: KEY_GLOW=on|off (lib/config.ts, default off). Off — the default —
   * renders the key exactly as it is in public/console-cutout.png: the glow
   * overlay divs below are not rendered at all, not just made transparent.
   * The seam stays as the buffer indicator either way.
   */
  keyGlow: boolean;
  /** WP4.2 §2: the ticker readout printed on the bezel below the screen. Renders nothing (not even the band) until a card has been seen this session. */
  readout?: ReactNode;
  /** WP4.2 §3: dims the seam light to 50% while the programme is paused. */
  paused: boolean;
}

export function Console({ children, keyState, groundColor, seamState, keyGlow, readout, paused }: ConsoleProps) {
  return (
    <div className="console">
      {/* the video sits beneath the console image; the image's screen
          region is cut transparent (scripts/console-cutout.mts) so it
          reads as recessed behind the bezel rather than pasted over it */}
      <div className="console-screen" style={boundsStyle(SCREEN_BOUNDS)}>
        {children}
        {/* WP4.2 §1: recessed-behind-the-gasket optics, over the video, clipped to the screen bounds by the parent's overflow:hidden */}
        <div className="console-screen-shadow" aria-hidden="true" />
        <div className="console-screen-glass" aria-hidden="true" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="console-image" src="/console-cutout.png" alt="" draggable={false} />
      {readout && (
        <div className="console-readout" style={boundsStyle(READOUT_BOUNDS)}>
          {readout}
        </div>
      )}
      {keyGlow && (
        <>
          <div
            className={`console-key ${keyState}`}
            style={{ ...boundsStyle(KEY_BOUNDS), ["--ground" as string]: groundColor }}
            aria-hidden="true"
          />
          <div
            className={`console-key-reflection ${keyState}`}
            style={{ ...boundsStyle(reflectionBounds(KEY_BOUNDS)), ["--ground" as string]: groundColor }}
            aria-hidden="true"
          />
        </>
      )}
      <div
        className={`console-seam ${seamState}${paused ? " paused" : ""}`}
        style={boundsStyle(SEAM_BOUNDS)}
        aria-hidden="true"
      />
      <div
        className={`console-seam-reflection ${seamState}${paused ? " paused" : ""}`}
        style={boundsStyle(reflectionBounds(SEAM_BOUNDS))}
        aria-hidden="true"
      />
    </div>
  );
}
