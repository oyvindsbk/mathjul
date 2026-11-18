"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "mathjul.jul.snow";

/**
 * The "Snø av/på" choice, remembered per browser. Defaults to on. Storage can
 * be unavailable (private mode, blocked site data), so every access is guarded
 * and the toggle still works for the visit.
 */
export function useSnowPreference(): [boolean, () => void] {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "off") setEnabled(false);
    } catch {
      // Storage unavailable: keep the default.
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
      } catch {
        // Storage unavailable: the choice lasts for this visit only.
      }
      return next;
    });
  }, []);

  return [enabled, toggle];
}
