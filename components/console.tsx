"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * The Curation console (theatre mode): public/console.png with the video
 * screen, the square key and the yellow seam positioned over it as
 * fractions of the image. Measured against the 5504×3072 render.
 */

interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Brief-specified screen bounds (verified against the render). */
const SCREEN_BOUNDS: Bounds = { left: 0.1317, right: 0.6294, top: 0.2155, bottom: 0.7415 };
/** The square key below the screen's bottom-right corner, measured directly off the render. */
const KEY_BOUNDS: Bounds = { left: 0.643, right: 0.673, top: 0.679, bottom: 0.732 };
/** The lit seam between the screen module and the knob module. */
const SEAM_BOUNDS: Bounds = { left: 0.688, right: 0.708, top: 0.14, bottom: 0.81 };

function boundsStyle(b: Bounds): CSSProperties {
  return {
    left: `${b.left * 100}%`,
    right: `${(1 - b.right) * 100}%`,
    top: `${b.top * 100}%`,
    bottom: `${(1 - b.bottom) * 100}%`,
  };
}

export type KeyState = "off" | "listening" | "rendering";
export type SeamState = "idle" | "steady" | "filling";

export interface ConsoleProps {
  children: ReactNode;
  keyState: KeyState;
  /** Ground colour for the key's "rendering" fill. */
  groundColor: string;
  seamState: SeamState;
}

export function Console({ children, keyState, groundColor, seamState }: ConsoleProps) {
  return (
    <div className="console">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="console-image" src="/console.png" alt="" draggable={false} />
      <div className="console-screen" style={boundsStyle(SCREEN_BOUNDS)}>
        {children}
      </div>
      <div
        className={`console-key ${keyState}`}
        style={{ ...boundsStyle(KEY_BOUNDS), ["--ground" as string]: groundColor }}
        aria-hidden="true"
      />
      <div className={`console-seam ${seamState}`} style={boundsStyle(SEAM_BOUNDS)} aria-hidden="true" />
    </div>
  );
}
