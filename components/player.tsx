"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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

function Theater({ stream }: { stream: Stream }) {
  const state = useSyncExternalStore(stream.subscribe, stream.getSnapshot, stream.getSnapshot);
  const next = stream.peekNext();
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const onEnded = () => stream.advance();
  const onTime = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    if (video.duration > 0) setProgress(video.currentTime / video.duration);
  };

  const current = state.current;
  const badge = useMemo(() => renderBadge(state), [state]);

  return (
    <div className={`theater${idle ? " idle" : ""}`} onMouseMove={wake} onClick={wake}>
      {current && (
        <video
          key={current.index}
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

      {(state.phase === "buffering" || state.phase === "starting") && (
        <div className="buffering">
          <div className="ring" />
          <span>
            {state.phase === "starting" ? "Rolling the cold open" : "Rendering the next shot"}
          </span>
        </div>
      )}

      {state.phase === "error" && (
        <div className="buffering">
          <span>{state.error ?? "The stream failed."}</span>
        </div>
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
            <span className="buffer-label">
              {state.rendering ? "rendering…" : `${state.buffered} in the can`}
            </span>
          </div>
          <div className="controls">
            <button
              type="button"
              className="ctl"
              onClick={() => setMuted((m) => !m)}
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
    return `LIVE · shot rendered in ${(current.renderMs / 1000).toFixed(1)}s`;
  }
  if (state.avgRenderMs) {
    return `LIVE · rendering ~${(state.avgRenderMs / 1000).toFixed(1)}s per shot`;
  }
  return "LIVE · generating";
}
