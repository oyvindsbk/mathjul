import type { CSSProperties } from "react";

const BULB_COLORS = ["#e63946", "#f2c94c", "#2a9d8f", "#4cc9f0", "#f4a261"];
const BULB_COUNT = 24;

/**
 * A CSS-only string of twinkling lights across the page header. The markup is
 * static, so it renders the same on server and client; the twinkle is off under
 * prefers-reduced-motion (see jul.css).
 */
export function JulLights() {
  return (
    <div className="jul-lights" aria-hidden="true" data-testid="jul-lights">
      {Array.from({ length: BULB_COUNT }, (_, i) => (
        <span
          key={i}
          className="jul-bulb"
          style={
            {
              "--bulb": BULB_COLORS[i % BULB_COLORS.length],
              "--delay": `${((i * 7) % 10) * 0.18}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
