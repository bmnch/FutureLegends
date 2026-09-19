"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  title: string;
  src?: string;
};

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

export function NarrationPlayer({ title, src }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const labelId = useId();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    const onEnded = () => setPlaying(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }

  function format(seconds: number) {
    if (!Number.isFinite(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  }

  return (
    <div
      className="flex h-full flex-col rounded-md border border-border bg-surface-elevated p-5"
      role="region"
      aria-labelledby={labelId}
    >
      <h2 id={labelId} className="text-lg font-semibold text-foreground">
        AI voice narration
      </h2>
      <p className="mt-1 text-sm text-muted">{title}</p>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="sr-only"
        aria-label={`Audio narration for ${title}`}
      />

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-pressed={playing}
          aria-label={playing ? "Pause narration" : "Play narration"}
          className="inline-flex h-11 min-w-28 items-center justify-center rounded-md bg-neon px-4 text-sm font-semibold text-black transition hover:bg-neon-hot focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon"
        >
          {playing ? "Pause" : "Play"}
        </button>

        <div
          className="flex items-center gap-2"
          role="group"
          aria-label="Playback speed"
        >
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSpeed(value)}
              aria-pressed={speed === value}
              aria-label={`${value} times speed`}
              className={`h-9 rounded-md border px-2.5 font-mono text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon ${
                speed === value
                  ? "border-neon text-neon"
                  : "border-border text-muted hover:border-zinc-500"
              }`}
            >
              {value}x
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <label htmlFor={`${labelId}-seek`} className="sr-only">
          Seek narration
        </label>
        <input
          id={`${labelId}-seek`}
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (audioRef.current) {
              audioRef.current.currentTime = next;
            }
            setCurrentTime(next);
          }}
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={currentTime}
          aria-valuetext={`${format(currentTime)} of ${format(duration)}`}
          className="w-full accent-neon"
        />
        <div className="mt-2 flex justify-between font-mono text-xs text-muted">
          <span>{format(currentTime)}</span>
          <span>{format(duration)}</span>
        </div>
      </div>

      {!src ? (
        <p className="mt-6 text-sm text-muted" role="status">
          Narration audio will appear here after post-payment generation
          completes.
        </p>
      ) : null}
    </div>
  );
}
