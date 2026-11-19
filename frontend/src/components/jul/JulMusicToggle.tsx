"use client";

import type { JulMusic } from "./useJulMusic";

/** "♪ Julemusikk" on/off. Off by default; never starts by itself. */
export function JulMusicToggle({ music }: { music: JulMusic }) {
  return (
    <button
      type="button"
      onClick={music.toggle}
      disabled={!music.supported}
      aria-pressed={music.playing}
      data-testid="jul-music-toggle"
      title={music.supported ? undefined : "Nettleseren din kan ikke spille julemusikken"}
      className="jul-toggle rounded-full px-4 py-2 text-sm font-medium aria-pressed:bg-[var(--jul-red)] aria-pressed:text-white aria-pressed:border-[var(--jul-red)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      ♪ Julemusikk
    </button>
  );
}

/** "Nå spiller: …" under the header controls, while the music plays. */
export function JulNowPlaying({ music }: { music: JulMusic }) {
  return (
    <p className="jul-muted mt-3 min-h-5 text-sm" aria-live="polite">
      {music.playing && music.title && (
        <span data-testid="jul-now-playing">Nå spiller: {music.title}</span>
      )}
    </p>
  );
}
