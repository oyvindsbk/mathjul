using Microsoft.AspNetCore.Mvc;
using RecipeApi.Features.Recipes;
using Xunit;
using Microsoft.Extensions.Logging.Abstractions;

namespace RecipeApi.Tests.Recipes;

/// <summary>
/// Covers the ingredient-id and step-mention round-trip.
///
/// The failure mode this guards against is silent: a mapping site that forgets
/// Id or Mentions drops the data on save or read without raising anything, and
/// the step simply stops scaling. Every mapping site therefore gets a test that
/// asserts on the field, not just on the request succeeding.
/// </summary>
public class RecipeMentionTests
{
    private const string LokId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    private static RecipeDetailDto UnwrapDetail(ActionResult<RecipeDetailDto> result) =>
        result.Value
        ?? Assert.IsType<RecipeDetailDto>(Assert.IsType<OkObjectResult>(result.Result).Value);

    private static ShareStatusDto UnwrapShare(ActionResult<ShareStatusDto> result) =>
        result.Value
        ?? Assert.IsType<ShareStatusDto>(Assert.IsType<OkObjectResult>(result.Result).Value);

    private static Recipe SeedRecipe(RecipeTestContext ctx)
    {
        var recipe = new Recipe
        {
            Title = "Løksuppe",
            OwnerEmail = RecipeTestContext.OwnerEmail,
            Visibility = "Public",
            Servings = 2
        };

        ctx.Db.Recipes.Add(recipe);
        ctx.Db.SaveChanges();
        return recipe;
    }

    /// <summary>
    /// A recipe as it looked before this feature: ingredients with no ids and steps
    /// with no mentions, exactly as an existing JSON column deserializes.
    /// </summary>
    private static Recipe SeedLegacyRecipe(RecipeTestContext ctx)
    {
        var recipe = new Recipe
        {
            Title = "Gammel oppskrift",
            OwnerEmail = RecipeTestContext.OwnerEmail,
            Visibility = "Public",
            Servings = 2,
            Ingredients =
            [
                new StructuredIngredient { Quantity = 1, Unit = "stk", Name = "løk" }
            ],
            IngredientSections =
            [
                new IngredientSection
                {
                    Heading = "Saus",
                    Ingredients =
                    [
                        new StructuredIngredient { Quantity = 2, Unit = "dl", Name = "fløte" }
                    ]
                }
            ],
            InstructionSteps = [new InstructionStep { Text = "Fres løken." }]
        };

        ctx.Db.Recipes.Add(recipe);
        ctx.Db.SaveChanges();
        return recipe;
    }

    /// <summary>
    /// A full update request. Callers override the ingredient and step collections;
    /// everything else is the minimum UpdateRecipe needs to not reject the payload.
    /// </summary>
    private static UpdateRecipeRequest UpdateRequest(
        List<StructuredIngredientDto>? ingredients = null,
        List<InstructionStepDto>? steps = null,
        List<IngredientSectionDto>? ingredientSections = null,
        List<InstructionSectionDto>? instructionSections = null) => new()
    {
        Title = "Løksuppe",
        Description = "",
        Servings = 2,
        Ingredients = ingredients,
        InstructionSteps = steps,
        IngredientSections = ingredientSections,
        InstructionSections = instructionSections
    };

    private static List<InstructionStepDto> StepMentioningLok() =>
    [
        new InstructionStepDto
        {
            Text = "Fres @[0] til den er blank.",
            Mentions =
            [
                new IngredientMentionDto
                {
                    IngredientId = LokId,
                    FallbackName = "løk",
                    Display = "full"
                }
            ]
        }
    ];

    // ── Round-trip through PUT/GET ──────────────────────────────────────────

    [Fact]
    public async Task PutThenGet_ReturnsTheMentionIntact()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx);
        var controller = ctx.CreateController();

        await controller.UpdateRecipe(recipe.Id, UpdateRequest(
            ingredients: [new StructuredIngredientDto { Id = LokId, Quantity = 1, Unit = "stk", Name = "løk" }],
            steps: StepMentioningLok()));

        var detail = UnwrapDetail(await ctx.CreateController().GetRecipeById(recipe.Id));

        var step = Assert.Single(detail.InstructionSteps);
        Assert.Equal("Fres @[0] til den er blank.", step.Text);
        var mention = Assert.Single(step.Mentions);
        Assert.Equal(LokId, mention.IngredientId);
        Assert.Equal("løk", mention.FallbackName);
        Assert.Equal("full", mention.Display);
    }

    /// <summary>
    /// The PUT response is what the form re-renders from, so a mention dropped only
    /// there would look like the save had silently failed.
    /// </summary>
    [Fact]
    public async Task PutResponse_CarriesTheMention()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx);

        var result = await ctx.CreateController().UpdateRecipe(recipe.Id, UpdateRequest(
            ingredients: [new StructuredIngredientDto { Id = LokId, Quantity = 1, Unit = "stk", Name = "løk" }],
            steps: StepMentioningLok()));

        var detail = UnwrapDetail(result);
        var mention = Assert.Single(Assert.Single(detail.InstructionSteps).Mentions);
        Assert.Equal(LokId, mention.IngredientId);
    }

    /// <summary>Sectioned steps go through their own mapping site.</summary>
    [Fact]
    public async Task PutThenGet_ReturnsMentionsInsideInstructionSections()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx);

        await ctx.CreateController().UpdateRecipe(recipe.Id, UpdateRequest(
            ingredientSections:
            [
                new IngredientSectionDto
                {
                    Heading = "Suppen",
                    Ingredients = [new StructuredIngredientDto { Id = LokId, Quantity = 1, Unit = "stk", Name = "løk" }]
                }
            ],
            instructionSections:
            [
                new InstructionSectionDto { Heading = "Slik gjør du", Steps = StepMentioningLok() }
            ]));

        var detail = UnwrapDetail(await ctx.CreateController().GetRecipeById(recipe.Id));

        var section = Assert.Single(detail.InstructionSections);
        var mention = Assert.Single(Assert.Single(section.Steps).Mentions);
        Assert.Equal(LokId, mention.IngredientId);

        var sectionIngredient = Assert.Single(Assert.Single(detail.IngredientSections).Ingredients);
        Assert.Equal(LokId, sectionIngredient.Id);
    }

    // ── Id assignment ───────────────────────────────────────────────────────

    [Fact]
    public async Task Put_AssignsIdsToIngredientsArrivingWithoutOne()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx);

        var result = await ctx.CreateController().UpdateRecipe(recipe.Id, UpdateRequest(
            ingredients: [new StructuredIngredientDto { Quantity = 1, Unit = "stk", Name = "løk" }],
            ingredientSections:
            [
                new IngredientSectionDto
                {
                    Heading = "Saus",
                    Ingredients = [new StructuredIngredientDto { Quantity = 2, Unit = "dl", Name = "fløte" }]
                }
            ]));

        var detail = UnwrapDetail(result);
        Assert.False(string.IsNullOrWhiteSpace(Assert.Single(detail.Ingredients).Id));
        var sectionIngredient = Assert.Single(Assert.Single(detail.IngredientSections).Ingredients);
        Assert.False(string.IsNullOrWhiteSpace(sectionIngredient.Id));
    }

    /// <summary>
    /// Preserving client-supplied ids verbatim is the whole binding mechanism: a
    /// server that re-minted them on every save would break every mention on the
    /// first edit after it was authored.
    /// </summary>
    [Fact]
    public async Task Put_PreservesClientSuppliedIdsVerbatim()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx);
        var controller = ctx.CreateController();

        var afterFirst = UnwrapDetail(await controller.UpdateRecipe(recipe.Id, UpdateRequest(
            ingredients: [new StructuredIngredientDto { Quantity = 1, Unit = "stk", Name = "løk" }])));
        var assignedId = Assert.Single(afterFirst.Ingredients).Id;

        // The form sends the id back untouched, and renames the ingredient — the
        // mention has to survive the rename because it binds by id, not by name.
        var afterSecond = UnwrapDetail(await ctx.CreateController().UpdateRecipe(recipe.Id, UpdateRequest(
            ingredients: [new StructuredIngredientDto { Id = assignedId, Quantity = 1, Unit = "stk", Name = "rødløk" }],
            steps:
            [
                new InstructionStepDto
                {
                    Text = "Fres @[0].",
                    Mentions = [new IngredientMentionDto { IngredientId = assignedId!, FallbackName = "løk" }]
                }
            ])));

        var ingredient = Assert.Single(afterSecond.Ingredients);
        Assert.Equal(assignedId, ingredient.Id);
        Assert.Equal("rødløk", ingredient.Name);
        Assert.Equal(assignedId, Assert.Single(Assert.Single(afterSecond.InstructionSteps).Mentions).IngredientId);
    }

    [Fact]
    public async Task Get_BackfillsAndPersistsIdsOnALegacyRecipe()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedLegacyRecipe(ctx);

        var detail = UnwrapDetail(await ctx.CreateController().GetRecipeById(recipe.Id));

        var flatId = Assert.Single(detail.Ingredients).Id;
        var sectionId = Assert.Single(Assert.Single(detail.IngredientSections).Ingredients).Id;
        Assert.False(string.IsNullOrWhiteSpace(flatId));
        Assert.False(string.IsNullOrWhiteSpace(sectionId));
        Assert.NotEqual(flatId, sectionId);

        // Persisted, not just mapped: the edit form must see the same identities.
        var persisted = ctx.Db.Recipes.Single(r => r.Id == recipe.Id);
        Assert.Equal(flatId, persisted.Ingredients[0].Id);
        Assert.Equal(sectionId, persisted.IngredientSections[0].Ingredients[0].Id);
    }

    /// <summary>Ids are stable across reads — a re-mint on every GET would unbind mentions.</summary>
    [Fact]
    public async Task Get_ReturnsTheSameIdsOnASecondRead()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedLegacyRecipe(ctx);

        var first = UnwrapDetail(await ctx.CreateController().GetRecipeById(recipe.Id));
        var second = UnwrapDetail(await ctx.CreateController().GetRecipeById(recipe.Id));

        Assert.Equal(Assert.Single(first.Ingredients).Id, Assert.Single(second.Ingredients).Id);
    }

    /// <summary>A legacy step deserializes with no mentions, not with a null list.</summary>
    [Fact]
    public async Task Get_ReturnsAnEmptyMentionListForALegacyStep()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedLegacyRecipe(ctx);

        var detail = UnwrapDetail(await ctx.CreateController().GetRecipeById(recipe.Id));

        Assert.Empty(Assert.Single(detail.InstructionSteps).Mentions);
    }

    // ── Share payload ───────────────────────────────────────────────────────

    /// <summary>
    /// PublicRecipesController builds its own SharedRecipeDto rather than reusing
    /// RecipeDetailDto, so this mapping site can rot on its own — mentions would
    /// break on shared links only, which is the hardest place to notice.
    /// </summary>
    [Fact]
    public async Task SharedRecipe_CarriesMentionsAndIngredientIds()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx);
        var controller = ctx.CreateController();

        await controller.UpdateRecipe(recipe.Id, UpdateRequest(
            ingredients: [new StructuredIngredientDto { Id = LokId, Quantity = 1, Unit = "stk", Name = "løk" }],
            steps: StepMentioningLok()));

        var share = UnwrapShare(await ctx.CreateController().CreateShare(recipe.Id));
        var result = await new PublicRecipesController(ctx.Db, NullLogger<PublicRecipesController>.Instance).GetSharedRecipe(share.Token!);

        var dto = Assert.IsType<SharedRecipeDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(LokId, Assert.Single(dto.Ingredients).Id);
        var mention = Assert.Single(Assert.Single(dto.InstructionSteps).Mentions);
        Assert.Equal(LokId, mention.IngredientId);
        Assert.Equal("løk", mention.FallbackName);
    }

    [Fact]
    public async Task SharedLegacyRecipe_GetsIdsBackfilledAndPersisted()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedLegacyRecipe(ctx);
        var share = UnwrapShare(await ctx.CreateController().CreateShare(recipe.Id));

        var result = await new PublicRecipesController(ctx.Db, NullLogger<PublicRecipesController>.Instance).GetSharedRecipe(share.Token!);

        var dto = Assert.IsType<SharedRecipeDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        var flatId = Assert.Single(dto.Ingredients).Id;
        Assert.False(string.IsNullOrWhiteSpace(flatId));
        Assert.False(string.IsNullOrWhiteSpace(
            Assert.Single(Assert.Single(dto.IngredientSections).Ingredients).Id));

        Assert.Equal(flatId, ctx.Db.Recipes.Single(r => r.Id == recipe.Id).Ingredients[0].Id);
    }

    // ── Helper ──────────────────────────────────────────────────────────────

    /// <summary>
    /// A mention arriving without a display mode falls back to "full" rather than to
    /// an empty string the renderer would have to defend against.
    /// </summary>
    [Fact]
    public void ToDomain_DefaultsAnEmptyDisplayToFull()
    {
        var mention = new IngredientMentionDto { IngredientId = LokId, Display = "" }.ToDomain();

        Assert.Equal("full", mention.Display);
    }

    [Fact]
    public void EnsureIds_ReturnsFalseWhenEveryIngredientAlreadyHasOne()
    {
        var recipe = new Recipe
        {
            Ingredients = [new StructuredIngredient { Id = LokId, Name = "løk" }],
            IngredientSections =
            [
                new IngredientSection
                {
                    Heading = "Saus",
                    Ingredients = [new StructuredIngredient { Id = "b", Name = "fløte" }]
                }
            ]
        };

        Assert.False(RecipeIngredientIds.EnsureIds(recipe));
    }

    /// <summary>
    /// EnsureIds must not short-circuit: a change in the flat list cannot stop it
    /// from walking the sections, or a sectioned ingredient stays id-less forever.
    /// </summary>
    [Fact]
    public void EnsureIds_FillsSectionsEvenWhenTheFlatListAlreadyChanged()
    {
        var recipe = new Recipe
        {
            Ingredients = [new StructuredIngredient { Name = "løk" }],
            IngredientSections =
            [
                new IngredientSection { Heading = "A", Ingredients = [new StructuredIngredient { Name = "fløte" }] },
                new IngredientSection { Heading = "B", Ingredients = [new StructuredIngredient { Name = "smør" }] }
            ]
        };

        Assert.True(RecipeIngredientIds.EnsureIds(recipe));
        Assert.All(recipe.IngredientSections.SelectMany(s => s.Ingredients),
            i => Assert.False(string.IsNullOrWhiteSpace(i.Id)));
    }
}
