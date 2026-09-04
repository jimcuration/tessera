"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Screen } from "@/components/screen";
import { SPINE_QUESTIONS } from "@/lib/curation";
import { Session, type SessionState } from "@/lib/programme";
import { GROUND_HEX } from "@/lib/prompt";
import type { ReadyClip, Stream, StreamState } from "@/lib/stream";

/**
 * The Tessera player: the screen, the ask line with the square cursor, and
 * the suggestions with the up-next countdown beneath it. Nothing else.
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

interface Picture {
  clip: ReadyClip;
  sessionId: string;
}

export function Player() {
  const [session, setSession] = useState<Session | null>(null);
  const sessionState = useSessionState(session);
  const stream = session?.stream ?? null;
  const streamState = useStreamState(stream);

  const [picture, setPicture] = useState<Picture | null>(null);
  const [typed, setTyped] = useState("");
  const [muted, setMuted] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

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

  // The cursor is the status indicator: it blinks while listening and
  // blinks in the next beat's ground colour while rendering.
  const renderingShot = streamState?.rendering ? stream?.renderingShot() ?? null : null;
  const cursorColor = renderingShot ? GROUND_HEX[renderingShot.beat.ground] : "#F7F7F7";

  const next = phase === "playing" || phase === "buffering" ? stream?.peekNext() ?? null : null;
  const voice = sessionState?.switches?.voice ?? "native";

  const statusLine = (() => {
    if (!sessionState) return null;
    if (sessionState.status === "none") return "no captured answer for that yet";
    if (sessionState.status === "error") return sessionState.error?.toLowerCase() ?? "something went wrong";
    return null;
  })();

  return (
    <main className="tessera">
      <Screen
        picture={picture?.clip ?? null}
        next={next}
        muted={muted}
        volume={voice === "saskia" ? 0.5 : 1}
        onEnded={onEnded}
        onNeedsTap={onNeedsTap}
        onStarted={onStarted}
      />

      <div className="ask" onClick={focusInput}>
        <span className="typed">{typed}</span>
        <span
          className={`cursor${renderingShot ? " rendering" : " listening"}`}
          style={{ color: cursorColor }}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          className="ghost"
          type="text"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={onKeyDown}
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
            <span className="sq" aria-hidden="true" />
            <span className="q">{question}</span>
            {i === 0 && countdown !== null && !typed.trim() && (
              <span className="upnext">· up next in {countdown}s</span>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
