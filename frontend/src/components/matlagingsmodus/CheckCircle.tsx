"use client";

/**
 * The round tick used by both cooking tabs.
 *
 * Colours match the instruction checkboxes already on the recipe detail page,
 * so the overlay reads as the same system rather than a lookalike.
 */
export function CheckCircle({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 transition-colors ${
        checked ? "border-2 border-[#e8f1e1] bg-[#e8f1e1]" : "border-2 border-gray-400 bg-white"
      }`}
    >
      {checked && (
        <svg
          viewBox="0 0 12 10"
          className="w-3 h-3"
          fill="none"
          stroke="#4a7c3f"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="1,5 4,8 11,1" />
        </svg>
      )}
    </span>
  );
}
