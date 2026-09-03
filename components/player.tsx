"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { loadManifest, type Title } from "@/lib/catalog";
import { Stream, type StreamState } from "@/lib/stream";

/**
 * The theater. Two stacked <video> elements: the one on screen, and the
 * next clip preloading silently behind it, so the swap at clip end is a
 * hard cut with no gap. The stream keeps the queue fed.
 */
export function Player({ title }: { title: Title }) {
  const [stream, setStream] = useState<Stream | null>(null);

  useEffect(() => {
    let live: Stream | null = null;
    let cancelled = false;
    void loadManifest().then((manifest) => {
      if (cancelled) return;
      live = new Stream(title, manifest?.titles[title.id] ?? null);
      setStream(live);
      live.start();
    });
    return () => {
      cancelled = true;
      live?.stop();
    };
  }, [title]);

  if (!stream) return <div className="theater" />;
  return <Theater stream={stream} />;
}

/** A clip that lands this early into a replay swaps in at once. */
const EARLY_SWAP_SECONDS = 1.5;
/** Hold the last frame this long waiting for the next shot before replaying. */
const HOLD_MAX_MS = 4000;

function Theater({ stream }: { stream: Stream }) {
  const state = useSyncExternalStore(stream.subscribe, stream.getSnapshot, stream.getSnapshot);
  const next = stream.peekNext();
  const [muted, setMuted] = useState(false);
  /** The browser refused unmuted autoplay; we fell back to muted playback. */
  const [needsTap, setNeedsTap] = useState(false);
  const [progress, setProgress] = useState(0);
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Controls fade after a few seconds without mouse movement.
  const wake = useCallback(() => {
    setIdle(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), 3200);
  }, []);
  useEffect(() => {
    wake();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [wake]);

  const current = state.current;

  // Start each clip explicitly. If the browser blocks autoplay with sound
  // (a direct load of /watch with no prior click), fall back to muted
  // playback and show a "tap for sound" pill instead of a frozen frame.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !current) return;
    let cancelled = false;
    const attempt = video.play();
    if (!attempt) return;
    attempt.catch(() => {
      if (cancelled) return;
      video.muted = true;
      setMuted(true);
      setNeedsTap(true);
      video.play().catch(() => {
        /* nothing left to try; the user can press the pill */
      });
    });
    return () => {
      cancelled = true;
    };
  }, [current]);

  // While holding on a last frame, or in the first moment of a replay, a
  // clip that becomes ready cuts in at once. Later in a replay we wait for
  // its end so the cut stays clean.
  useEffect(() => {
    if (state.phase !== "buffering" || !next) return;
    const video = videoRef.current;
    if (!video) return;
    if (video.ended || video.currentTime < EARLY_SWAP_SECONDS) {
      clearHold();
      stream.advance();
    }
  }, [state.phase, next, stream]);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  useEffect(() => clearHold, []);

  const onEnded = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    if (stream.advance()) return;
    // Nothing rendered yet. Hold the last frame: the next shot chains from
    // this exact image, so a short hold reads as a beat and the cut is
    // seamless. If the wait runs long, replay the clip instead of freezing.
    const video = event.currentTarget;
    clearHold();
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      if (stream.getSnapshot().phase !== "buffering") return;
      video.currentTime = 0;
      void video.play().catch(() => {});
    }, HOLD_MAX_MS);
  };
  const onTime = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    if (video.duration > 0) setProgress(video.currentTime / video.duration);
  };

  const toggleSound = () => {
    const video = videoRef.current;
    const nextMuted = !muted;
    setMuted(nextMuted);
    setNeedsTap(false);
    if (video) {
      video.muted = nextMuted;
      if (video.paused) void video.play().catch(() => {});
    }
  };

  const badge = useMemo(() => renderBadge(state), [state]);
  const waiting = state.phase === "buffering" || state.phase === "starting";

  return (
    <div className={`theater${idle ? " idle" : ""}`} onMouseMove={wake} onClick={wake}>
      {current && (
        <video
          key={current.index}
          ref={videoRef}
          className="reel"
          src={current.videoUrl}
          autoPlay
          muted={muted}
          playsInline
          onEnded={onEnded}
          onTimeUpdate={onTime}
        />
      )}
      {next && (
        <video
          key={`pre-${next.index}`}
          className="reel preload"
          src={next.videoUrl}
          preload="auto"
          muted
          playsInline
        />
      )}

      {waiting && (
        <div className={`buffering${current ? " quiet" : ""}`}>
          <div className="ring" />
          <span>{waitingLabel(state)}</span>
        </div>
      )}

      {state.phase === "error" && (
        <div className="buffering">
          <span>{state.error ?? "The stream failed."}</span>
        </div>
      )}

      {needsTap && (
        <button type="button" className="tap-sound" onClick={toggleSound}>
          Tap for sound
        </button>
      )}

      <div className="chrome top">
        <Link href="/" className="back" aria-label="Back to browse">
          <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
            <path
              d="M15 5l-7 7 7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <div className="now">
          <span className="now-title">{state.title.title}</span>
          {state.episodeTitle !== state.title.title && (
            <span className="now-episode">{state.episodeTitle}</span>
          )}
        </div>
        <div className="render-badge" title="Every shot is generated as you watch">
          <span className="live-dot" aria-hidden="true" />
          {badge}
        </div>
      </div>

      {current?.caption && (
        <div className="caption" key={`cap-${current.index}`}>
          {current.caption}
        </div>
      )}

      <div className="chrome bottom">
        <div className="progress">
          <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="bottom-row">
          <div className="shots">
            <span className="shot-num">Shot {current ? current.index + 1 : 0}</span>
            <span className="buffer-dots" aria-label={`${state.buffered} shots ready`}>
              {Array.from({ length: 3 }, (_, i) => (
                <span key={i} className={`dot${i < state.buffered ? " on" : ""}`} />
              ))}
            </span>
            <span className="buffer-label">{bufferLabel(state)}</span>
          </div>
          <div className="controls">
            <button
              type="button"
              className="ctl"
              onClick={toggleSound}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? "Unmute" : "Mute"}
            </button>
            <span className="credit">MiniMax H3 Max Turbo · fal</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderBadge(state: StreamState): string {
  const current = state.current;
  if (current?.renderMs) {
    const res = current.resolution ? ` · ${current.resolution}` : "";
    return `LIVE${res} · rendered in ${(current.renderMs / 1000).toFixed(1)}s`;
  }
  if (state.avgRenderMs) {
    return `LIVE · rendering ~${(state.avgRenderMs / 1000).toFixed(1)}s per shot`;
  }
  return "LIVE · generating";
}

function waitingLabel(state: StreamState): string {
  if (state.phase === "starting") return "Rolling the cold open";
  if (state.rendering) return "Rendering the next shot";
  if (state.writing) return "The showrunner is writing";
  return "Rendering the next shot";
}

function bufferLabel(state: StreamState): string {
  if (state.rendering) return "rendering…";
  if (state.writing && state.pending === 0) return "writing…";
  return `${state.buffered} in the can`;
}
