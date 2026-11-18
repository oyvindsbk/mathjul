"use client";

import { useEffect, useState } from "react";
import { julCountdown, julCountdownText, osloDate } from "@/lib/jul";

/**
 * "N dager til julaften" and friends. Computed after mount only, since the
 * server's date (and time zone) may differ from the visitor's, which would
 * otherwise cause a hydration mismatch. The pill keeps its size meanwhile.
 */
export function JulCountdown() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    setText(julCountdownText(julCountdown(osloDate(new Date()))));
  }, []);

  return (
    <p
      className="jul-pill inline-flex items-center justify-center min-h-10 min-w-48 rounded-full px-5 py-2 text-base md:text-lg font-semibold"
      data-testid="jul-countdown"
      aria-live="polite"
    >
      {text ?? " "}
    </p>
  );
}
