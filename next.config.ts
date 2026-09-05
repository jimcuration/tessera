import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  images: { unoptimized: true },
  // app/api/voice/route.ts measures narration duration via scripts/ffmpeg.mjs,
  // which loads the ffmpeg-static binary by path; keep it out of the server bundle.
  serverExternalPackages: ["ffmpeg-static"],
};

export default nextConfig;
