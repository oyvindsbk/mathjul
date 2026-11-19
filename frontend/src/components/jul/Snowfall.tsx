"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { SNOW_LEVELS, type SnowLevel, type SnowLevelConfig } from "./snowLevels";

const SHAPE_ID = "jul-flake-shape";

interface Flake {
  x: string;
  size: string;
  duration: string;
  delay: string;
  drift: string;
  spin: string;
  opacity: number;
}

const between = ([min, max]: readonly [number, number]) => min + Math.random() * (max - min);

function randomFlakes(config: SnowLevelConfig): Flake[] {
  return Array.from({ length: config.count }, () => ({
    x: `${(Math.random() * 100).toFixed(2)}%`,
    size: `${between(config.size).toFixed(1)}px`,
    duration: `${between(config.duration).toFixed(1)}s`,
    // Negative delay starts each flake part-way down, so the screen isn't empty at first.
    delay: `${(-Math.random() * config.duration[1]).toFixed(1)}s`,
    drift: `${((Math.random() * 2 - 1) * config.drift).toFixed(0)}px`,
    spin: `${((Math.random() - 0.5) * 360).toFixed(0)}deg`,
    opacity: Number((0.75 + Math.random() * 0.25).toFixed(2)),
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

/** One arm: a spoke with one pair of side branches. Rotated six times below. */
const ARM = "M0 0V-10M0-6l-3.2-2.6M0-6l3.2-2.6";

/**
 * The flake shape, defined once and reused by every flake. Each arm is drawn
 * twice, a wide grey stroke under a narrower white one, which leaves a thin
 * outline so the flakes show on a white background.
 */
function FlakeDefs() {
  const arms = (stroke: string, width: number) => (
    <g stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <path key={deg} d={ARM} transform={`rotate(${deg})`} />
      ))}
    </g>
  );

  return (
    <svg width="0" height="0" style={{ position: "absolute" }} focusable="false">
      <defs>
        <g id={SHAPE_ID}>
          {arms("var(--jul-flake-edge)", 3)}
          {arms("var(--jul-flake-fill)", 1.6)}
        </g>
      </defs>
    </svg>
  );
}

/**
 * Falling snow over the page column, as much as the chosen level asks for.
 * Positions are random, so flakes are only created after mount (and again on
 * every level change): the server renders an empty layer and hydration
 * matches. Only transform is animated, and nothing renders under reduced motion.
 */
export function Snowfall({ level }: { level: SnowLevel }) {
  const [flakes, setFlakes] = useState<Flake[]>([]);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    setFlakes(randomFlakes(SNOW_LEVELS[level]));
  }, [level]);

  const show = !reducedMotion;

  return (
    <div className="jul-snow" aria-hidden="true" data-testid="jul-snow">
      <FlakeDefs />
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
                "--spin": f.spin,
                "--opacity": f.opacity,
              } as CSSProperties
            }
          >
            <svg viewBox="-12 -12 24 24" focusable="false">
              <use href={`#${SHAPE_ID}`} />
            </svg>
          </span>
        ))}
    </div>
  );
}
