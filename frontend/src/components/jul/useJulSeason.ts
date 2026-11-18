"use client";

import { useEffect, useState } from "react";
import { isJulSeason, osloDate } from "@/lib/jul";

/**
 * Whether the Jul entry points should show (1 Nov – 6 Jan, Europe/Oslo).
 * False on the server and the first client render, so hydration always
 * matches; the links appear right after mount when in season.
 */
export function useJulSeason(): boolean {
  const [inSeason, setInSeason] = useState(false);

  useEffect(() => {
    setInSeason(isJulSeason(osloDate(new Date())));
  }, []);

  return inSeason;
}
