namespace RecipeApi.Features.Matkasse;

public class DisabledMatkasseImageProcessor : IMatkasseImageProcessor
{
    public Task<MatkasseExtractionResult> ExtractOppskrifterAsync(
        IReadOnlyList<IFormFile> imageFiles,
        string leverandor,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(MatkasseExtractionResult.Failure("AI-bildekstraksjon er ikke konfigurert i dette miljøet"));
}
