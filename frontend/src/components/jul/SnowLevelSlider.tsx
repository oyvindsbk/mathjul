"use client";

import { useId } from "react";
import { MAX_SNOW_LEVEL, SNOW_LEVELS, toSnowLevel, type SnowLevel } from "./snowLevels";

/** "Snø" slider with five stops, from Ingen snø to Snøstorm. */
export function SnowLevelSlider({
  level,
  onChange,
}: {
  level: SnowLevel;
  onChange: (level: SnowLevel) => void;
}) {
  const id = useId();
  const label = SNOW_LEVELS[level].label;

  return (
    <div className="jul-toggle inline-flex items-center gap-3 rounded-full px-4 py-2 text-sm">
      <label htmlFor={id} className="font-medium">
        ❄ Snø
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={MAX_SNOW_LEVEL}
        step={1}
        value={level}
        aria-valuetext={label}
        data-testid="jul-snow-level"
        className="jul-range w-28 sm:w-36"
        onChange={(e) => {
          const next = toSnowLevel(e.target.value);
          if (next !== null) onChange(next);
        }}
      />
      <span className="min-w-[8.5rem] text-left" data-testid="jul-snow-level-name" aria-hidden="true">
        {label}
      </span>
    </div>
  );
}
