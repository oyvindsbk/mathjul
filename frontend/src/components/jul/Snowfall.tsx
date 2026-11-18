"use client";

import { useEffect, useState, type CSSProperties } from "react";

const FLAKE_COUNT = 36;

interface Flake {
  x: string;
  size: string;
  duration: string;
  delay: string;
  drift: string;
  opacity: number;
}

function randomFlakes(): Flake[] {
  return Array.from({ length: FLAKE_COUNT }, () => ({
    x: `${(Math.random() * 100).toFixed(2)}%`,
    size: `${(3 + Math.random() * 5).toFixed(1)}px`,
    duration: `${(8 + Math.random() * 10).toFixed(1)}s`,
    // Negative delay starts each flake part-way down, so the screen isn't empty at first.
    delay: `${(-Math.random() * 18).toFixed(1)}s`,
    drift: `${((Math.random() - 0.5) * 80).toFixed(0)}px`,
    opacity: Number((0.55 + Math.random() * 0.45).toFixed(2)),
  }));
}

/** Tracks prefers-reduced-motion, live. False until mounted. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * Falling snow over the page column. Positions are random, so flakes are only
 * created after mount: the server renders an empty layer and hydration matches.
 * Only transform is animated, and nothing renders under reduced motion.
 */
export function Snowfall({ enabled }: { enabled: boolean }) {
  const [flakes, setFlakes] = useState<Flake[]>([]);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    setFlakes(randomFlakes());
  }, []);

  const show = enabled && !reducedMotion;

  return (
    <div className="jul-snow" aria-hidden="true" data-testid="jul-snow">
      {show &&
        flakes.map((f, i) => (
          <span
            key={i}
            className="jul-flake"
            data-testid="jul-flake"
            style={
              {
                "--x": f.x,
                "--size": f.size,
                "--duration": f.duration,
                "--delay": f.delay,
                "--drift": f.drift,
                "--opacity": f.opacity,
              } as CSSProperties
            }
          />
        ))}
    </div>
  );
}
