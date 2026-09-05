/**
 * WP5.1: rule 6 ("no recognisable people") enforced in code, after every
 * clip renders and before it reaches the playback queue (lib/stream.ts).
 *
 * The WP5 finding (briefs/WP5-report.md §5) was two "hole-punched tags"
 * beats rendering recognisable faces on the tags themselves. Calibrating
 * this gate against those exact clips (briefs/WP5.1-handoff.md) turned up
 * two things a naive single-pass detector misses:
 *
 *   - the faces are tilted at extreme, non-upright angles (a paper tag
 *     pinned at a rakish angle), which OpenCV's FaceDetectorYN (trained on
 *     mostly-upright photos) does not see in a single upright pass at all —
 *     a full rotation sweep is required;
 *   - once the sweep is sensitive enough to catch that tilted face, it also
 *     produces occasional single-angle spurious "faces" on plain paper
 *     texture (a coin, a hand) — sometimes at a HIGHER raw score than the
 *     genuine face. A single global score threshold cannot separate them.
 *
 * What does separate them, measured against the two known face-producing
 * beats plus all six spine beats: the genuine face is corroborated by
 * multiple nearby rotations (5-7 of 8 angles agree); every spurious
 * detection found in calibration agreed at only 2-3 of 8. MIN_ANGLES_AGREEING
 * sits at 4 — a one-notch margin above the worst false positive measured,
 * not a wide one. See the handoff before trusting this on new content.
 */

import { createRequire } from "node:module";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ffmpeg } from "../scripts/ffmpeg.mjs";

const require = createRequire(import.meta.url);

/** Canonical 45-degree rotation sweep. */
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;
/** A rotation "agrees" once its best detection score clears this floor. */
const PER_ANGLE_FLOOR = 0.2;
/** Calibrated in briefs/WP5.1-handoff.md: true positives measured at 4-7/8; the two false positives found measured at 2-3/8. */
const MIN_ANGLES_AGREEING = 4;
/** Brief: sample at 0.5s, 2.5s, 4.5s of the 5s clip. */
const SAMPLE_SECONDS = [0.5, 2.5, 4.5] as const;

const MODEL_PATH = path.join(process.cwd(), "models", "face_detection_yunet_2023mar.onnx");
const VIRTUAL_MODEL_NAME = "face_detection_yunet_2023mar.onnx";

export interface FaceGateFrameAttempt {
  frameSec: number;
  agreeingAngles: number;
  bestScore: number;
}

export interface FaceGateResult {
  detected: boolean;
  attempts: FaceGateFrameAttempt[];
  latencyMs: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cv: any = null;
let modelLoaded = false;

async function getCv() {
  if (!cv) cv = await require("@techstark/opencv-js");
  if (!modelLoaded) {
    const bytes = new Uint8Array(readFileSync(MODEL_PATH));
    cv.FS_createDataFile("/", VIRTUAL_MODEL_NAME, bytes, true, false, false);
    modelLoaded = true;
  }
  return cv;
}

/**
 * Sample three frames from a downloaded clip and run the rotation-swept
 * local face detector on each, stopping early the moment a frame is
 * confirmed. No external API: model + inference are both local (CLAUDE.md
 * rule 6's "no external API" instruction from the brief).
 */
export async function checkClipForFaces(videoPath: string): Promise<FaceGateResult> {
  const started = Date.now();
  const cvInstance = await getCv();
  const sharp = require("sharp");
  const work = path.join(tmpdir(), `facegate-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(work, { recursive: true });
  const attempts: FaceGateFrameAttempt[] = [];
  try {
    frames: for (const frameSec of SAMPLE_SECONDS) {
      const png = path.join(work, `${frameSec}.png`);
      ffmpeg(["-i", videoPath, "-ss", String(frameSec), "-frames:v", "1", png]);
      let agreeingAngles = 0;
      let bestScore = 0;
      for (const angle of ANGLES) {
        const { data, info } = await sharp(png)
          .rotate(angle, { background: "black" })
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const mat = cvInstance.matFromArray(info.height, info.width, cvInstance.CV_8UC3, data);
        const detector = new cvInstance.FaceDetectorYN(
          VIRTUAL_MODEL_NAME,
          "",
          new cvInstance.Size(info.width, info.height),
          0.15,
          0.3,
          5000
        );
        const faces = new cvInstance.Mat();
        detector.detect(mat, faces);
        let angleBest = 0;
        for (let i = 0; i < faces.rows; i++) angleBest = Math.max(angleBest, faces.data32F[i * 15 + 14]);
        if (angleBest >= PER_ANGLE_FLOOR) agreeingAngles += 1;
        bestScore = Math.max(bestScore, angleBest);
        mat.delete();
        faces.delete();
        detector.delete();
        if (agreeingAngles >= MIN_ANGLES_AGREEING) break; // confirmed; no need to test remaining angles
      }
      attempts.push({ frameSec, agreeingAngles, bestScore });
      if (agreeingAngles >= MIN_ANGLES_AGREEING) break frames; // confirmed; no need to test remaining frames
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  const detected = attempts.some((a) => a.agreeingAngles >= MIN_ANGLES_AGREEING);
  return { detected, attempts, latencyMs: Date.now() - started };
}

/**
 * Download a fal clip to a temp file and gate-check it, then clean up.
 * Shared by app/api/face-gate/route.ts (the browser player's path, via HTTP)
 * and scripts/render.mts (the headless CLI render path, which imports this
 * directly — no dev server round trip needed since it already runs in Node).
 */
export async function checkRemoteClipForFaces(rawUrl: string): Promise<FaceGateResult> {
  const dir = path.join(tmpdir(), `facegate-dl-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "clip.mp4");
  try {
    const upstream = await fetch(rawUrl, { cache: "no-store" });
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    writeFileSync(file, new Uint8Array(await upstream.arrayBuffer()));
    return await checkClipForFaces(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
