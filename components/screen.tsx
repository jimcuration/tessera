"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReadyClip } from "@/lib/stream";

/**
 * The screen: two persistent <video> slots. One is in front, playing the
 * clip on screen; the other sits behind it, preloading the next clip. When
 * the front clip ends and the next is ready, the slots swap roles: the back
 * slot already holds decoded frames, so the cut has no gap. If the next
 * clip is late, the front slot freezes on its last frame until the back
 * slot has painted the incoming first frame, then swaps.
 *
 * Elements are never re-keyed or re-created: that is what keeps the picture
 * up across an interrupt, and what makes the swap a hard cut.
 */

export interface ScreenProps {
  /** The clip that should be on screen. */
  picture: ReadyClip | null;
  /** The clip expected after it, to preload. */
  next: ReadyClip | null;
  /** Extra class on the outer element: theatre mode fills its bounds and covers instead of the plain 16:9/contain box. */
  className?: string;
  muted: boolean;
  /** Under a Saskia narration the clip's own audio sits lower. */
  volume: number;
  /** WP4.2: pause the on-screen clip in place; resume from the same frame. */
  paused: boolean;
  onEnded: () => void;
  /** The browser refused unmuted autoplay; playback fell back to muted. */
  onNeedsTap: () => void;
  /** A clip has just started playing on screen (its first beat — `clip.shot.beats[0]`). */
  onStarted: (clip: ReadyClip) => void;
  /**
   * WP8.1 §1: a later beat within the on-screen clip has reached its own
   * timecode (CLIP_SECONDS=15 scene generation — `clip.shot.beats[1]`,
   * `[2]`, ...). Never fires for a clip with only one beat. `beatIndex` is
   * always ≥ 1; index 0 is `onStarted`.
   */
  onBeatBoundary?: (clip: ReadyClip, beatIndex: number) => void;
}

interface Slot {
  clip: ReadyClip | null;
}

export function Screen({ picture, next, className, muted, volume, paused, onEnded, onNeedsTap, onStarted, onBeatBoundary }: ScreenProps) {
  const refs = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  const [slots, setSlots] = useState<[Slot, Slot]>([{ clip: null }, { clip: null }]);
  const [front, setFront] = useState<0 | 1>(0);
  /** The clip we are waiting to bring to the front once its slot has data. */
  const pending = useRef<ReadyClip | null>(null);
  /** WP8.1 §1: highest beat index within the on-screen clip already fired (onStarted covers 0). Reset every time a new clip takes the front slot. */
  const firedBeatIndex = useRef(0);

  const back = front === 0 ? 1 : 0;

  const play = useCallback(
    (index: 0 | 1, clip: ReadyClip) => {
      const video = refs[index].current;
      if (!video) return;
      // readyState ≥ 2 means the first frame is decoded: the cut has no gap.
      console.debug(`[screen] beat ${clip.shot.n} → front slot ${index} (readyState ${video.readyState}, rendered in ${clip.renderMs}ms)`);
      video.muted = muted;
      video.volume = volume;
      video.currentTime = 0;
      firedBeatIndex.current = 0;
      const attempt = video.play();
      if (attempt) {
        attempt.catch(() => {
          video.muted = true;
          onNeedsTap();
          video.play().catch(() => {});
        });
      }
      onStarted(clip);
    },
    // refs are stable; the callbacks come from the player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [muted, volume, onNeedsTap, onStarted]
  );

  // WP8.1 §1: a scene-generation clip (CLIP_SECONDS=15) carries 2-3 beats
  // in one video; step through their offsets as playback crosses each one,
  // firing onBeatBoundary once per beat (index 0 is onStarted, above). A
  // 5s/10s clip has exactly one beat and never fires this.
  const onTimeUpdate = (index: 0 | 1) => {
    if (index !== front || !onBeatBoundary) return;
    const clip = slots[index].clip;
    const video = refs[index].current;
    if (!clip || !video || clip.shot.beats.length <= 1) return;
    const beats = clip.shot.beats;
    while (firedBeatIndex.current + 1 < beats.length && video.currentTime >= beats[firedBeatIndex.current + 1].offsetSeconds) {
      firedBeatIndex.current += 1;
      console.debug(
        `[screen] beat boundary: beat ${beats[firedBeatIndex.current].n} at ${video.currentTime.toFixed(2)}s (offset ${beats[firedBeatIndex.current].offsetSeconds}s)`
      );
      onBeatBoundary(clip, firedBeatIndex.current);
    }
  };

  // Bring `picture` to the front. If the back slot already holds it (it was
  // preloaded as `next`) swap at once; otherwise load it into the back slot
  // and swap when its first frame is decoded.
  useEffect(() => {
    if (!picture) return;
    const frontClip = slots[front].clip;
    if (frontClip && frontClip.videoUrl === picture.videoUrl) return;
    const backClip = slots[back].clip;
    if (backClip && backClip.videoUrl === picture.videoUrl) {
      const video = refs[back].current;
      if (video && video.readyState >= 2) {
        pending.current = null;
        setFront(back);
        play(back, picture);
        return;
      }
    } else {
      setSlots((s) => {
        const copy: [Slot, Slot] = [{ ...s[0] }, { ...s[1] }];
        copy[back] = { clip: picture };
        return copy;
      });
    }
    pending.current = picture;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picture]);

  // Preload `next` into the back slot whenever it is free.
  useEffect(() => {
    if (!next) return;
    if (pending.current && pending.current.videoUrl !== next.videoUrl) return;
    const backClip = slots[back].clip;
    if (backClip && backClip.videoUrl === next.videoUrl) return;
    const frontClip = slots[front].clip;
    if (frontClip && frontClip.videoUrl === next.videoUrl) return;
    setSlots((s) => {
      const copy: [Slot, Slot] = [{ ...s[0] }, { ...s[1] }];
      copy[back] = { clip: next };
      return copy;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next, slots, front, back]);

  // When a pending clip's slot has painted its first frame, swap.
  const onLoadedData = (index: 0 | 1) => {
    const clip = slots[index].clip;
    const wanted = pending.current;
    if (!clip || !wanted || clip.videoUrl !== wanted.videoUrl) return;
    if (index === front) return;
    pending.current = null;
    setFront(index);
    play(index, clip);
  };

  // Keep mute/volume in step with the player's controls.
  useEffect(() => {
    const video = refs[front].current;
    if (video) {
      video.muted = muted;
      video.volume = volume;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted, volume, front]);

  // WP4.2: pause holds the on-screen clip on its current frame; unpausing
  // resumes from there. The back slot is only ever preloading (play() below
  // is only called when a clip takes the front slot), so this never touches it.
  useEffect(() => {
    const video = refs[front].current;
    if (!video || !slots[front].clip) return;
    if (paused) {
      video.pause();
    } else if (video.paused) {
      video.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, front]);

  return (
    <div className={`screen${className ? ` ${className}` : ""}`}>
      {([0, 1] as const).map((i) => (
        <video
          key={i}
          ref={refs[i]}
          className={`reel${i === front ? "" : " back"}`}
          src={slots[i].clip?.videoUrl ?? undefined}
          preload="auto"
          muted={i === front ? muted : true}
          playsInline
          onLoadedData={() => onLoadedData(i)}
          onTimeUpdate={() => onTimeUpdate(i)}
          onEnded={() => {
            if (i === front) onEnded();
          }}
        />
      ))}
    </div>
  );
}
