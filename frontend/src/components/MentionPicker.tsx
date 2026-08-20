"use client";

import { useEffect, useMemo, useRef } from "react";
import type { StructuredIngredient } from "@/lib/mock-data";
import { formatIngredientParts } from "@/lib/recipe-format";

/**
 * The ingredient picker opened by typing `@` in an instruction step.
 *
 * Anchored under the textarea rather than at the caret: a textarea gives no
 * per-character geometry, and chasing it would need a mirrored div. Anchoring to
 * the field is both simpler and steadier to look at.
 *
 * Focus deliberately stays in the textarea — the author keeps typing to filter,
 * so this is a combobox popup driven from outside, not a focusable widget. That
 * is why the active option is tracked with `aria-activedescendant` on the
 * textarea instead of by moving focus, and why keyboard handling lives in the
 * parent: only the textarea ever has focus to receive the events.
 */

export interface MentionPickerProps {
  /** Every mentionable ingredient, flat and sectioned, in list order. */
  ingredients: StructuredIngredient[];
  /** The text typed after `@`, filtering the list. */
  query: string;
  /** Index of the highlighted option, owned by the parent's key handling. */
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelect: (ingredient: StructuredIngredient) => void;
  /** Base servings, so an option previews the same amount the step will show. */
  baseServings?: number | null;
  desiredServings: number;
  /** Id of the listbox, referenced by the textarea's `aria-controls`. */
  id: string;
}

/** Options matching `query` anywhere in the name, in the recipe's own order. */
export function filterIngredients(
  ingredients: StructuredIngredient[],
  query: string,
): StructuredIngredient[] {
  const needle = query.trim().toLowerCase();
  // Only ingredients with an id can be bound; the rest cannot be offered.
  const bindable = ingredients.filter((i) => i.id);
  if (!needle) return bindable;
  return bindable.filter((i) => i.name.toLowerCase().includes(needle));
}

export function optionId(listboxId: string, index: number): string {
  return `${listboxId}-option-${index}`;
}

/**
 * The picker's keyboard contract, kept here beside the listbox it drives even
 * though the events land on the textarea (see the note above on focus).
 *
 * Returns true when the key was consumed, so the caller knows to prevent the
 * default — Tab and Enter in particular mean something else entirely when the
 * picker is closed.
 */
export function handlePickerKey(
  key: string,
  optionCount: number,
  activeIndex: number,
  actions: {
    onActiveIndexChange: (index: number) => void;
    onAccept: (index: number) => void;
    onDismiss: () => void;
  },
): boolean {
  switch (key) {
    case "ArrowDown":
      // Wrap, so holding ↓ cycles rather than parking on the last option.
      actions.onActiveIndexChange(optionCount === 0 ? 0 : (activeIndex + 1) % optionCount);
      return true;
    case "ArrowUp":
      actions.onActiveIndexChange(
        optionCount === 0 ? 0 : (activeIndex - 1 + optionCount) % optionCount,
      );
      return true;
    case "Enter":
    case "Tab":
      if (optionCount === 0) return false;
      actions.onAccept(activeIndex);
      return true;
    case "Escape":
      actions.onDismiss();
      return true;
    default:
      return false;
  }
}

export function MentionPicker({
  ingredients,
  query,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  baseServings,
  desiredServings,
  id,
}: MentionPickerProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const options = useMemo(() => filterIngredients(ingredients, query), [ingredients, query]);

  // Keep the highlighted option in view as ↑/↓ walk past the visible window.
  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (options.length === 0) {
    return (
      <div
        className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow-lg"
        data-testid="mention-picker-empty"
      >
        Ingen ingredienser passer «{query}»
      </div>
    );
  }

  return (
    <ul
      ref={listRef}
      id={id}
      role="listbox"
      aria-label="Ingredienser"
      data-testid="mention-picker"
      className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
    >
      {options.map((ingredient, index) => {
        const active = index === activeIndex;
        const { qtyUnit, name } = formatIngredientParts(ingredient, baseServings, desiredServings);
        return (
          <li
            key={ingredient.id}
            id={optionId(id, index)}
            role="option"
            aria-selected={active}
            data-active={active}
            // The textarea keeps focus, so a click must not steal it away.
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => onActiveIndexChange(index)}
            onClick={() => onSelect(ingredient)}
            className={`flex cursor-pointer items-baseline gap-1.5 px-3 py-1.5 text-sm ${
              active ? "bg-blue-50 text-blue-900" : "text-gray-700"
            }`}
          >
            {qtyUnit && <span className="shrink-0 font-semibold">{qtyUnit}</span>}
            <span>{name}</span>
          </li>
        );
      })}
    </ul>
  );
}
