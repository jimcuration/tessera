import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  images: { unoptimized: true },
  // app/api/voice/route.ts measures narration duration via scripts/ffmpeg.mjs,
  // which loads the ffmpeg-static binary by path; keep it out of the server bundle.
  // app/api/face-gate/route.ts (WP5.1) uses sharp (native addon) and
  // @techstark/opencv-js (a large WASM bundle loaded by path) the same way.
  serverExternalPackages: ["ffmpeg-static", "sharp", "@techstark/opencv-js"],
};

export default nextConfig;
