namespace RecipeApi.Features.Recipes;

/// <summary>
/// How an attached side dish is presented on the main dish.
///
/// Stored as a string rather than an enum int, matching <see cref="Recipe.Visibility"/>
/// in the same model: readable straight out of the database and out of the JSON, with no
/// number that silently means something.
/// </summary>
public static class SideDishDisplayModes
{
    /// <summary>Shown as a chip linking to the side dish's own recipe. The default.</summary>
    public const string Link = "Link";

    /// <summary>
    /// Merged into the main dish as its own ingredient and instruction sections,
    /// with the side dish's title as the section heading.
    /// </summary>
    public const string Inline = "Inline";

    /// <summary>Normalises an incoming value, falling back to <see cref="Link"/>.</summary>
    public static string Normalize(string? value) =>
        value == Inline ? Inline : Link;
}
