"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { TtsProvider } from "@/lib/types";
import { useBrowserFeature } from "@/lib/use-browser-storage";

export type MediaTrack = {
  id: string;
  title: string;
  url: string | null;
  transcript: string;
  provider: TtsProvider;
};

export const SPEEDS = [1, 1.25, 1.5, 2] as const;
export type Speed = (typeof SPEEDS)[number];

type Props = {
  track: MediaTrack | null;
  moduleLabel: string;
  initialSpeed?: Speed;
};

const WORDS_PER_SECOND = 150 / 60;

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function fmt(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

/**
 * Persistent accessibility & media bar.
 *
 * Speed is owned here so it survives track changes; everything else lives in
 * `TrackPlayer`, which is keyed by track id so its state resets per track.
 */
export function MediaBar({ track, moduleLabel, initialSpeed = 1 }: Props) {
  const reduceMotion = useReducedMotion();
  const [speed, setSpeed] = useState<Speed>(initialSpeed);

  return (
    <motion.div
      initial={reduceMotion ? false : { y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="glass-panel rounded-3xl bg-neutral-950/70 px-4 py-3 backdrop-blur-2xl sm:px-5"
    >
      <TrackPlayer
        key={track?.id ?? "none"}
        track={track}
        moduleLabel={moduleLabel}
        speed={speed}
        onSpeedChange={setSpeed}
      />
    </motion.div>
  );
}

type TrackPlayerProps = {
  track: MediaTrack | null;
  moduleLabel: string;
  speed: Speed;
  onSpeedChange: (speed: Speed) => void;
};

/**
 * Two engines share one set of controls:
 *  - `audio`  → HTMLAudioElement for real narration URLs (ElevenLabs / Aura).
 *  - `speech` → Web Speech API fallback, used while the TTS Agent is a stub
 *               (provider === "stub") or when the audio URL fails to load.
 *               Sentences are chunked so seek + speed changes are precise.
 */
function TrackPlayer({ track, moduleLabel, speed, onSpeedChange }: TrackPlayerProps) {
  const reduceMotion = useReducedMotion();
  const labelId = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechSupported = useBrowserFeature(() => "speechSynthesis" in window);

  const [audioFailed, setAudioFailed] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const engine: "audio" | "speech" =
    track?.url && track.provider !== "stub" && !audioFailed ? "audio" : "speech";

  // ── speech engine data ─────────────────────────────────────────────────
  const sentences = useMemo(() => (track ? splitSentences(track.transcript) : []), [track]);
  const sentenceStarts = useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    for (const s of sentences) {
      starts.push(acc);
      acc += s.split(" ").length / WORDS_PER_SECOND;
    }
    return { starts, total: acc };
  }, [sentences]);

  const sentenceIndexRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef<Speed>(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const duration = engine === "audio" ? audioDuration : sentenceStarts.total / speed;

  const speakFrom = useCallback(
    (index: number) => {
      const synth = window.speechSynthesis;
      if (!synth || sentences.length === 0) return;
      synth.cancel();

      const speakNext = (i: number) => {
        if (!playingRef.current) return;
        if (i >= sentences.length) {
          playingRef.current = false;
          setPlaying(false);
          setCurrentTime(sentenceStarts.total / speedRef.current);
          return;
        }
        sentenceIndexRef.current = i;
        setCurrentTime((sentenceStarts.starts[i] ?? 0) / speedRef.current);

        const utterance = new SpeechSynthesisUtterance(sentences[i]);
        utterance.rate = speedRef.current;
        utterance.onend = () => speakNext(i + 1);
        utterance.onerror = () => speakNext(i + 1);
        synth.speak(utterance);
      };

      speakNext(index);
    },
    [sentences, sentenceStarts],
  );

  // Stop speaking when the track unmounts / changes.
  useEffect(() => {
    return () => {
      playingRef.current = false;
      window.speechSynthesis?.cancel();
    };
  }, []);

  // ── audio engine wiring (all setState calls happen in event callbacks) ──
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || engine !== "audio") return;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setAudioDuration(audio.duration || 0);
    const onEnded = () => setPlaying(false);
    const onError = () => {
      setAudioFailed(true);
      setPlaying(false);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [engine]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  // ── handlers ───────────────────────────────────────────────────────────
  async function togglePlay() {
    if (!track) return;

    if (engine === "audio") {
      const audio = audioRef.current;
      if (!audio) return;
      if (playing) {
        audio.pause();
        setPlaying(false);
      } else {
        try {
          await audio.play();
          setPlaying(true);
        } catch {
          setAudioFailed(true);
        }
      }
      return;
    }

    if (playing) {
      playingRef.current = false;
      window.speechSynthesis?.cancel();
      setPlaying(false);
    } else {
      playingRef.current = true;
      setPlaying(true);
      speakFrom(sentenceIndexRef.current);
    }
  }

  function changeSpeed(value: Speed) {
    speedRef.current = value;
    onSpeedChange(value);
    // Restart the current sentence at the new rate — utterances can't be
    // re-rated mid-flight.
    if (engine === "speech" && playingRef.current) {
      speakFrom(sentenceIndexRef.current);
    }
  }

  function seek(value: number) {
    if (engine === "audio") {
      if (audioRef.current) audioRef.current.currentTime = value;
      setCurrentTime(value);
      return;
    }
    const target = value * speed;
    let idx = 0;
    for (let i = 0; i < sentenceStarts.starts.length; i += 1) {
      if ((sentenceStarts.starts[i] ?? 0) <= target) idx = i;
      else break;
    }
    sentenceIndexRef.current = idx;
    setCurrentTime((sentenceStarts.starts[idx] ?? 0) / speed);
    if (playingRef.current) speakFrom(idx);
  }

  function skip(deltaSec: number) {
    seek(Math.min(Math.max(currentTime + deltaSec, 0), duration || 0));
  }

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const disabled = !track || (engine === "speech" && (!speechSupported || sentences.length === 0));

  return (
    <div role="region" aria-labelledby={labelId}>
      <audio
        ref={audioRef}
        src={engine === "audio" && track?.url ? track.url : undefined}
        preload="metadata"
        className="sr-only"
        aria-hidden="true"
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
        {/* Transport */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => skip(-15)}
            disabled={disabled}
            aria-label="Back 15 seconds"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-neutral-300 transition hover:border-white/25 hover:text-white disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          >
            <span className="font-mono text-[11px]">-15</span>
          </button>
          <motion.button
            type="button"
            onClick={() => void togglePlay()}
            disabled={disabled}
            aria-pressed={playing}
            aria-label={playing ? "Pause narration" : "Play narration"}
            whileTap={reduceMotion ? undefined : { scale: 0.94 }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-violet-400 text-neutral-950 shadow-[0_0_28px_rgba(34,211,238,0.45)] transition hover:brightness-110 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </motion.button>
          <button
            type="button"
            onClick={() => skip(15)}
            disabled={disabled}
            aria-label="Forward 15 seconds"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-neutral-300 transition hover:border-white/25 hover:text-white disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          >
            <span className="font-mono text-[11px]">+15</span>
          </button>
        </div>

        {/* Track + seek */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p id={labelId} className="truncate text-sm font-medium text-white">
              {track ? track.title : "No narration selected"}
            </p>
            <p className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
              {moduleLabel}
            </p>
          </div>
          <label htmlFor={`${labelId}-seek`} className="sr-only">
            Seek narration
          </label>
          <input
            id={`${labelId}-seek`}
            type="range"
            min={0}
            max={duration || 0}
            step={0.5}
            value={Math.min(currentTime, duration || 0)}
            disabled={disabled}
            onChange={(e) => seek(Number(e.target.value))}
            aria-valuemin={0}
            aria-valuemax={duration || 0}
            aria-valuenow={currentTime}
            aria-valuetext={`${fmt(currentTime)} of ${fmt(duration)}`}
            style={{ "--seek-progress": `${progressPct}%` } as React.CSSProperties}
            className="seek-range mt-2 w-full disabled:opacity-40"
          />
          <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-neutral-500">
            <span>{fmt(currentTime)}</span>
            <span className="flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  engine === "audio" ? "bg-emerald-300" : "bg-violet-300"
                } ${playing ? "animate-pulse" : ""}`}
                aria-hidden="true"
              />
              {engine === "audio"
                ? "Studio narration"
                : speechSupported
                  ? "Browser voice · studio TTS pending"
                  : "Voice unavailable in this browser"}
            </span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        {/* Speed */}
        <div
          role="group"
          aria-label="Playback speed"
          className="flex items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1"
        >
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => changeSpeed(value)}
              aria-pressed={speed === value}
              aria-label={`${value} times speed`}
              className={`h-8 min-w-12 rounded-full px-2.5 font-mono text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                speed === value
                  ? "bg-cyan-400 text-neutral-950 shadow-[0_0_14px_rgba(34,211,238,0.5)]"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {value}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
