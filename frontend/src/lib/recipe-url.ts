/**
 * Builds readable recipe URLs, e.g. `/recipes/7790-lasagne-med-sopp`.
 * The numeric id is always the source of truth for lookups — the slug is a
 * cosmetic suffix and is never validated, so a stale slug after a rename
 * still resolves correctly, and `/recipes/{id}` alone keeps working.
 */

const TRANSLITERATIONS: Record<string, string> = {
  æ: 'ae',
  ø: 'o',
  å: 'a',
  ä: 'a',
  ö: 'o',
  ü: 'u',
  é: 'e',
  è: 'e',
  ê: 'e',
};

export function slugify(title: string): string {
  const transliterated = title
    .toLowerCase()
    .split('')
    .map((char) => TRANSLITERATIONS[char] ?? char)
    .join('');

  return transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Builds the recipe detail URL, falling back to the bare id if the title yields no usable slug. */
export function recipeHref(id: number, title: string): string {
  const slug = slugify(title);
  return slug ? `/recipes/${id}-${slug}` : `/recipes/${id}`;
}

/** Extracts the leading numeric id from a recipe route param (e.g. "7790-lasagne-med-sopp" -> "7790"). */
export function parseRecipeId(param: string): string | null {
  const match = param.match(/^\d+/);
  return match ? match[0] : null;
}
