namespace RecipeApi.Features.Recipes;

/// <summary>
/// Builds the ingredient and instruction section lists a main dish is displayed with, once
/// its Inline side dishes have been merged in.
///
/// Lives here, on the server, because the recipe detail page, matlagingsmodus and the shared
/// link all read the same two section lists. Merging before the data leaves the API gives all
/// three surfaces the feature at once, and keeps them from drifting apart later.
///
/// The merge is presentation only: the side dish's own recipe stays the single source, so an
/// edit there shows up here immediately. Nothing is copied into the main dish.
/// </summary>
internal static class InlineSideDishMerger
{
    /// <summary>
    /// Returns the merged ingredient sections for <paramref name="recipe"/>, or the recipe's
    /// own sections unchanged when nothing is merged in.
    /// </summary>
    public static List<IngredientSectionDto> BuildIngredientSections(Recipe recipe)
    {
        var inlineSideDishes = InlineSideDishesOf(recipe);
        var ownSections = MapIngredientSections(recipe.IngredientSections);

        if (inlineSideDishes.Count == 0)
            return ownSections;

        // The section lists become the only thing rendered once we merge, so a recipe that
        // keeps its content in the flat lists has to be lifted into a section of its own --
        // otherwise the main dish's own ingredients would simply vanish from the page.
        var merged = ownSections.Count > 0
            ? ownSections
            : WrapFlatIngredients(recipe);

        foreach (var sideDish in inlineSideDishes)
        {
            var sections = SideDishIngredientSections(sideDish.SideDishRecipe);
            if (sections.Count == 0)
                continue;

            merged.AddRange(sections);
        }

        return merged;
    }

    /// <summary>
    /// Returns the merged instruction sections for <paramref name="recipe"/>, or the recipe's
    /// own sections unchanged when nothing is merged in.
    /// </summary>
    public static List<InstructionSectionDto> BuildInstructionSections(Recipe recipe)
    {
        var inlineSideDishes = InlineSideDishesOf(recipe);
        var ownSections = MapInstructionSections(recipe.InstructionSections);

        if (inlineSideDishes.Count == 0)
            return ownSections;

        var merged = ownSections.Count > 0
            ? ownSections
            : WrapFlatInstructions(recipe);

        foreach (var sideDish in inlineSideDishes)
        {
            var sections = SideDishInstructionSections(sideDish.SideDishRecipe);
            if (sections.Count == 0)
                continue;

            merged.AddRange(sections);
        }

        return merged;
    }

    /// <summary>
    /// The recipe's own ingredient sections, with nothing merged in. The edit form reads these:
    /// it writes the section lists straight back on save, so giving it the merged view would
    /// copy the tilbehør's content into the main dish for good.
    /// </summary>
    public static List<IngredientSectionDto> OwnIngredientSections(Recipe recipe) =>
        MapIngredientSections(recipe.IngredientSections);

    /// <summary>The recipe's own instruction sections. See <see cref="OwnIngredientSections"/>.</summary>
    public static List<InstructionSectionDto> OwnInstructionSections(Recipe recipe) =>
        MapInstructionSections(recipe.InstructionSections);

    /// <summary>The Inline-marked side dishes, in the order the main dish lists them.</summary>
    private static List<RecipeSideDish> InlineSideDishesOf(Recipe recipe) =>
        recipe.SideDishes
            .Where(sd => sd.DisplayMode == SideDishDisplayModes.Inline && sd.SideDishRecipe != null)
            .OrderBy(sd => sd.SortOrder)
            .ToList();

    /// <summary>
    /// The side dish contributes a single section headed by its title. A side dish that keeps
    /// its content in sections of its own is flattened into that one section, so the main dish
    /// never grows a second level of headings.
    /// </summary>
    private static List<IngredientSectionDto> SideDishIngredientSections(Recipe sideDish)
    {
        var ingredients = sideDish.IngredientSections.Count > 0
            ? sideDish.IngredientSections.SelectMany(s => s.Ingredients).ToList()
            : sideDish.Ingredients;

        // An empty tilbehør must not leave an empty heading behind.
        if (ingredients.Count == 0)
            return [];

        return
        [
            new IngredientSectionDto
            {
                Heading = sideDish.Title,
                Ingredients = ingredients.Select(MapIngredient).ToList()
            }
        ];
    }

    private static List<InstructionSectionDto> SideDishInstructionSections(Recipe sideDish)
    {
        var steps = sideDish.InstructionSections.Count > 0
            ? sideDish.InstructionSections.SelectMany(s => s.Steps).ToList()
            : sideDish.InstructionSteps;

        if (steps.Count == 0)
            return [];

        return
        [
            new InstructionSectionDto
            {
                Heading = sideDish.Title,
                Steps = steps.Select(MapStep).ToList()
            }
        ];
    }

    private static List<IngredientSectionDto> WrapFlatIngredients(Recipe recipe) =>
        recipe.Ingredients.Count == 0
            ? []
            : [new IngredientSectionDto
              {
                  Heading = recipe.Title,
                  Ingredients = recipe.Ingredients.Select(MapIngredient).ToList()
              }];

    private static List<InstructionSectionDto> WrapFlatInstructions(Recipe recipe) =>
        recipe.InstructionSteps.Count == 0
            ? []
            : [new InstructionSectionDto
              {
                  Heading = recipe.Title,
                  Steps = recipe.InstructionSteps.Select(MapStep).ToList()
              }];

    private static List<IngredientSectionDto> MapIngredientSections(List<IngredientSection> sections) =>
        sections.Select(s => new IngredientSectionDto
        {
            Heading = s.Heading,
            Ingredients = s.Ingredients.Select(MapIngredient).ToList()
        }).ToList();

    private static List<InstructionSectionDto> MapInstructionSections(List<InstructionSection> sections) =>
        sections.Select(s => new InstructionSectionDto
        {
            Heading = s.Heading,
            Steps = s.Steps.Select(MapStep).ToList()
        }).ToList();

    private static StructuredIngredientDto MapIngredient(StructuredIngredient i) =>
        new() { Quantity = i.Quantity, Unit = i.Unit, Name = i.Name };

    private static InstructionStepDto MapStep(InstructionStep s) =>
        new() { Text = s.Text, ImageUrl = s.ImageUrl };
}
