"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { canPlayMusicBox, MusicBox } from "./musicBox";

export interface JulMusic {
  /** False until mounted, and in browsers without Web Audio. */
  supported: boolean;
  playing: boolean;
  /** The song now sounding, once its first note has played. */
  title: string | null;
  toggle: () => void;
}

/**
 * The /jul music box as React state. Always off at first: it only starts on
 * a click, and is not resumed on the next visit. It pauses while the tab is
 * hidden and stops for good when the page unmounts (leaving /jul).
 */
export function useJulMusic(): JulMusic {
  const boxRef = useRef<MusicBox | null>(null);
  const [supported, setSupported] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    setSupported(canPlayMusicBox());
    return () => boxRef.current?.stop();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const onVisibility = () => {
      if (document.hidden) boxRef.current?.pause();
      else boxRef.current?.resume();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [playing]);

  const toggle = useCallback(() => {
    boxRef.current ??= new MusicBox({ onSongChange: setTitle });
    const box = boxRef.current;

    if (box.playing) {
      box.stop();
      setPlaying(false);
      setTitle(null);
      return;
    }

    try {
      box.start();
      setPlaying(true);
    } catch {
      setSupported(false);
    }
  }, []);

  return { supported, playing, title, toggle };
}
