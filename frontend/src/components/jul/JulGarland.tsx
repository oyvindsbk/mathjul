/**
 * A julelenke (paper chain) across the page header. It is one repeating CSS
 * background tile (see .jul-chain in jul.css), so it spans any screen width and
 * renders the same on server and client.
 */
export function JulGarland() {
  return <div className="jul-chain" aria-hidden="true" data-testid="jul-garland" />;
}
