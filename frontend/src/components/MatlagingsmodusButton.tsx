"use client";

interface MatlagingsmodusButtonProps {
  onClick: () => void;
  /**
   * Space to leave below the button. Defaults to the height of the app's bottom
   * nav; the share page has no bottom nav and passes a smaller offset.
   */
  bottomOffset?: string;
}

/**
 * Floating entry point to matlagingsmodus — the only one, and mobile only.
 *
 * Matlagingsmodus is a cooking-at-the-counter surface, so it is deliberately
 * not offered on desktop (`md:hidden`); the recipe page itself is the desktop
 * reading view.
 *
 * Always visible rather than revealed on scroll: it is the sole way in, so
 * gating it behind scroll position left the feature unreachable on long
 * recipes. Sits clear of the bottom nav and the home indicator.
 */
export function MatlagingsmodusButton({
  onClick,
  bottomOffset = "4rem",
}: MatlagingsmodusButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Start matlagingsmodus"
      data-testid="matlagingsmodus-fab"
      className="md:hidden fixed z-30"
      style={{
        bottom: `calc(${bottomOffset} + env(safe-area-inset-bottom) + 0.75rem)`,
        left: "50%",
        transform: "translateX(-50%)",
      }}
    >
      <span className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-full shadow-lg font-medium text-sm min-h-[44px]">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 3c0 1.2-1 1.6-1 2.5S9 7 9 7M13 3c0 1.2-1 1.6-1 2.5S13 7 13 7M17 3c0 1.2-1 1.6-1 2.5S17 7 17 7"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 11h16M5 11v5a4 4 0 004 4h6a4 4 0 004-4v-5M19 12h2v3h-2M5 12H3v3h2"
          />
        </svg>
        Matlagingsmodus
      </span>
    </button>
  );
}
