"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { SNOW_LEVELS, type SnowLevel, type SnowLevelConfig, type SnowMotion } from "./snowLevels";

const SHAPE_ID = "jul-flake-shape";
/** Storm flakes pass through this many points after the start (see jul-whirl). */
const WHIRL_STEPS = 4;

interface Flake {
  motion: SnowMotion;
  /** CSS custom properties read by the .jul-flake animations. */
  vars: Record<string, string | number>;
}

const between = ([min, max]: readonly [number, number]) => min + Math.random() * (max - min);
const signed = (max: number) => (Math.random() * 2 - 1) * max;

/** Properties every flake has, whatever its motion. */
function baseVars(config: SnowLevelConfig) {
  return {
    "--size": `${between(config.size).toFixed(1)}px`,
    "--duration": `${between(config.duration).toFixed(1)}s`,
    // Negative delay starts each flake part-way through, so the screen isn't empty at first.
    "--delay": `${(-Math.random() * config.duration[1]).toFixed(1)}s`,
    "--spin": `${signed(180).toFixed(0)}deg`,
    "--opacity": Number((0.75 + Math.random() * 0.25).toFixed(2)),
  };
}

function fallingFlake(config: SnowLevelConfig): Flake {
  return {
    motion: "fall",
    vars: {
      ...baseVars(config),
      "--x": `${(Math.random() * 100).toFixed(2)}%`,
      "--drift": `${signed(config.drift).toFixed(0)}px`,
    },
  };
}

/**
 * A storm flake: blown along by the wind, but each leg of its path also
 * gusts sideways and up or down, so the snow whirls in every direction.
 * Flakes start upwind of the screen as well as on it, so they also blow in
 * from the side.
 */
function whirlingFlake(config: SnowLevelConfig, wind: number): Flake {
  const vars: Flake["vars"] = {
    ...baseVars(config),
    "--x": `${(Math.random() * 130 - 15 - wind * 25).toFixed(1)}%`,
  };

  let x = 0;
  let y = Math.random() * 100 - 10;
  vars["--wx0"] = "0vw";
  vars["--wy0"] = `${y.toFixed(1)}vh`;
  for (let step = 1; step <= WHIRL_STEPS; step++) {
    x += wind * between([8, 22]) + signed(18);
    y = Math.min(110, Math.max(-15, y + signed(45) + 12));
    vars[`--wx${step}`] = `${x.toFixed(1)}vw`;
    vars[`--wy${step}`] = `${y.toFixed(1)}vh`;
  }

  return { motion: "whirl", vars };
}

function randomFlakes(config: SnowLevelConfig): Flake[] {
  // One wind direction per storm, so the gusts have somewhere to blow.
  const wind = Math.random() < 0.5 ? -1 : 1;
  return Array.from({ length: config.count }, () =>
    config.motion === "whirl" ? whirlingFlake(config, wind) : fallingFlake(config)
  );
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
 * Snow over the page column, as much as the chosen level asks for. Positions
 * are random, so flakes are only created after mount (and again on every
 * level change): the server renders an empty layer and hydration matches.
 * Only transform and opacity are animated, and nothing renders under reduced
 * motion.
 */
export function Snowfall({ level }: { level: SnowLevel }) {
  const [flakes, setFlakes] = useState<Flake[]>([]);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    setFlakes(randomFlakes(SNOW_LEVELS[level]));
  }, [level]);

  return (
    <div className="jul-snow" aria-hidden="true" data-testid="jul-snow">
      <FlakeDefs />
      {!reducedMotion &&
        flakes.map((f, i) => (
          <span
            key={i}
            className={f.motion === "whirl" ? "jul-flake jul-flake-whirl" : "jul-flake"}
            data-testid="jul-flake"
            data-motion={f.motion}
            style={f.vars as CSSProperties}
          >
            <svg viewBox="-12 -12 24 24" focusable="false">
              <use href={`#${SHAPE_ID}`} />
            </svg>
          </span>
        ))}
    </div>
  );
}
