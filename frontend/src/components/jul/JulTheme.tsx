import type { ReactNode } from "react";
import { julFont } from "./julFont";
import "./jul.css";

/** Page-scoped wrapper carrying the Jul palette (light and night-sky dark) and font. */
export function JulTheme({ children }: { children: ReactNode }) {
  return (
    <div className={`jul-theme ${julFont.variable}`} data-testid="jul-theme">
      {children}
    </div>
  );
}
