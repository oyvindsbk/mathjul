namespace RecipeApi.Features.Recipes;

public class DisabledRecipeUrlProcessor : IRecipeUrlProcessor
{
    private readonly ILogger<DisabledRecipeUrlProcessor> _logger;

    public DisabledRecipeUrlProcessor(ILogger<DisabledRecipeUrlProcessor> logger)
    {
        _logger = logger;
    }

    public Task<RecipeExtractionResult> ExtractRecipeFromUrlAsync(string url, string? categoryListJson = null, Func<string, Task>? reportStage = null, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Recipe URL processing is disabled in this environment.");
        return Task.FromResult(RecipeExtractionResult.Failure("Recipe URL processing is disabled in this environment."));
    }
}
