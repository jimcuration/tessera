// Build the catalog assets: one Nano Banana 2 key-art cover and one MiniMax
// H3 Max Turbo preview clip per title. Writes public/catalog/manifest.json
// and downloads covers into public/catalog/covers/.
//
//   node scripts/generate-catalog.mjs            all titles, skip ones done
//   node scripts/generate-catalog.mjs --force    regenerate everything
//   node scripts/generate-catalog.mjs --only meridian-drift,neon-vespers
//   node scripts/generate-catalog.mjs --covers   covers only
//   node scripts/generate-catalog.mjs --previews previews only

import { fal } from "@fal-ai/client";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TITLES } from "../catalog/titles.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "catalog");
const COVERS_DIR = path.join(OUT_DIR, "covers");
const MANIFEST = path.join(OUT_DIR, "manifest.json");

const PREVIEW_SECONDS = 6;
const PREVIEW_RESOLUTION = "768P";
const CONCURRENCY = 4;

// --- env ---------------------------------------------------------------
function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();
if (!process.env.FAL_KEY) {
  console.error("FAL_KEY missing: put it in .env.local");
  process.exit(1);
}
fal.config({ credentials: process.env.FAL_KEY });

// --- args --------------------------------------------------------------
const args = process.argv.slice(2);
const force = args.includes("--force");
const coversOnly = args.includes("--covers");
const previewsOnly = args.includes("--previews");
const onlyArg = args.find((arg) => arg.startsWith("--only"));
const only = onlyArg
  ? (onlyArg.includes("=") ? onlyArg.split("=")[1] : args[args.indexOf(onlyArg) + 1])
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

mkdirSync(COVERS_DIR, { recursive: true });
const manifest = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, "utf8"))
  : { generatedAt: "", titles: {} };

function save() {
  manifest.generatedAt = new Date().toISOString();
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
}

// --- generators --------------------------------------------------------
async function paintCover(title) {
  const result = await fal.subscribe("fal-ai/nano-banana-2", {
    input: {
      prompt: title.coverPrompt,
      aspect_ratio: "16:9",
      resolution: "1K",
      num_images: 1,
      output_format: "jpeg",
    },
  });
  const url = result.data?.images?.[0]?.url;
  if (!url) throw new Error("no image in response");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`cover download ${res.status}`);
  const file = path.join(COVERS_DIR, `${title.id}.jpg`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return `/catalog/covers/${title.id}.jpg`;
}

async function filmPreview(title) {
  const result = await fal.subscribe("minimax/h3-max-turbo/text-to-video", {
    input: {
      prompt: `${title.previewPrompt} Sound: ambient environmental audio and cinematic score only; any voices are wordless, with no spoken dialogue.`,
      duration: PREVIEW_SECONDS,
      resolution: PREVIEW_RESOLUTION,
      aspect_ratio: "16:9",
      prompt_expansion_mode: "balanced",
    },
  });
  const url = result.data?.video?.url;
  if (!url) throw new Error("no video in response");
  return url;
}

async function buildTitle(title) {
  const entry = manifest.titles[title.id] ?? {};
  const started = Date.now();
  const wantCover = !previewsOnly && (force || !entry.cover);
  const wantPreview = !coversOnly && (force || !entry.preview);
  if (!wantCover && !wantPreview) {
    console.log(`  = ${title.id}: up to date`);
    return;
  }
  const jobs = [];
  if (wantCover) {
    jobs.push(
      paintCover(title).then((cover) => {
        entry.cover = cover;
      })
    );
  }
  if (wantPreview) {
    jobs.push(
      filmPreview(title).then((preview) => {
        entry.preview = preview;
        entry.previewSeconds = PREVIEW_SECONDS;
      })
    );
  }
  const results = await Promise.allSettled(jobs);
  manifest.titles[title.id] = entry;
  save();
  const failed = results.filter((r) => r.status === "rejected");
  const secs = Math.round((Date.now() - started) / 1000);
  if (failed.length) {
    console.log(
      `  ! ${title.id}: ${failed.length} failed (${failed.map((f) => f.reason?.message).join("; ")})`
    );
  } else {
    console.log(`  + ${title.id}: done in ${secs}s`);
  }
}

// --- run ---------------------------------------------------------------
const targets = TITLES.filter((title) => !only || only.includes(title.id));
console.log(`Building ${targets.length} titles (${CONCURRENCY} at a time)…`);
let cursor = 0;
async function worker() {
  while (cursor < targets.length) {
    const title = targets[cursor++];
    try {
      await buildTitle(title);
    } catch (error) {
      console.log(`  ! ${title.id}: ${error?.message ?? error}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
save();
const done = Object.values(manifest.titles).filter((e) => e.cover && e.preview).length;
console.log(`Manifest: ${done}/${TITLES.length} titles complete -> ${path.relative(ROOT, MANIFEST)}`);
