namespace RecipeApi.Features.Recipes;

/// <summary>
/// Stand-in used when no Jev API key is configured. Extraction still succeeds; the user
/// simply picks categories by hand, exactly as before the classifier existed.
/// </summary>
public class DisabledJevClassifier : IJevClassifier
{
    private readonly ILogger<DisabledJevClassifier> _logger;

    public DisabledJevClassifier(ILogger<DisabledJevClassifier> logger)
    {
        _logger = logger;
    }

    /// <summary>Always false, so callers keep the text model's own classification.</summary>
    public bool IsEnabled => false;

    public Task<IReadOnlyList<int>> SuggestCategoryIdsAsync(
        string recipeText,
        IReadOnlyList<CategoryOption> categories,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Jev category classification is disabled in this environment.");
        return Task.FromResult<IReadOnlyList<int>>(Array.Empty<int>());
    }
}
