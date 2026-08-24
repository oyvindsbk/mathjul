namespace RecipeApi.Features.Recipes;

/// <summary>
/// Assigns the stable ids that instruction-step mentions bind to.
///
/// Ids are minted server-side so a client can never introduce a collision, but ids
/// arriving from a client are kept verbatim — that is how an edit round-trip keeps
/// existing mentions bound to their ingredients.
///
/// Recipes written before mentions existed have no ids at all, so both the write
/// and the read paths run this; the read path persists only when it actually
/// changed something.
/// </summary>
public static class RecipeIngredientIds
{
    /// <summary>
    /// Gives every ingredient on <paramref name="recipe"/> — flat and sectioned —
    /// an id if it lacks one. Returns whether anything changed, so callers on the
    /// read path can skip a pointless SaveChanges.
    /// </summary>
    public static bool EnsureIds(Recipe recipe)
    {
        var changed = EnsureIds(recipe.Ingredients);

        foreach (var section in recipe.IngredientSections)
        {
            // Not `changed ||= ...` — that short-circuits and would leave later
            // sections unprocessed once one has already been marked changed.
            if (EnsureIds(section.Ingredients))
                changed = true;
        }

        return changed;
    }

    private static bool EnsureIds(List<StructuredIngredient> ingredients)
    {
        var changed = false;

        foreach (var ingredient in ingredients)
        {
            if (string.IsNullOrWhiteSpace(ingredient.Id))
            {
                ingredient.Id = NewId();
                changed = true;
            }
        }

        return changed;
    }

    /// <summary>Compact GUID — no braces or dashes, so it stays short inside the JSON column.</summary>
    public static string NewId() => Guid.NewGuid().ToString("N");
}
