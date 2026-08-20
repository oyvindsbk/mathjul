namespace RecipeApi.Features.Recipes;

/// <summary>
/// Conversions between the mention-carrying domain types and their DTOs.
///
/// These live in one place because the shapes are mapped at seven sites across
/// two controllers, and a site that forgets a field drops the data silently on a
/// round-trip rather than failing loudly.
/// </summary>
public static class RecipeMentionMapping
{
    public static StructuredIngredientDto ToDto(this StructuredIngredient ingredient) => new()
    {
        Id = ingredient.Id,
        Quantity = ingredient.Quantity,
        Unit = ingredient.Unit,
        Name = ingredient.Name
    };

    public static InstructionStepDto ToDto(this InstructionStep step) => new()
    {
        Text = step.Text,
        ImageUrl = step.ImageUrl,
        Mentions = step.Mentions.Select(m => m.ToDto()).ToList()
    };

    public static IngredientMentionDto ToDto(this IngredientMention mention) => new()
    {
        IngredientId = mention.IngredientId,
        FallbackName = mention.FallbackName,
        Display = mention.Display
    };

    /// <summary>
    /// Ids arriving from the client are kept verbatim — that is what keeps an edited
    /// recipe's mentions bound. Ingredients added in the form arrive without one and
    /// get theirs from <see cref="RecipeIngredientIds.EnsureIds(Recipe)"/> afterwards.
    /// </summary>
    public static StructuredIngredient ToDomain(this StructuredIngredientDto dto) => new()
    {
        Id = dto.Id,
        Quantity = dto.Quantity,
        Unit = dto.Unit,
        Name = dto.Name
    };

    public static InstructionStep ToDomain(this InstructionStepDto dto) => new()
    {
        Text = dto.Text,
        ImageUrl = dto.ImageUrl,
        Mentions = (dto.Mentions ?? new List<IngredientMentionDto>())
            .Select(m => m.ToDomain())
            .ToList()
    };

    public static IngredientMention ToDomain(this IngredientMentionDto dto) => new()
    {
        IngredientId = dto.IngredientId,
        FallbackName = dto.FallbackName,
        Display = string.IsNullOrWhiteSpace(dto.Display) ? "full" : dto.Display
    };
}
