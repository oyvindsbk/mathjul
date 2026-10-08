namespace RecipeApi.Features.Recipes;

/// <summary>
/// Well-known seeded category values. Ids match the HasData seed in RecipeDbContext.
/// </summary>
public static class RecipeCategories
{
    /// <summary>Category group for meal types (Frokost, Middag, Tilbehør, ...).</summary>
    public const string MealTypeGroup = "Måltidstype";

    /// <summary>
    /// "Tilbehør" — marks a recipe as attachable as a side dish to other recipes.
    /// Referenced by id rather than name: the name is non-ASCII and its matching would
    /// depend on database collation, while the seeded id is stable across environments.
    /// </summary>
    public const int TilbehorId = 16;

    /// <summary>Display name of the Tilbehør category.</summary>
    public const string TilbehorName = "Tilbehør";

    /// <summary>
    /// What Tilbehør means, for classifiers. The bare name loses to "Middag" for sauces, since a
    /// sauce is eaten at dinner: Jev picked Middag for béarnaise at 0.67, and Tilbehør at 0.97
    /// with this description, while a real main course (taco) stayed Middag.
    /// </summary>
    public const string TilbehorClassifierDescription =
        "Tilbehør: saus, dressing, salat, potet, ris eller annet som serveres til en hovedrett og ikke er et helt måltid alene";

    /// <summary>
    /// "Kake" — groups recipes that scale by pan size rather than portion count.
    /// Referenced by id for the same reason as <see cref="TilbehorId"/>.
    /// </summary>
    public const int KakeId = 17;

    /// <summary>Display name of the Kake category.</summary>
    public const string KakeName = "Kake";
}
