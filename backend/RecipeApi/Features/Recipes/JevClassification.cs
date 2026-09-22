namespace RecipeApi.Features.Recipes;

/// <summary>
/// A category the classifier may suggest. Mirrors the shape the recipe controller
/// already builds for the extraction prompt: a database row, not a fixed enum.
/// </summary>
/// <param name="Id">Database id. Round-trips through the Jev criteria key.</param>
/// <param name="Name">Display name, sent to the model as the criterion description.</param>
/// <param name="Group">Category group, e.g. "Måltidstype" or "Vanskelighetsgrad".</param>
public sealed record CategoryOption(int Id, string Name, string Group);

/// <summary>
/// Suggests recipe categories using TypeSafe AI's Jev model.
/// </summary>
/// <remarks>
/// Jev only answers closed questions (Choice, Score, Noul), so it classifies but never
/// extracts: title, ingredients and instructions stay with the text model. Difficulty is
/// not special-cased here because it is not a field on <see cref="Recipe"/> -- it is the
/// "Vanskelighetsgrad" category group, and so travels the same path as any other group.
/// </remarks>
public interface IJevClassifier
{
    /// <summary>
    /// Returns the ids of categories that fit <paramref name="recipeText"/>, at most one
    /// per category group, excluding any whose confidence falls below the configured
    /// threshold.
    /// </summary>
    /// <remarks>
    /// Classification is a convenience on top of extraction, so this never throws for a
    /// transport or model failure: it returns an empty list and logs. A recipe must still
    /// be savable when Jev is unreachable.
    /// </remarks>
    Task<IReadOnlyList<int>> SuggestCategoryIdsAsync(
        string recipeText,
        IReadOnlyList<CategoryOption> categories,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Configuration for <see cref="IJevClassifier"/>, bound from the "Jev" section.
/// </summary>
public sealed class JevOptions
{
    public const string SectionName = "Jev";

    /// <summary>API key. When absent, <see cref="DisabledJevClassifier"/> is registered.</summary>
    public string? ApiKey { get; set; }

    public string Endpoint { get; set; } = "https://api.typesafe.ai/v1/systemone";

    public string ModelName { get; set; } = "jev-latest";

    /// <summary>
    /// Suggestions below this confidence are discarded. Pre-ticking a wrong category is
    /// more annoying to undo than ticking a missing one, so the default leans cautious.
    /// </summary>
    public double ConfidenceThreshold { get; set; } = 0.6;

    public int TimeoutSeconds { get; set; } = 10;
}
