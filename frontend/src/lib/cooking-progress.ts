/**
 * Persistence for matlagingsmodus progress (ticked ingredients and steps).
 *
 * Stored in localStorage so progress survives a refresh, a navigation, or the
 * phone locking mid-cook — the situations the in-memory state used to lose.
 *
 * Every access is wrapped in try/catch: localStorage throws in private mode and
 * when the quota is exhausted. A cooking checklist must never take down the
 * recipe page, so failures degrade to in-memory-only state.
 */

const PREFIX = "matlagingsmodus:v1:";

/** Cap on stored recipes. Oldest entries are evicted once this is exceeded. */
const MAX_ENTRIES = 30;

export interface CookingProgress {
  /** Ticked ingredients as "sectionIdx:ingredientIdx". Flat lists use section 0. */
  ingredients: string[];
  /** Ticked steps as 1-based numbers, continuous across sections. */
  steps: number[];
}

export const emptyProgress: CookingProgress = { ingredients: [], steps: [] };

/**
 * Storage key for a recipe.
 *
 * `updatedAt` is part of the key so that editing a recipe abandons old progress
 * rather than applying stale indices to reordered content — StructuredIngredient
 * has no stable id, so index keys are the only option and this is what makes
 * them safe.
 */
export function progressKey(recipeId: number | string, updatedAt?: string | null): string {
  return `${PREFIX}${recipeId}:${updatedAt ?? "0"}`;
}

/** True when neither list has anything ticked. */
export function isEmpty(p: CookingProgress): boolean {
  return p.ingredients.length === 0 && p.steps.length === 0;
}

function available(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parse(raw: string | null): CookingProgress | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CookingProgress>;
    return {
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.filter((v) => typeof v === "string") : [],
      steps: Array.isArray(parsed.steps) ? parsed.steps.filter((v) => typeof v === "number") : [],
    };
  } catch {
    // Corrupt or hand-edited entry — treat as absent rather than throwing.
    return null;
  }
}

/**
 * Read progress for a recipe.
 *
 * Falls back to progress stored under a *different* updatedAt for the same
 * recipe id when the exact key misses. Recipe pages are served
 * StaleWhileRevalidate (feature 029), so the page can first render from cache
 * with an older updatedAt and then re-render with a fresher one moments later.
 * Without this fallback that background refresh would swap in an empty key and
 * the user's checklist would appear to vanish mid-cook.
 *
 * Migrating rather than merging is deliberate: the recipe content that indices
 * point at is the same in the cached and fresh copies unless the recipe was
 * genuinely edited, and a genuine edit is far rarer than an SWR refresh.
 */
export function loadProgress(recipeId: number | string, updatedAt?: string | null): CookingProgress {
  const store = available();
  if (!store) return { ...emptyProgress };

  const key = progressKey(recipeId, updatedAt);
  try {
    const exact = parse(store.getItem(key));
    if (exact) return exact;

    const idPrefix = `${PREFIX}${recipeId}:`;
    for (let i = 0; i < store.length; i++) {
      const candidate = store.key(i);
      if (!candidate || candidate === key || !candidate.startsWith(idPrefix)) continue;

      const carried = parse(store.getItem(candidate));
      if (carried && !isEmpty(carried)) {
        // Re-home it under the current key so the next read hits directly.
        store.removeItem(candidate);
        store.setItem(key, JSON.stringify(carried));
        return carried;
      }
    }
  } catch {
    // Ignore — degrade to empty.
  }
  return { ...emptyProgress };
}

/** Persist progress, evicting the oldest entries if the cap is exceeded. */
export function saveProgress(
  recipeId: number | string,
  updatedAt: string | null | undefined,
  progress: CookingProgress
): void {
  const store = available();
  if (!store) return;

  const key = progressKey(recipeId, updatedAt);
  try {
    if (isEmpty(progress)) {
      store.removeItem(key);
      return;
    }
    store.setItem(key, JSON.stringify(progress));
    prune(store, key);
  } catch {
    // Quota exceeded or private mode — progress stays in memory for this session.
  }
}

/**
 * Drop stored progress for a recipe. Backs "Begynn på nytt".
 *
 * Takes no updatedAt: it clears every entry for the id, so a reset cannot leave
 * an older entry behind for loadProgress's migration to resurrect.
 */
export function clearProgress(recipeId: number | string): void {
  const store = available();
  if (!store) return;
  try {
    const idPrefix = `${PREFIX}${recipeId}:`;
    const doomed: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const candidate = store.key(i);
      if (candidate?.startsWith(idPrefix)) doomed.push(candidate);
    }
    doomed.forEach((k) => store.removeItem(k));
  } catch {
    // Ignore.
  }
}

/** Keep the store bounded. `keep` is never evicted. */
function prune(store: Storage, keep: string): void {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  if (keys.length <= MAX_ENTRIES) return;

  // localStorage preserves insertion order, so the front of the list is oldest.
  keys.filter((k) => k !== keep)
    .slice(0, keys.length - MAX_ENTRIES)
    .forEach((k) => {
      try {
        store.removeItem(k);
      } catch {
        // Ignore.
      }
    });
}
