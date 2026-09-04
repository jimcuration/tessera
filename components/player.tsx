"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Console, type KeyState, type SeamState } from "@/components/console";
import { Screen } from "@/components/screen";
import { SPINE_QUESTIONS } from "@/lib/curation";
import { Session, type SessionState } from "@/lib/programme";
import { GROUND_HEX } from "@/lib/prompt";
import type { ReadyClip, Stream, StreamState } from "@/lib/stream";
import { GROUNDS } from "@/lib/translator";

/**
 * The Tessera player: the console (theatre mode) or a plain 16:9 screen
 * (plain mode), the ask line with the square cursor, the suggestions with
 * the up-next countdown, and the strip. Nothing else.
 *
 * A programme is a Session (lib/programme.ts). Asking a question while one
 * runs interrupts it: the picture stays up until the new programme's first
 * clip exists, then cuts. Once a programme ends, the top suggestion counts
 * down from ten seconds and continues on its own.
 */

/** Auto-continue into the top suggestion after this long idle. */
const AUTO_CONTINUE_SECONDS = 10;
/** How many suggestions sit under the screen. */
const SUGGESTION_LINES = 3;
/** Theatre mode never renders below this viewport width (CLAUDE.md → WP4). */
const THEATRE_MIN_WIDTH = 900;
/** The ask-line cursor when nothing is typed and no question is pending. */
const IDLE_CURSOR = "#FFEE8C";
/** The ask-line cursor (theatre) / cursor and key (plain, listening) while a question is pending. */
const LISTENING_CURSOR = "#F7F7F7";

const noopSubscribe = () => () => {};
const nullSnapshot = () => null;

function useSessionState(session: Session | null): SessionState | null {
  return useSyncExternalStore(
    session ? session.subscribe : noopSubscribe,
    session ? session.getSnapshot : nullSnapshot,
    session ? session.getSnapshot : nullSnapshot
  );
}

function useStreamState(stream: Stream | null): StreamState | null {
  return useSyncExternalStore(
    stream ? stream.subscribe : noopSubscribe,
    stream ? stream.getSnapshot : nullSnapshot,
    stream ? stream.getSnapshot : nullSnapshot
  );
}

/** THEATRE=on|off from the server, and the live viewport width. */
function useTheatre(): boolean {
  const [envOn, setEnvOn] = useState(true);
  // Deterministic on the first render (server and client agree, avoiding a
  // hydration mismatch); the effect below corrects it to the real viewport
  // width immediately after mount.
  const [wide, setWide] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/config", { cache: "no-store" })
      .then((res) => res.json())
      .then((config: { theatre?: string }) => {
        if (alive) setEnvOn(config.theatre !== "off");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const update = () => setWide(window.innerWidth >= THEATRE_MIN_WIDTH);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return envOn && wide;
}

interface Picture {
  clip: ReadyClip;
  sessionId: string;
}

/** `record.card` values, joined for the strip. Shape is not yet fixed by the platform (WP0: always null); read defensively. */
function formatCard(card: Record<string, unknown> | null): string | null {
  if (!card) return null;
  const parts: string[] = [];
  const ticker = card.ticker ?? card.symbol;
  if (typeof ticker === "string") parts.push(ticker.toLowerCase());
  const price = card.price ?? card.last;
  if (typeof price === "number") parts.push(`$${price.toFixed(2)}`);
  const change = card.changePercent ?? card.change;
  if (typeof change === "number") parts.push(`${change > 0 ? "+" : ""}${change.toFixed(2)}%`);
  const mcap = card.marketCap ?? card.mcap;
  if (typeof mcap === "number") parts.push(`$${mcap.toFixed(2)}m`);
  return parts.length ? parts.join(" · ") : null;
}

export function Player() {
  const theatre = useTheatre();

  const [session, setSession] = useState<Session | null>(null);
  const sessionState = useSessionState(session);
  const stream = session?.stream ?? null;
  const streamState = useStreamState(stream);

  const [picture, setPicture] = useState<Picture | null>(null);
  const [typed, setTyped] = useState("");
  const [muted, setMuted] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [inputFocused, setInputFocused] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  /** The live session, outside React state so an ask never runs twice. */
  const sessionRef = useRef<Session | null>(null);
  const pictureRef = useRef<Picture | null>(null);
  /** Whether the clip on screen has played to its end (holding its last frame). */
  const endedRef = useRef(false);

  const focusInput = useCallback(() => inputRef.current?.focus(), []);
  useEffect(() => {
    focusInput();
  }, [focusInput]);

  // Ask: interrupt whatever is running and start the new programme. The
  // picture stays until the new programme's first clip exists.
  const ask = useCallback(
    (question: string) => {
      const q = question.trim();
      if (!q) return;
      sessionRef.current?.cancel();
      const next = new Session(q);
      sessionRef.current = next;
      next.start();
      setSession(next);
      setTyped("");
      setCountdown(null);
      focusInput();
    },
    [focusInput]
  );

  // Leaving the page stops the programme.
  useEffect(() => () => sessionRef.current?.cancel(), []);

  // The stream's clip on screen becomes the picture.
  const current = streamState?.current ?? null;
  useEffect(() => {
    if (!current || !session) return;
    const next = { clip: current, sessionId: session.id };
    pictureRef.current = next;
    setPicture(next);
  }, [current, session]);

  // A clip that lands while we hold (nothing on screen, an older
  // programme's picture, or the last frame of the previous clip) cuts in at
  // once. Mid-clip we wait for the end so the cut stays clean.
  const buffered = streamState?.buffered ?? 0;
  const phase = streamState?.phase ?? null;
  useEffect(() => {
    if (!stream || !session || buffered === 0) return;
    if (phase !== "starting" && phase !== "buffering") return;
    const stale = !picture || picture.sessionId !== session.id;
    if (stale || endedRef.current) stream.advance();
  }, [stream, session, buffered, phase, picture]);

  const onStarted = useCallback((clip: ReadyClip) => {
    endedRef.current = false;
    const live = sessionRef.current;
    const shown = pictureRef.current;
    // Saskia: the narration for this beat starts with its clip.
    if (live && shown && shown.sessionId === live.id && shown.clip.videoUrl === clip.videoUrl) {
      live.narrator?.play(clip.shot.n);
    }
  }, []);

  const onEnded = useCallback(() => {
    endedRef.current = true;
    // Hold the last frame if nothing is ready: the next shot chains from
    // this exact image, so the hold reads as a beat and the cut is seamless.
    sessionRef.current?.stream?.advance();
  }, []);

  const onNeedsTap = useCallback(() => {
    setMuted(true);
    setNeedsTap(true);
  }, []);

  const toggleSound = () => {
    setMuted((m) => !m);
    setNeedsTap(false);
  };

  // Suggestions: the answer's follow-ups (already spine-backed), or the
  // spine before anything has been asked.
  const suggestions = (sessionState?.answer?.followups?.length
    ? sessionState.answer.followups
    : SPINE_QUESTIONS
  ).slice(0, SUGGESTION_LINES);

  // Auto-continue: once the programme has ended (or could not start), count
  // down from 10 and continue into the top suggestion. Typing pauses it.
  const status = sessionState?.status ?? null;
  const idle =
    session !== null &&
    (phase === "ended" || status === "none" || status === "error");
  useEffect(() => {
    if (!idle || suggestions.length === 0) {
      setCountdown(null);
      return;
    }
    setCountdown(AUTO_CONTINUE_SECONDS);
    const timer = setInterval(() => {
      setCountdown((value) => (value === null ? null : Math.max(0, value - 1)));
    }, 1000);
    return () => clearInterval(timer);
  }, [idle, suggestions.length, session]);
  useEffect(() => {
    if (countdown !== 0 || typed.trim()) return;
    if (suggestions[0]) ask(suggestions[0]);
  }, [countdown, typed, suggestions, ask]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      ask(typed);
    } else if (event.key === "Escape") {
      setTyped("");
    }
  };

  // A question is pending from Enter until its first clip is on screen.
  const renderingShot = streamState?.rendering ? stream?.renderingShot() ?? null : null;
  const groundColor = renderingShot ? GROUND_HEX[renderingShot.beat.ground] : LISTENING_CURSOR;
  const pending = session !== null && !picture && !idle;
  const listening = inputFocused || pending;

  // Theatre: the ask-line cursor only ever shows idle/pending — the square
  // key on the console carries the rendering state. Plain: the cursor
  // carries all three, per CLAUDE.md ("the square-key states move to the
  // cursor" in plain mode, WP4 §Plain mode).
  const keyState: KeyState = renderingShot ? "rendering" : listening ? "listening" : "off";
  const cursorRendering = !theatre && Boolean(renderingShot);
  const cursorColor = cursorRendering ? groundColor : listening ? LISTENING_CURSOR : IDLE_CURSOR;

  const seamState: SeamState = !stream ? "idle" : buffered >= 2 ? "steady" : "filling";

  const next = phase === "playing" || phase === "buffering" ? stream?.peekNext() ?? null : null;
  const voice = sessionState?.switches?.voice ?? "native";

  const statusLine = (() => {
    if (!sessionState) return null;
    if (sessionState.status === "none") return "no captured answer for that yet";
    if (sessionState.status === "error") return sessionState.error?.toLowerCase() ?? "something went wrong";
    return null;
  })();

  const strip = formatCard(sessionState?.answer?.card ?? null);

  const screen = (
    <Screen
      picture={picture?.clip ?? null}
      next={next}
      className={theatre ? "screen--theatre" : undefined}
      muted={muted}
      volume={voice === "saskia" ? 0.5 : 1}
      onEnded={onEnded}
      onNeedsTap={onNeedsTap}
      onStarted={onStarted}
    />
  );

  return (
    <main className={`tessera${theatre ? " theatre" : " plain"}`}>
      {theatre ? (
        <Console keyState={keyState} groundColor={groundColor} seamState={seamState}>
          {screen}
        </Console>
      ) : (
        <div className="screen-wrap">{screen}</div>
      )}

      <div className="stage">
        <div className="content">
          <div className="ask" onClick={focusInput}>
            <span className="label">curation</span>
            <span
              className={`cursor${cursorRendering ? "" : " blink"}`}
              style={{ color: cursorColor }}
              aria-hidden="true"
            />
            <span className="typed">{typed}</span>
            <input
              ref={inputRef}
              className="ghost"
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="ask curation"
            />
          </div>

          {statusLine && <div className="status">{statusLine}</div>}
          {needsTap && (
            <div className="status tap" onClick={toggleSound}>
              tap for sound
            </div>
          )}

          <ul className="suggestions">
            {suggestions.map((question, i) => (
              <li key={question} onClick={() => ask(question)}>
                <span
                  className="sq"
                  style={{ background: GROUND_HEX[GROUNDS[i % GROUNDS.length]] }}
                  aria-hidden="true"
                />
                <span className="q">{question}</span>
                {i === 0 && countdown !== null && !typed.trim() && (
                  <span className="upnext">· up next in {countdown}s</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="strip">
        {strip && <span>{strip} · </span>}
        information, not investment advice
      </div>
    </main>
  );
}
