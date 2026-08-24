/**
 * Resolving @-mentions inside instruction steps.
 *
 * A step's text carries opaque tokens `@[0]`, `@[1]`, … indexing into the step's
 * `mentions` array. This module is the single place those tokens are turned into
 * renderable segments, so the detail page, matlagingsmodus and the share page
 * cannot drift apart.
 *
 * Nothing here throws: a malformed or out-of-range token renders literally, and
 * a mention whose ingredient no longer exists falls back to its authored name.
 */

import type { InstructionStep, Recipe, StructuredIngredient } from "@/lib/mock-data";
import { formatIngredientParts } from "@/lib/recipe-format";

export type InstructionSegment =
  | { kind: "text"; text: string }
  /** `resolved` is false when the ingredient is gone and the fallback name was used. */
  | { kind: "mention"; text: string; resolved: boolean };

/** Matches a mention token and captures its index. */
const TOKEN_PATTERN = /@\[(\d+)\]/g;

/**
 * Index every ingredient of a recipe by its id, across both the flat list and
 * any sections. Ingredients without an id are skipped — they cannot be bound.
 */
export function indexIngredients(
  recipe: Pick<Recipe, "ingredients" | "ingredientSections"> | null | undefined
): Map<string, StructuredIngredient> {
  const index = new Map<string, StructuredIngredient>();
  if (!recipe) return index;

  const add = (ingredient: StructuredIngredient) => {
    if (ingredient?.id) index.set(ingredient.id, ingredient);
  };

  recipe.ingredients?.forEach(add);
  recipe.ingredientSections?.forEach((section) => section.ingredients?.forEach(add));

  return index;
}

/** Render one mention, scaling the amount exactly as the ingredient list does. */
function mentionText(
  ingredient: StructuredIngredient,
  display: string,
  baseServings: number | null | undefined,
  desiredServings: number
): string {
  const { qtyUnit, name } = formatIngredientParts(ingredient, baseServings, desiredServings);
  if (display === "name") return name;
  return [qtyUnit, name].filter(Boolean).join(" ");
}

/**
 * Split a step's text into plain-text and mention segments.
 *
 * Tokens pointing past the end of the step's `mentions` array are left in the
 * text verbatim rather than dropped, so an authoring bug stays visible instead
 * of silently eating a word.
 */
export function resolveStepSegments(
  step: InstructionStep | null | undefined,
  ingredientsById: Map<string, StructuredIngredient>,
  baseServings: number | null | undefined,
  desiredServings: number
): InstructionSegment[] {
  const text = step?.text ?? "";
  const mentions = step?.mentions ?? [];
  const segments: InstructionSegment[] = [];

  let cursor = 0;
  TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_PATTERN.exec(text)) !== null) {
    const mention = mentions[Number(match[1])];
    if (!mention) continue; // Out of range: leave the token in the surrounding text.

    if (match.index > cursor) {
      segments.push({ kind: "text", text: text.slice(cursor, match.index) });
    }

    const ingredient = mention.ingredientId ? ingredientsById.get(mention.ingredientId) : undefined;
    segments.push(
      ingredient
        ? {
            kind: "mention",
            text: mentionText(ingredient, mention.display, baseServings, desiredServings),
            resolved: true,
          }
        : { kind: "mention", text: mention.fallbackName ?? "", resolved: false }
    );

    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    segments.push({ kind: "text", text: text.slice(cursor) });
  }

  return segments;
}

/** The step's text with every mention resolved — for `aria-label`s and plain-text use. */
export function stepPlainText(
  step: InstructionStep | null | undefined,
  ingredientsById: Map<string, StructuredIngredient>,
  baseServings: number | null | undefined,
  desiredServings: number
): string {
  return resolveStepSegments(step, ingredientsById, baseServings, desiredServings)
    .map((segment) => segment.text)
    .join("");
}

/** An open `@` trigger: where it starts, and what has been typed after it. */
export interface MentionTrigger {
  /** Index of the `@` itself — the start of the range an insertion replaces. */
  start: number;
  /** Text between the `@` and the caret, filtering the picker. */
  query: string;
}

/**
 * Find an active `@` trigger by reading backwards from the caret.
 *
 * The trigger stays open while the author types a multi-word ingredient name, so
 * a space does not close it — only a newline does, plus the query-length cap
 * below. Without some bound, an `@` typed early in a long paragraph would keep
 * the picker open for the rest of the sentence.
 */
const MAX_QUERY_LENGTH = 30;

export function findMentionTrigger(text: string, caret: number): MentionTrigger | null {
  const start = text.lastIndexOf("@", caret - 1);
  if (start < 0) return null;

  // Only a standalone `@` opens the picker — an email address should not.
  const before = start > 0 ? text[start - 1] : " ";
  if (!/\s/.test(before)) return null;

  const query = text.slice(start + 1, caret);
  if (query.length > MAX_QUERY_LENGTH) return null;
  if (query.includes("\n")) return null;
  // `@[` is a storage token the author is editing over, not a new trigger.
  if (query.startsWith("[")) return null;

  return { start, query };
}
