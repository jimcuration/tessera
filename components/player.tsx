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
import { ScreenStatus, type ScreenState } from "@/components/screen-status";
import { COMPANY, normalise, SPINE_QUESTIONS } from "@/lib/curation";
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
/** WP4.2 §4: shown after the cursor until focus, or until something is typed. */
const ASK_PLACEHOLDER = "ask about diginex";

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

/**
 * The WP5 music bed: how far under Saskia's voice it sits. Saskia's own
 * volume is 0.5 (below); roughly -12dB under that is ~0.5 * 0.25.
 */
const MUSIC_VOLUME = 0.13;

/** MUSIC=on|off from the server (lib/config.ts; default on). */
function useMusicOn(): boolean {
  const [on, setOn] = useState(true);
  useEffect(() => {
    let alive = true;
    fetch("/api/config", { cache: "no-store" })
      .then((res) => res.json())
      .then((config: { music?: string }) => {
        if (alive) setOn(config.music === "on");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return on;
}

/**
 * AUDIO=on|off from the server (lib/config.ts; default on — WP9). off mutes
 * narration and the music bed in the player; nothing about rendering or
 * saving a clip's own audio changes (CLAUDE.md rule 7).
 */
function useAudioOn(): boolean {
  const [on, setOn] = useState(true);
  useEffect(() => {
    let alive = true;
    fetch("/api/config", { cache: "no-store" })
      .then((res) => res.json())
      .then((config: { audio?: string }) => {
        if (alive) setOn(config.audio !== "off");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return on;
}

/** KEY_GLOW=on|off from the server (lib/config.ts; default off — WP9). */
function useKeyGlow(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/config", { cache: "no-store" })
      .then((res) => res.json())
      .then((config: { keyGlow?: string }) => {
        if (alive) setOn(config.keyGlow === "on");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return on;
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

/**
 * WP9 §2 "assembling" sub-stage: a best-effort mapping onto real pipeline
 * signals already exposed by SessionState/StreamState/Narrator, not a
 * hand-authored fake progress sequence (see briefs/WP9-handoff.md for the
 * exact derivation and its caveats — "voicing scene 1"'s window can be very
 * short or invisible in practice, since scene 1's video shot and its
 * narration are dispatched at nearly the same moment in lib/programme.ts).
 *
 *   reading the answer     — the translator hasn't sent its "answer" message.
 *   writing the programme  — the answer is known but nothing has started
 *                             rendering yet (no shot dispatched to fal).
 *   voicing scene 1        — Saskia only: rendering has started but track 1
 *                             hasn't resolved yet.
 *   rendering scene 1      — native voice once rendering starts, or Saskia
 *                             once track 1 has resolved.
 */
function assemblingStage(
  sessionState: SessionState | null,
  streamState: StreamState | null,
  voice: "native" | "saskia",
  narratorReady1: boolean
): string {
  if (!sessionState?.answer) return "reading the answer";
  const rendering = streamState?.rendering ?? false;
  const rendered = streamState?.rendered ?? 0;
  if (!rendering && rendered === 0) return "writing the programme";
  if (voice === "saskia" && !narratorReady1) return "voicing scene 1";
  return "rendering scene 1";
}

export function Player() {
  const theatre = useTheatre();
  const keyGlow = useKeyGlow();
  const musicOn = useMusicOn();
  const audioOn = useAudioOn();
  const musicRef = useRef<HTMLAudioElement>(null);

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
  /** WP4.2 §3: video, Saskia, the music bed and the countdown all stop together. */
  const [paused, setPaused] = useState(false);
  /** WP4.2 §2: the last known ticker card per company, kept even once a later record has none. */
  const [cardByCompany, setCardByCompany] = useState<Record<string, Record<string, unknown>>>({});

  const inputRef = useRef<HTMLInputElement>(null);
  /** The live session, outside React state so an ask never runs twice. */
  const sessionRef = useRef<Session | null>(null);
  const pictureRef = useRef<Picture | null>(null);
  /** Whether the clip on screen has played to its end (holding its last frame). */
  const endedRef = useRef(false);
  /** Read inside the countdown's setInterval so toggling pause doesn't reset the effect (and the count). */
  const pausedRef = useRef(false);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const focusInput = useCallback(() => inputRef.current?.focus(), []);
  useEffect(() => {
    focusInput();
  }, [focusInput]);

  // Ask: interrupt whatever is running and start the new programme. The
  // picture stays until the new programme's first clip exists.
  const ask = useCallback(
    (question: string, opts?: { fresh?: boolean }) => {
      const q = question.trim();
      if (!q) return;
      sessionRef.current?.cancel();
      const next = new Session(q, opts);
      sessionRef.current = next;
      next.start();
      setSession(next);
      setTyped("");
      setCountdown(null);
      // WP4.2 §3: interrupting while paused resumes into the new programme.
      setPaused(false);
      focusInput();
    },
    [focusInput]
  );

  // Leaving the page stops the programme.
  useEffect(
    () => () => {
      sessionRef.current?.cancel();
    },
    []
  );

  // WP4.2 §2: remember the last card seen for the company; a record with no
  // card (record.card null and no boilerplate to extract it from,
  // lib/curation.ts) leaves the previous one showing rather than blanking.
  const answerCard = sessionState?.answer?.card ?? null;
  useEffect(() => {
    if (!answerCard) return;
    setCardByCompany((prev) => ({ ...prev, [COMPANY]: answerCard }));
  }, [answerCard]);

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
    // Saskia: the narration for this clip's first beat starts with the clip.
    if (live && shown && shown.sessionId === live.id && shown.clip.videoUrl === clip.videoUrl) {
      live.narrator?.play(clip.shot.beats[0].n);
    }
  }, []);

  // WP8.1 §1: a scene-generation clip (CLIP_SECONDS=15) carries later
  // beats' own timecodes; Saskia's narration for each one starts exactly
  // when Screen reports its offset has been reached, same principle as
  // onStarted above for beat 0.
  const onBeatBoundary = useCallback((clip: ReadyClip, beatIndex: number) => {
    const live = sessionRef.current;
    const shown = pictureRef.current;
    if (live && shown && shown.sessionId === live.id && shown.clip.videoUrl === clip.videoUrl) {
      live.narrator?.play(clip.shot.beats[beatIndex].n);
    }
  }, []);

  const onEnded = useCallback(() => {
    endedRef.current = true;
    // Hold the last frame if nothing is ready: the next shot chains from
    // this exact image, so the hold reads as a beat and the cut is seamless.
    // The console seam is the buffer-state indicator for this wait.
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

  // WP9 §4: every matched question actually played this session, normalised
  // — a viewer's own click can replay anything (the displayed `suggestions`
  // list above is never filtered); only the *auto-continue* target below is
  // restricted to what hasn't played yet. Also records the as-asked text
  // when a session resolves to "none"/"error" (no captured answer at all):
  // without this, an auto-continue target that never matches a fixture
  // record would never be marked played and the countdown would retry the
  // exact same unanswerable question forever instead of moving on. Didn't
  // manifest against the 12-record fixture (every suggestion/spine question
  // in it resolves), but is a real gap against arbitrary future content —
  // see briefs/WP9-handoff.md.
  const [playedQuestions, setPlayedQuestions] = useState<string[]>([]);
  const resolvedKey =
    sessionState?.answer?.question ??
    (sessionState?.status === "none" || sessionState?.status === "error" ? sessionState.question : null);
  useEffect(() => {
    if (!resolvedKey) return;
    const norm = normalise(resolvedKey);
    setPlayedQuestions((prev) => (prev.includes(norm) ? prev : [...prev, norm]));
  }, [resolvedKey]);

  // The first not-yet-played question: the shown suggestions first, then
  // the spine (in its declared order) for anything the suggestions didn't
  // cover. Null when everything in both lists has already played — WP9 §4's
  // trigger for the **end** screen state, below.
  let autoContinueTarget: string | null = null;
  for (const q of suggestions) {
    if (!playedQuestions.includes(normalise(q))) {
      autoContinueTarget = q;
      break;
    }
  }
  if (!autoContinueTarget) {
    for (const q of SPINE_QUESTIONS) {
      if (!playedQuestions.includes(normalise(q))) {
        autoContinueTarget = q;
        break;
      }
    }
  }

  // Auto-continue: once the programme has ended (or could not start) and a
  // target remains, count down from 10 and continue into it. Typing pauses
  // it. No target at all is the **end** screen state (WP9 §2), not a
  // stalled countdown.
  const status = sessionState?.status ?? null;
  const sessionIdle =
    session !== null &&
    (phase === "ended" || status === "none" || status === "error");
  const isEndState = sessionIdle && !autoContinueTarget;
  useEffect(() => {
    if (!sessionIdle || !autoContinueTarget) {
      setCountdown(null);
      return;
    }
    setCountdown(AUTO_CONTINUE_SECONDS);
    const timer = setInterval(() => {
      // WP4.2 §3: frozen while paused, via a ref so pausing mid-count
      // doesn't restart this effect (and the count).
      if (pausedRef.current) return;
      setCountdown((value) => (value === null ? null : Math.max(0, value - 1)));
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionIdle, autoContinueTarget, session]);
  useEffect(() => {
    if (countdown !== 0 || typed.trim()) return;
    if (autoContinueTarget) ask(autoContinueTarget);
  }, [countdown, typed, autoContinueTarget, ask]);

  // WP9 §2 end state: the ask line is focused the moment there is nothing
  // left to auto-continue into.
  useEffect(() => {
    if (isEndState) focusInput();
  }, [isEndState, focusInput]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      // FRESH: Shift+Enter bypasses the cache for this question only.
      ask(typed, event.shiftKey ? { fresh: true } : undefined);
    } else if (event.key === "Escape") {
      setTyped("");
    }
  };

  // A question is pending from Enter until its first clip is on screen.
  const renderingShot = streamState?.rendering ? stream?.renderingShot() ?? null : null;
  const groundColor = renderingShot ? GROUND_HEX[renderingShot.beats[0].beat.ground] : LISTENING_CURSOR;
  const pending = session !== null && !picture && !sessionIdle;
  const listening = inputFocused || pending;

  // WP9 §1: KEY_GLOW=off (default) — the square key no longer renders any
  // glow at all (components/console.tsx), so it can't carry render state in
  // either mode any more; the ask-line cursor carries it in both theatre
  // and plain mode instead. KEY_GLOW=on keeps the previous split: theatre
  // leaves it to the key, plain always showed it on the cursor already.
  const keyState: KeyState = renderingShot ? "rendering" : listening ? "listening" : "off";
  const cursorRendering = (!theatre || !keyGlow) && Boolean(renderingShot);
  const cursorColor = cursorRendering ? groundColor : listening ? LISTENING_CURSOR : IDLE_CURSOR;

  const seamState: SeamState = !stream ? "idle" : buffered >= 2 ? "steady" : "filling";

  const next = phase === "playing" || phase === "buffering" ? stream?.peekNext() ?? null : null;
  const voice = sessionState?.switches?.voice ?? "native";

  // WP5: a low, looping music bed under Saskia only (never native, whose
  // clip audio already carries the voice) — playing exactly while a
  // programme is on screen and sound is not muted. Never touches
  // lib/stream.ts's buffer or clip audio; this is a second, independent
  // <audio> element.
  const musicPlaying = musicOn && audioOn && voice === "saskia" && !muted && !paused && (phase === "playing" || phase === "buffering");
  useEffect(() => {
    const el = musicRef.current;
    if (!el) return;
    el.volume = MUSIC_VOLUME;
    if (musicPlaying) {
      if (el.paused) el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [musicPlaying]);

  // WP4.2 §3: Saskia pauses/resumes with everything else.
  useEffect(() => {
    const narrator = sessionRef.current?.narrator;
    if (paused) narrator?.pause();
    else narrator?.resume();
  }, [paused]);

  // WP4.2 §3: click anywhere on the screen (theatre) or the video (plain) to
  // pause/resume; space does the same when the ask line isn't focused.
  // No-op with nothing on screen yet — there's nothing to pause.
  const togglePaused = useCallback(() => {
    if (!session) return;
    setPaused((p) => !p);
  }, [session]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || inputFocused) return;
      event.preventDefault();
      togglePaused();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inputFocused, togglePaused]);

  // "none" (below MATCH_THRESHOLD, lib/curation.ts) gets its own on-screen
  // deflection line (ScreenStatus, below) instead of this below-screen one.
  const statusLine = (() => {
    if (!sessionState) return null;
    if (sessionState.status === "error") return sessionState.error?.toLowerCase() ?? "something went wrong";
    return null;
  })();

  // WP4.2 §2: moved off the bottom strip (disclosure only now) onto the
  // bezel readout (theatre) / under-video readout (plain) — the persisted
  // last-known card, not the live answer's own (which can be null).
  const readoutText = formatCard(cardByCompany[COMPANY] ?? null);

  // WP9 §2: the screen states. idle = no programme yet; assembling = the
  // existing `pending` window; deflection = the typed question matched no
  // captured record (status "none" — lib/curation.ts's MATCH_THRESHOLD miss,
  // never the nearest record); end = sessionIdle with nothing left to
  // auto-continue into (§4); playing otherwise — a late next clip just
  // freezes the picture (screen.tsx) with the console seam as the buffer
  // indicator, no overlay of its own.
  const screenState: ScreenState =
    session === null
      ? "idle"
      : pending
        ? "assembling"
        : status === "none"
          ? "deflection"
          : isEndState
            ? "end"
            : "playing";

  // Re-render while waiting on Saskia's first track so the "voicing scene
  // 1" → "rendering scene 1" transition shows up: Narrator.isReady() is a
  // plain function on a mutable object, not itself observable, so this
  // polls at a short interval only while it's actually being watched.
  const narrator = session?.narrator ?? null;
  const [, forceVoicingTick] = useState(0);
  useEffect(() => {
    if (screenState !== "assembling" || voice !== "saskia" || !narrator) return;
    if (narrator.isReady(1)) return;
    const timer = setInterval(() => {
      if (narrator.isReady(1)) {
        clearInterval(timer);
      }
      forceVoicingTick((t) => t + 1);
    }, 250);
    return () => clearInterval(timer);
  }, [screenState, voice, narrator]);

  const stageText =
    screenState === "assembling" ? assemblingStage(sessionState, streamState, voice, narrator?.isReady(1) ?? false) : null;

  // WP4.2 §3: click anywhere on the screen/video to pause or resume.
  const screen = (
    <div
      className={`screen-frame${theatre ? " screen-frame--theatre" : ""}`}
      onClick={togglePaused}
    >
      <Screen
        picture={picture?.clip ?? null}
        next={next}
        className={`${theatre ? "screen--theatre" : ""}${screenState === "end" || screenState === "deflection" ? " screen--dim" : ""}`.trim() || undefined}
        // WP9: AUDIO=off mutes native voice's embedded speech (and any SFX)
        // the same way the viewer's own mute button does, without touching
        // `muted` state itself — the tap-for-sound flow stays about the
        // viewer's own choice, not this builder-testing switch.
        muted={muted || !audioOn}
        volume={voice === "saskia" ? 0.5 : 1}
        paused={paused}
        onEnded={onEnded}
        onNeedsTap={onNeedsTap}
        onStarted={onStarted}
        onBeatBoundary={onBeatBoundary}
      />
      <ScreenStatus
        state={screenState}
        stage={stageText}
        endLine="ask me anything about diginex"
      />
    </div>
  );

  const readout = readoutText ? <span className="readout">{readoutText}</span> : null;

  return (
    <main className={`tessera${theatre ? " theatre" : " plain"}`}>
      {musicOn && <audio ref={musicRef} src="/api/music" loop preload="auto" hidden />}
      {theatre ? (
        <Console
          keyState={keyState}
          groundColor={groundColor}
          seamState={seamState}
          keyGlow={keyGlow}
          readout={readout}
          paused={paused}
        >
          {screen}
        </Console>
      ) : (
        <>
          <div className="screen-wrap">{screen}</div>
          {readout && <div className="readout-plain">{readout}</div>}
        </>
      )}

      <div className="stage">
        <div className="content">
          <div className="ask" onClick={focusInput}>
            <span className="label">curation</span>
            <span
              className={`cursor${cursorRendering ? "" : " blink"}${paused ? " paused" : ""}`}
              style={{ color: cursorColor }}
              aria-hidden="true"
            />
            <span className="typed">{typed}</span>
            {/* WP4.2 §4: gone on focus, back when empty and unfocused */}
            {!typed && !inputFocused && <span className="placeholder">{ASK_PLACEHOLDER}</span>}
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
                {question === autoContinueTarget && countdown !== null && !typed.trim() && (
                  <span className="upnext">· up next in {countdown}s</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* WP4.2 §2: the ticker card moved to the readout above; the disclosure stays here alone. */}
      <div className="strip">information, not investment advice</div>
    </main>
  );
}
