using Microsoft.Extensions.Logging;

namespace RecipeApi.Features.Recipes;

public class DisabledRecipeImageProcessor : IRecipeImageProcessor
{
    private readonly ILogger<DisabledRecipeImageProcessor> _logger;

    public DisabledRecipeImageProcessor(ILogger<DisabledRecipeImageProcessor> logger)
    {
        _logger = logger;
    }

    public Task<RecipeExtractionResult> ExtractRecipeFromImageAsync(IFormFile imageFile, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Recipe image processing is disabled in this environment.");
        return Task.FromResult(RecipeExtractionResult.Failure("Recipe image processing is disabled in this environment."));
    }
}
