"use client";

function once<K extends keyof HTMLVideoElementEventMap>(
  video: HTMLVideoElement,
  event: K
): Promise<void> {
  return new Promise((resolve, reject) => {
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`video failed while waiting for "${event}"`));
    };
    const cleanup = () => {
      video.removeEventListener(event, onEvent);
      video.removeEventListener("error", onError);
    };
    video.addEventListener(event, onEvent, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

/**
 * Load a same-origin clip off-screen and grab its last frame at full
 * resolution: the next shot's image_url, and what keeps the film continuous.
 */
export async function lastFrameOf(videoUrl: string): Promise<string> {
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.src = videoUrl;
  try {
    await once(video, "loadedmetadata");
    video.currentTime = Math.max(0, video.duration - 0.05);
    await once(video, "seeked");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d canvas unavailable");
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.92);
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}
