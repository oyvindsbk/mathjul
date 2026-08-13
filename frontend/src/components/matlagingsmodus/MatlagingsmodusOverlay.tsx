"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Recipe } from "@/lib/mock-data";
import { useWakeLock } from "@/hooks/useWakeLock";
import { IngredientsTab } from "./IngredientsTab";
import { InstructionsTab } from "./InstructionsTab";

type Tab = "ingredienser" | "instruksjoner";

const TABS: { id: Tab; label: string }[] = [
  { id: "ingredienser", label: "Ingredienser" },
  { id: "instruksjoner", label: "Slik gjør du" },
];

interface MatlagingsmodusOverlayProps {
  open: boolean;
  onClose: () => void;
  recipe: Recipe;
  desiredServings: number;
  onServingsChange: (n: number) => void;
  checkedIngredients: Set<string>;
  checkedSteps: Set<number>;
  onToggleIngredient: (key: string) => void;
  onToggleStep: (stepNumber: number) => void;
  onReset: () => void;
  hasProgress: boolean;
}

export function MatlagingsmodusOverlay({
  open,
  onClose,
  recipe,
  desiredServings,
  onServingsChange,
  checkedIngredients,
  checkedSteps,
  onToggleIngredient,
  onToggleStep,
  onReset,
  hasProgress,
}: MatlagingsmodusOverlayProps) {
  const [tab, setTab] = useState<Tab>("ingredienser");
  const panelRef = useRef<HTMLDivElement>(null);
  const tablistRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  // Where focus came from, so it can be handed back on close.
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Cooking is the whole point of this surface, so hold the screen awake while
  // it is open. No-op where unsupported.
  useWakeLock(open);

  // Lock background scrolling. The cleanup runs even if the component unmounts
  // while open, so the page can never be left unscrollable.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      // Focus the panel itself rather than the first control, so a screen
      // reader announces the dialog before its contents.
      requestAnimationFrame(() => panelRef.current?.focus());
    } else {
      previouslyFocused.current?.focus?.();
      previouslyFocused.current = null;
    }
  }, [open]);

  const focusables = useCallback((): HTMLElement[] => {
    if (!panelRef.current) return [];
    return Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetParent !== null);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      // Keep focus inside the dialog.
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, focusables]);

  /** Left/right arrows move between tabs, per the tablist pattern. */
  const onTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const idx = TABS.findIndex((t) => t.id === tab);
    const next = e.key === "ArrowRight" ? (idx + 1) % TABS.length : (idx - 1 + TABS.length) % TABS.length;
    setTab(TABS[next].id);
    tablistRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Matlagingsmodus: ${recipe.title}`}
        data-testid="matlagingsmodus-overlay"
        tabIndex={-1}
        // Keeps the closed panel out of the tab order and the accessibility
        // tree; opacity-0 alone would leave it focusable and announced.
        inert={!open}
        aria-hidden={!open}
        // The md: translate override cancels translate-y-full, so off-screen
        // positioning alone cannot hide this on desktop — opacity and
        // pointer-events are what actually take it out of the page when closed.
        className={`fixed z-50 bg-white shadow-2xl flex flex-col transition-all duration-300 outline-none
          inset-x-0 bottom-0 top-0 rounded-none
          md:inset-y-8 md:left-1/2 md:right-auto md:w-full md:max-w-2xl md:-translate-x-1/2 md:rounded-2xl
          ${
            open
              ? "translate-y-0 opacity-100 pointer-events-auto"
              : "translate-y-full md:translate-y-4 opacity-0 pointer-events-none"
          }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onTouchStart={(e) => {
          touchStartY.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          if (touchStartY.current === null) return;
          const delta = e.changedTouches[0].clientY - touchStartY.current;
          touchStartY.current = null;
          // Only a swipe that starts at the very top should dismiss; otherwise
          // scrolling a long ingredient list would close the overlay.
          if (delta > 60 && (e.currentTarget.querySelector("[data-scroll]")?.scrollTop ?? 0) === 0) {
            onClose();
          }
        }}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0 md:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="flex items-center justify-between px-4 pt-2 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 truncate pr-2">{recipe.title}</h2>
          <div className="flex items-center gap-2 shrink-0">
            {hasProgress && (
              <button
                type="button"
                onClick={onReset}
                data-testid="matlagingsmodus-reset"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium min-h-[44px] px-1"
              >
                Begynn på nytt
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Lukk matlagingsmodus"
              data-testid="matlagingsmodus-close"
              className="flex items-center justify-center w-11 h-11 min-h-[44px] rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div
          ref={tablistRef}
          role="tablist"
          aria-label="Matlagingsmodus"
          className="flex border-b shrink-0 px-2"
          onKeyDown={onTabKeyDown}
        >
          {TABS.map((t) => {
            const selected = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                id={`matlagingsmodus-tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`matlagingsmodus-panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                data-testid={`matlagingsmodus-tab-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-3 min-h-[44px] text-base font-medium transition-colors ${
                  selected
                    ? "text-gray-900 border-b-2 border-[#4a7c3f]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div data-scroll className="overflow-y-auto px-4 py-4 flex-1">
          <div
            role="tabpanel"
            id="matlagingsmodus-panel-ingredienser"
            aria-labelledby="matlagingsmodus-tab-ingredienser"
            hidden={tab !== "ingredienser"}
          >
            {tab === "ingredienser" && (
              <IngredientsTab
                ingredients={recipe.ingredients}
                ingredientSections={recipe.ingredientSections}
                servings={recipe.servings}
                quantityType={recipe.quantityType}
                customUnit={recipe.customUnit}
                desiredServings={desiredServings}
                onServingsChange={onServingsChange}
                checkedIngredients={checkedIngredients}
                onToggleIngredient={onToggleIngredient}
              />
            )}
          </div>
          <div
            role="tabpanel"
            id="matlagingsmodus-panel-instruksjoner"
            aria-labelledby="matlagingsmodus-tab-instruksjoner"
            hidden={tab !== "instruksjoner"}
          >
            {tab === "instruksjoner" && (
              <InstructionsTab
                instructionSteps={recipe.instructionSteps}
                instructionSections={recipe.instructionSections}
                checkedSteps={checkedSteps}
                onToggleStep={onToggleStep}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
