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
  muted: boolean;
  /** Under a Saskia narration the clip's own audio sits lower. */
  volume: number;
  onEnded: () => void;
  /** The browser refused unmuted autoplay; playback fell back to muted. */
  onNeedsTap: () => void;
  /** A clip has just started playing on screen. */
  onStarted: (clip: ReadyClip) => void;
}

interface Slot {
  clip: ReadyClip | null;
}

export function Screen({ picture, next, muted, volume, onEnded, onNeedsTap, onStarted }: ScreenProps) {
  const refs = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  const [slots, setSlots] = useState<[Slot, Slot]>([{ clip: null }, { clip: null }]);
  const [front, setFront] = useState<0 | 1>(0);
  /** The clip we are waiting to bring to the front once its slot has data. */
  const pending = useRef<ReadyClip | null>(null);

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

  return (
    <div className="screen">
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
          onEnded={() => {
            if (i === front) onEnded();
          }}
        />
      ))}
    </div>
  );
}
