import type { ReactNode } from "react";
import { Mountains_of_Christmas } from "next/font/google";
import "./jul.css";

/** Christmas display font for headings only; self-hosted by next/font at build. */
const julFont = Mountains_of_Christmas({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-jul",
});

/** Page-scoped wrapper carrying the Jul palette (light and night-sky dark) and font. */
export function JulTheme({ children }: { children: ReactNode }) {
  return (
    <div className={`jul-theme ${julFont.variable}`} data-testid="jul-theme">
      {children}
    </div>
  );
}
