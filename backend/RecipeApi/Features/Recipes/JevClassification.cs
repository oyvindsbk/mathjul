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
    /// Whether classification is actually configured.
    /// </summary>
    /// <remarks>
    /// Lets callers skip work that only pays off when Jev runs -- notably dropping the category
    /// list from the text model's prompt, which would otherwise mean paying for the same
    /// classification twice. The knowledge stays with the implementation rather than having
    /// callers re-inspect configuration.
    /// </remarks>
    bool IsEnabled { get; }

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
/// Adapts the extraction pipeline's data to what <see cref="IJevClassifier"/> needs.
/// </summary>
public static class JevClassificationInput
{
    /// <summary>Caps the text sent to Jev. Generous enough for a long recipe, bounded for cost.</summary>
    private const int MaxRecipeTextLength = 4000;

    /// <summary>
    /// Reads the category list the controller already builds for the extraction prompt.
    /// </summary>
    /// <remarks>
    /// Parsing the same JSON rather than taking a second parameter keeps the
    /// <see cref="IRecipeUrlProcessor"/> signature and its four call sites untouched. A
    /// malformed list yields no options, which degrades to no suggestions.
    /// </remarks>
    public static IReadOnlyList<CategoryOption> ParseCategoryList(string? categoryListJson)
    {
        if (string.IsNullOrWhiteSpace(categoryListJson))
        {
            return Array.Empty<CategoryOption>();
        }

        try
        {
            var rows = System.Text.Json.JsonSerializer.Deserialize<List<CategoryListRow>>(
                categoryListJson,
                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (rows is null)
            {
                return Array.Empty<CategoryOption>();
            }

            return rows
                .Where(r => r.Name is not null && r.Group is not null)
                .Select(r => new CategoryOption(r.Id, r.Name!, r.Group!))
                .ToList();
        }
        catch (System.Text.Json.JsonException)
        {
            return Array.Empty<CategoryOption>();
        }
    }

    /// <summary>
    /// Flattens an extracted recipe into the text Jev evaluates.
    /// </summary>
    /// <remarks>
    /// Ingredients and instructions carry most of the classification signal -- a cake and a stew
    /// differ in their contents far more than in their titles -- so both are included, sectioned
    /// or not, and the whole thing is truncated rather than sampled.
    /// </remarks>
    public static string BuildRecipeText(ExtractedRecipeDto recipe)
    {
        var builder = new System.Text.StringBuilder();

        builder.AppendLine(recipe.Title);

        if (!string.IsNullOrWhiteSpace(recipe.Description))
        {
            builder.AppendLine(recipe.Description);
        }

        var ingredients = recipe.Ingredients
            .Concat(recipe.IngredientSections.SelectMany(s => s.Ingredients))
            .Select(i => i.Name)
            .Where(n => !string.IsNullOrWhiteSpace(n));

        var ingredientLine = string.Join(", ", ingredients);
        if (ingredientLine.Length > 0)
        {
            builder.AppendLine();
            builder.AppendLine("Ingredienser: " + ingredientLine);
        }

        var steps = recipe.Instructions
            .Concat(recipe.InstructionSections.SelectMany(s => s.Steps))
            .Where(s => !string.IsNullOrWhiteSpace(s));

        var stepText = string.Join(" ", steps);
        if (stepText.Length > 0)
        {
            builder.AppendLine();
            builder.AppendLine("Fremgangsmåte: " + stepText);
        }

        var text = builder.ToString().Trim();

        return text.Length <= MaxRecipeTextLength
            ? text
            : text[..MaxRecipeTextLength];
    }

    /// <summary>
    /// Applies classifier suggestions to an extracted recipe.
    /// </summary>
    /// <remarks>
    /// Kept here rather than inline in the processor so the rule is reachable from tests:
    /// <see cref="RecipeUrlProcessor"/> needs live Azure configuration to construct, and the
    /// guarantee that both the JSON-LD and AI branches get classified is worth asserting.
    /// Existing suggestions survive an empty result, so an unreachable classifier does not
    /// erase what the text model already proposed.
    /// </remarks>
    public static async Task ApplySuggestionsAsync(
        ExtractedRecipeDto extractedDto,
        string? categoryListJson,
        IJevClassifier classifier,
        Func<string, Task>? reportStage = null,
        CancellationToken cancellationToken = default)
    {
        var categories = ParseCategoryList(categoryListJson);
        if (categories.Count == 0) return;

        if (reportStage != null) await reportStage("classifying");

        var recipeText = BuildRecipeText(extractedDto);
        var suggestedIds = await classifier.SuggestCategoryIdsAsync(recipeText, categories, cancellationToken);

        if (suggestedIds.Count > 0)
        {
            extractedDto.SuggestedCategoryIds = suggestedIds.ToList();
        }
    }

    /// <summary>Shape of a row in the controller's category list JSON.</summary>
    private sealed class CategoryListRow
    {
        public int Id { get; set; }
        public string? Name { get; set; }
        public string? Group { get; set; }
    }
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
