"use client";

import { useEffect, useRef, useState } from "react";

interface MatlagingsmodusButtonProps {
  onClick: () => void;
  /** Element whose visibility drives the floating button. */
  ingredientsSectionId: string;
}

/**
 * Floating entry point to matlagingsmodus.
 *
 * Replaces the old ingredients FAB and keeps its behaviour: hidden until the
 * ingredients section scrolls out of view, positioned clear of the bottom nav
 * and the home indicator.
 */
export function MatlagingsmodusButton({ onClick, ingredientsSectionId }: MatlagingsmodusButtonProps) {
  const [visible, setVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const target = document.getElementById(ingredientsSectionId);
    if (!target) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: "0px 0px 200px 0px" }
    );
    observerRef.current.observe(target);

    return () => observerRef.current?.disconnect();
  }, [ingredientsSectionId]);

  return (
    <button
      onClick={onClick}
      aria-label="Start matlagingsmodus"
      data-testid="matlagingsmodus-fab"
      className={`fixed z-30 transition-all duration-300 ${
        visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      style={{
        bottom: "calc(4rem + env(safe-area-inset-bottom) + 0.75rem)",
        left: "50%",
        transform: `translateX(-50%) translateY(${visible ? "0" : "1rem"})`,
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
