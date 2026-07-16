"use client";

import { useCallback, useRef } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

export type SoundName =
  | "select"
  | "correct"
  | "wrong"
  | "combo"
  | "warning"
  | "rankup"
  | "complete";

/** Simple WebAudio blips — no assets, respects the sound toggle and autoplay. */
const TONES: Record<SoundName, { freq: number; dur: number; type: OscillatorType }[]> = {
  select: [{ freq: 440, dur: 0.05, type: "sine" }],
  correct: [
    { freq: 523, dur: 0.08, type: "sine" },
    { freq: 784, dur: 0.12, type: "sine" },
  ],
  wrong: [{ freq: 160, dur: 0.18, type: "sawtooth" }],
  combo: [
    { freq: 659, dur: 0.06, type: "triangle" },
    { freq: 880, dur: 0.1, type: "triangle" },
  ],
  warning: [{ freq: 330, dur: 0.08, type: "square" }],
  rankup: [
    { freq: 523, dur: 0.09, type: "sine" },
    { freq: 659, dur: 0.09, type: "sine" },
    { freq: 988, dur: 0.16, type: "sine" },
  ],
  complete: [
    { freq: 440, dur: 0.1, type: "sine" },
    { freq: 660, dur: 0.14, type: "sine" },
  ],
};

export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);

  const play = useCallback(
    (name: SoundName) => {
      if (!soundEnabled) return;
      try {
        if (!ctxRef.current) {
          const Ctx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          ctxRef.current = new Ctx();
        }
        const ctx = ctxRef.current;
        if (ctx.state === "suspended") void ctx.resume();
        let t = ctx.currentTime;
        for (const tone of TONES[name]) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = tone.type;
          osc.frequency.value = tone.freq;
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + tone.dur);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t);
          osc.stop(t + tone.dur);
          t += tone.dur;
        }
      } catch {
        // Audio not available — ignore silently.
      }
    },
    [soundEnabled],
  );

  const vibrate = useCallback(
    (pattern: number | number[]) => {
      if (!hapticsEnabled) return;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(pattern);
      }
    },
    [hapticsEnabled],
  );

  return { play, vibrate };
}
