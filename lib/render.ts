"use client";

/**
 * RENDER=queue|director. Queue is the unreel shot queue (lib/stream.ts),
 * built in WP0. Director is reserved for a later work package.
 */

import type { RenderSwitch } from "./config";
import { Stream } from "./stream";

export function createRenderer(mode: RenderSwitch, args: { chain: boolean; faceGate: boolean }): Stream {
  if (mode === "director") {
    throw new Error("not implemented in WP0");
  }
  return new Stream(args.chain, args.faceGate);
}
