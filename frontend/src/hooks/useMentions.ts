"use client";

import { useCallback, useMemo } from "react";
import type { IngredientMention, InstructionStep, StructuredIngredient } from "@/lib/mock-data";

/**
 * Owns the invariant binding a step's text to its `mentions` array.
 *
 * The text carries opaque tokens `@[0]`, `@[1]`, … indexing into `mentions`, so
 * the two halves can never be edited independently. Every mutation here rewrites
 * both together and hands back a whole new step — the caller only ever stores
 * the result, and never reasons about token numbering itself.
 *
 * Three rules hold after any operation:
 *
 *  1. Tokens are renumbered densely from 0, in the order they appear in the text.
 *  2. `mentions[i]` is the mention for the token `@[i]` — the array is reordered
 *     to match the text, not the other way round.
 *  3. A token with no matching mention is dropped from the text (an orphan), and
 *     a mention no token points at is dropped from the array (unreferenced).
 *
 * Rule 3 is what makes free-text editing safe: the author can delete a token by
 * hand mid-sentence and the array follows on the next mutation.
 */

const TOKEN_PATTERN = /@\[(\d+)\]/g;

/** Where a mention sits in a step, for the chip row and the removal warning. */
export interface MentionSlot {
  /** The token index — its position in both the text and the array. */
  index: number;
  mention: IngredientMention;
}

/**
 * Rewrite text and mentions together so the three rules above hold.
 *
 * Walks the text in order; each token that resolves to a mention is renumbered
 * to its position in the walk, and every token that does not is dropped.
 */
function normalize(
  text: string,
  mentions: IngredientMention[],
): { text: string; mentions: IngredientMention[] } {
  const kept: IngredientMention[] = [];

  const nextText = text.replace(TOKEN_PATTERN, (_match, raw: string) => {
    const mention = mentions[Number(raw)];
    if (!mention) return ""; // Orphan token: drop it rather than render `@[7]` to a reader.
    kept.push(mention);
    return `@[${kept.length - 1}]`;
  });

  return { text: nextText, mentions: kept };
}

export interface UseMentionsResult {
  /** The step's mentions in token order, for rendering one chip each. */
  slots: MentionSlot[];
  /** Insert a mention for `ingredient`, replacing `[from, to)` of the text. */
  insert: (
    ingredient: StructuredIngredient,
    from: number,
    to: number,
  ) => { step: InstructionStep; caret: number } | null;
  /** Remove one mention, dropping its token and reindexing the rest. */
  remove: (index: number) => InstructionStep;
  /** Flip one mention between "full" and "name". */
  toggleDisplay: (index: number) => InstructionStep;
  /** Re-apply the invariant after a free-text edit that may have eaten a token. */
  syncText: (text: string) => InstructionStep;
}

/**
 * Mention operations for a single instruction step.
 *
 * Returns new step objects rather than mutating; the caller pushes them into
 * form state through its existing change handler.
 */
export function useMentions(step: InstructionStep): UseMentionsResult {
  const text = step.text ?? "";
  const mentions = useMemo(() => step.mentions ?? [], [step.mentions]);

  const slots = useMemo<MentionSlot[]>(
    () => mentions.map((mention, index) => ({ index, mention })),
    [mentions],
  );

  const insert = useCallback(
    (ingredient: StructuredIngredient, from: number, to: number) => {
      // An ingredient with no id cannot be bound — the mention would dangle the
      // moment it was written. The caller assigns optimistic ids to new rows.
      if (!ingredient.id) return null;

      const mention: IngredientMention = {
        ingredientId: ingredient.id,
        fallbackName: ingredient.name,
        display: "full",
      };

      // Resolve each side against the *current* array first, so both come back
      // densely numbered and self-consistent.
      const head = normalize(text.slice(0, from), mentions);
      const tail = normalize(text.slice(to), mentions);

      // The tail's tokens restart at 0, so shift them past the head and the new
      // mention before concatenating — otherwise the two sides collide.
      const offset = head.mentions.length + 1;
      const shiftedTail = tail.text.replace(
        TOKEN_PATTERN,
        (_m, raw: string) => `@[${Number(raw) + offset}]`,
      );

      const token = `@[${head.mentions.length}]`;
      const nextText = `${head.text}${token} ${shiftedTail}`;

      return {
        step: {
          ...step,
          text: nextText,
          mentions: [...head.mentions, mention, ...tail.mentions],
        },
        // After the token and the space that follows it.
        caret: head.text.length + token.length + 1,
      };
    },
    [step, text, mentions],
  );

  const remove = useCallback(
    (index: number) => {
      // Drop the token by pointing it at nothing, then let normalize collect it
      // along with any orphans the author left behind.
      const pruned = mentions.map((m, i) => (i === index ? undefined : m));
      const next = normalize(text, pruned as IngredientMention[]);
      return { ...step, text: next.text, mentions: next.mentions };
    },
    [step, text, mentions],
  );

  const toggleDisplay = useCallback(
    (index: number) => {
      const next: IngredientMention[] = mentions.map((m, i) =>
        i === index ? { ...m, display: m.display === "full" ? "name" : "full" } : m,
      );
      return { ...step, mentions: next };
    },
    [step, mentions],
  );

  const syncText = useCallback(
    (nextText: string) => {
      const next = normalize(nextText, mentions);
      return { ...step, text: next.text, mentions: next.mentions };
    },
    [step, mentions],
  );

  return { slots, insert, remove, toggleDisplay, syncText };
}
