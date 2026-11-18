import type { CSSProperties } from "react";

const LINK_COLORS = ["#c0392b", "#1f7a3f", "#d4a017"];
const LOOP_COUNT = 48;

/**
 * A julelenke (paper chain) across the page header: loops facing the viewer,
 * joined by strips seen edge-on. CSS-only and static, so server and client
 * render the same markup. It overflows and is clipped at narrow widths.
 */
export function JulGarland() {
  return (
    <div className="jul-chain" aria-hidden="true" data-testid="jul-garland">
      {Array.from({ length: LOOP_COUNT }, (_, i) => (
        <Pair key={i} index={i} />
      ))}
    </div>
  );
}

function Pair({ index }: { index: number }) {
  const loop = { "--link": LINK_COLORS[(index * 2) % LINK_COLORS.length] } as CSSProperties;
  const strip = { "--link": LINK_COLORS[(index * 2 + 1) % LINK_COLORS.length] } as CSSProperties;
  return (
    <>
      <span className="jul-chain-loop" style={loop} />
      <span className="jul-chain-strip" style={strip} />
    </>
  );
}
