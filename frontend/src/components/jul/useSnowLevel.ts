"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SNOW_LEVEL, toSnowLevel, type SnowLevel } from "./snowLevels";

const LEVEL_KEY = "mathjul.jul.snowLevel";
/** The 066 on/off key. "off" there means the visitor chose no snow. */
const LEGACY_KEY = "mathjul.jul.snow";

function readStoredLevel(): SnowLevel | null {
  const stored = toSnowLevel(localStorage.getItem(LEVEL_KEY) ?? NaN);
  if (stored !== null) return stored;
  return localStorage.getItem(LEGACY_KEY) === "off" ? 0 : null;
}

/**
 * The chosen snow level, remembered per browser. Defaults to Lett snøfall.
 * Storage can be unavailable (private mode, blocked site data), so every
 * access is guarded and the slider still works for the visit.
 */
export function useSnowLevel(): [SnowLevel, (level: SnowLevel) => void] {
  const [level, setLevelState] = useState<SnowLevel>(DEFAULT_SNOW_LEVEL);

  useEffect(() => {
    try {
      const stored = readStoredLevel();
      if (stored !== null) setLevelState(stored);
    } catch {
      // Storage unavailable: keep the default.
    }
  }, []);

  const setLevel = useCallback((next: SnowLevel) => {
    setLevelState(next);
    try {
      localStorage.setItem(LEVEL_KEY, String(next));
    } catch {
      // Storage unavailable: the choice lasts for this visit only.
    }
  }, []);

  return [level, setLevel];
}
