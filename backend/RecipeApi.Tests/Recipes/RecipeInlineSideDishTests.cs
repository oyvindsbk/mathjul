using Microsoft.AspNetCore.Mvc;
using RecipeApi.Features.Recipes;
using Xunit;

namespace RecipeApi.Tests.Recipes;

/// <summary>
/// Covers the Inline display mode on side dishes: the write path (which ids get persisted
/// as Inline, and the subset rule that guards them).
/// </summary>
public class RecipeInlineSideDishTests
{
    private static UpdateRecipeRequest UpdateRequest(
        string title = "Hovedrett",
        List<int>? sideDishIds = null,
        List<int>? inlineSideDishIds = null) => new()
        {
            Title = title,
            SideDishIds = sideDishIds,
            InlineSideDishIds = inlineSideDishIds
        };

    // ── Validation ─────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateRecipe_WithInlineIdNotAmongSideDishes_ReturnsBadRequest()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        var naan = ctx.SeedRecipe("Naan", isTilbehor: true);
        var controller = ctx.CreateController();

        var result = await controller.UpdateRecipe(main.Id, UpdateRequest(
            sideDishIds: [rice.Id],
            inlineSideDishIds: [naan.Id]));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Contains("innflettet", badRequest.Value!.ToString());
    }

    [Fact]
    public async Task UpdateRecipe_WithInlineIdsButNoSideDishes_ReturnsBadRequest()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        var controller = ctx.CreateController();

        // The side-dish validator short-circuits on an empty list, so the subset rule has
        // to stand on its own here.
        var result = await controller.UpdateRecipe(main.Id, UpdateRequest(
            sideDishIds: [],
            inlineSideDishIds: [rice.Id]));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ── Persistence ────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateRecipe_WithoutInlineIds_PersistsEveryLinkAsLink()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        var controller = ctx.CreateController();

        // A client that predates the field must keep the old behaviour exactly.
        var result = await controller.UpdateRecipe(main.Id, UpdateRequest(sideDishIds: [rice.Id]));

        Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(SideDishDisplayModes.Link, Assert.Single(ctx.GetSideDishLinks(main.Id)).DisplayMode);
    }

    [Fact]
    public async Task UpdateRecipe_WithInlineSubset_PersistsPerLinkDisplayMode()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        var naan = ctx.SeedRecipe("Naan", isTilbehor: true);
        var controller = ctx.CreateController();

        var result = await controller.UpdateRecipe(main.Id, UpdateRequest(
            sideDishIds: [rice.Id, naan.Id],
            inlineSideDishIds: [rice.Id]));

        Assert.IsType<OkObjectResult>(result.Result);

        var links = ctx.GetSideDishLinks(main.Id);
        Assert.Equal(SideDishDisplayModes.Inline, links.Single(l => l.SideDishRecipeId == rice.Id).DisplayMode);
        Assert.Equal(SideDishDisplayModes.Link, links.Single(l => l.SideDishRecipeId == naan.Id).DisplayMode);
    }

    [Fact]
    public async Task UpdateRecipe_DroppingInlineId_RevertsLinkToLinkMode()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        var controller = ctx.CreateController();

        await controller.UpdateRecipe(main.Id, UpdateRequest(
            sideDishIds: [rice.Id], inlineSideDishIds: [rice.Id]));
        await controller.UpdateRecipe(main.Id, UpdateRequest(
            sideDishIds: [rice.Id], inlineSideDishIds: []));

        Assert.Equal(SideDishDisplayModes.Link, Assert.Single(ctx.GetSideDishLinks(main.Id)).DisplayMode);
    }

    [Fact]
    public async Task SaveExtractedRecipe_WithInlineSubset_PersistsDisplayMode()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        var naan = ctx.SeedRecipe("Naan", isTilbehor: true);
        var controller = ctx.CreateController();

        var result = await controller.SaveExtractedRecipe(new SaveExtractedRecipeRequest
        {
            Title = "Tikka masala",
            SideDishIds = [rice.Id, naan.Id],
            InlineSideDishIds = [naan.Id]
        });

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var dto = Assert.IsType<RecipeDto>(created.Value);

        var links = ctx.GetSideDishLinks(dto.Id);
        Assert.Equal(SideDishDisplayModes.Link, links.Single(l => l.SideDishRecipeId == rice.Id).DisplayMode);
        Assert.Equal(SideDishDisplayModes.Inline, links.Single(l => l.SideDishRecipeId == naan.Id).DisplayMode);
    }

    [Fact]
    public async Task SaveExtractedRecipe_WithInlineIdNotAmongSideDishes_ReturnsBadRequest()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        var naan = ctx.SeedRecipe("Naan", isTilbehor: true);
        var controller = ctx.CreateController();

        var result = await controller.SaveExtractedRecipe(new SaveExtractedRecipeRequest
        {
            Title = "Tikka masala",
            SideDishIds = [rice.Id],
            InlineSideDishIds = [naan.Id]
        });

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ── Merging ────────────────────────────────────────────────────────────

    /// <summary>
    /// The trap this whole feature turns on: a main dish that keeps its content in the flat
    /// lists must be lifted into a section of its own when something is merged in, or its own
    /// ingredients disappear behind the side dish's section.
    /// </summary>
    [Fact]
    public async Task GetRecipeById_FlatMainDish_KeepsItsOwnIngredientsInASectionOfItsOwn()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        main.Ingredients = [Ingredient("kylling")];
        main.InstructionSteps = [Step("Stek kyllingen")];
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        rice.Ingredients = [Ingredient("basmatiris")];
        rice.InstructionSteps = [Step("Kok risen")];
        ctx.Db.SaveChanges();

        ctx.AttachSideDish(main.Id, rice.Id, SideDishDisplayModes.Inline);

        var detail = await GetDetail(ctx, main.Id);

        Assert.Equal(["Tikka masala", "Ris"], detail.IngredientSections.Select(s => s.Heading));
        Assert.Equal("kylling", Assert.Single(detail.IngredientSections[0].Ingredients).Name);
        Assert.Equal("basmatiris", Assert.Single(detail.IngredientSections[1].Ingredients).Name);

        Assert.Equal(["Tikka masala", "Ris"], detail.InstructionSections.Select(s => s.Heading));
        Assert.Equal("Stek kyllingen", Assert.Single(detail.InstructionSections[0].Steps).Text);
        Assert.Equal("Kok risen", Assert.Single(detail.InstructionSections[1].Steps).Text);
    }

    [Fact]
    public async Task GetRecipeById_SectionedMainDish_KeepsItsOwnSectionsAhead()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        main.IngredientSections =
        [
            new IngredientSection { Heading = "Marinade", Ingredients = [Ingredient("yoghurt")] },
            new IngredientSection { Heading = "Saus", Ingredients = [Ingredient("tomat")] }
        ];
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        rice.Ingredients = [Ingredient("basmatiris")];
        ctx.Db.SaveChanges();

        ctx.AttachSideDish(main.Id, rice.Id, SideDishDisplayModes.Inline);

        var detail = await GetDetail(ctx, main.Id);

        Assert.Equal(["Marinade", "Saus", "Ris"], detail.IngredientSections.Select(s => s.Heading));
    }

    [Fact]
    public async Task GetRecipeById_MergesInlineSideDishesInSortOrder()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        main.Ingredients = [Ingredient("kylling")];
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        rice.Ingredients = [Ingredient("basmatiris")];
        var naan = ctx.SeedRecipe("Naan", isTilbehor: true);
        naan.Ingredients = [Ingredient("mel")];
        ctx.Db.SaveChanges();

        ctx.AttachSideDish(main.Id, naan.Id, SideDishDisplayModes.Inline);
        ctx.AttachSideDish(main.Id, rice.Id, SideDishDisplayModes.Inline, sortOrder: 1);

        var detail = await GetDetail(ctx, main.Id);

        Assert.Equal(["Tikka masala", "Naan", "Ris"], detail.IngredientSections.Select(s => s.Heading));
    }

    [Fact]
    public async Task GetRecipeById_LinkSideDish_IsNotMerged()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        main.Ingredients = [Ingredient("kylling")];
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        rice.Ingredients = [Ingredient("basmatiris")];
        ctx.Db.SaveChanges();

        ctx.AttachSideDish(main.Id, rice.Id, SideDishDisplayModes.Link);

        var detail = await GetDetail(ctx, main.Id);

        // Nothing merged, so the flat lists are left exactly as they were.
        Assert.Empty(detail.IngredientSections);
        Assert.Equal("kylling", Assert.Single(detail.Ingredients).Name);
        Assert.Equal(SideDishDisplayModes.Link, Assert.Single(detail.SideDishes).DisplayMode);
    }

    [Fact]
    public async Task GetRecipeById_EmptySideDish_ContributesNoSection()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        main.Ingredients = [Ingredient("kylling")];
        main.InstructionSteps = [Step("Stek kyllingen")];
        // Ris has steps but no ingredients -- it must not leave an empty ingredient heading.
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        rice.InstructionSteps = [Step("Kok risen")];
        ctx.Db.SaveChanges();

        ctx.AttachSideDish(main.Id, rice.Id, SideDishDisplayModes.Inline);

        var detail = await GetDetail(ctx, main.Id);

        Assert.Equal(["Tikka masala"], detail.IngredientSections.Select(s => s.Heading));
        Assert.Equal(["Tikka masala", "Ris"], detail.InstructionSections.Select(s => s.Heading));
    }

    [Fact]
    public async Task GetRecipeById_SectionedSideDish_IsFlattenedIntoOneSection()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        main.Ingredients = [Ingredient("kylling")];
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        rice.IngredientSections =
        [
            new IngredientSection { Heading = "Til risen", Ingredients = [Ingredient("basmatiris")] },
            new IngredientSection { Heading = "Til smaken", Ingredients = [Ingredient("kardemomme")] }
        ];
        ctx.Db.SaveChanges();

        ctx.AttachSideDish(main.Id, rice.Id, SideDishDisplayModes.Inline);

        var detail = await GetDetail(ctx, main.Id);

        // One heading for the tilbehør, not a second level of headings inside the main dish.
        Assert.Equal(["Tikka masala", "Ris"], detail.IngredientSections.Select(s => s.Heading));
        Assert.Equal(["basmatiris", "kardemomme"], detail.IngredientSections[1].Ingredients.Select(i => i.Name));
    }

    [Fact]
    public async Task GetRecipeById_InlineSideDish_IsStillListedWithItsDisplayMode()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        rice.Ingredients = [Ingredient("basmatiris")];
        ctx.Db.SaveChanges();

        ctx.AttachSideDish(main.Id, rice.Id, SideDishDisplayModes.Inline);

        var detail = await GetDetail(ctx, main.Id);

        // The chip is filtered client-side, so the entry itself must survive the response.
        Assert.Equal(SideDishDisplayModes.Inline, Assert.Single(detail.SideDishes).DisplayMode);
    }

    // ── Shared link ────────────────────────────────────────────────────────

    [Fact]
    public async Task GetSharedRecipe_MergesInlineSideDishesAndDropsTheirTitles()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        main.Ingredients = [Ingredient("kylling")];
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        rice.Ingredients = [Ingredient("basmatiris")];
        var naan = ctx.SeedRecipe("Naan", isTilbehor: true);
        naan.Ingredients = [Ingredient("mel")];
        ctx.Db.SaveChanges();

        ctx.AttachSideDish(main.Id, rice.Id, SideDishDisplayModes.Inline);
        ctx.AttachSideDish(main.Id, naan.Id, SideDishDisplayModes.Link, sortOrder: 1);

        var token = await CreateShareToken(ctx.CreateController(), main.Id);

        var result = await new PublicRecipesController(ctx.Db).GetSharedRecipe(token);
        var dto = Assert.IsType<SharedRecipeDto>(Assert.IsType<OkObjectResult>(result.Result).Value);

        Assert.Equal(["Tikka masala", "Ris"], dto.IngredientSections.Select(s => s.Heading));
        // Naan stays a link, so it keeps its plain-text mention; Ris is already in the sections.
        Assert.Equal(["Naan"], dto.SideDishes);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private static StructuredIngredient Ingredient(string name) => new() { Name = name };

    private static InstructionStep Step(string text) => new() { Text = text };

    private static async Task<RecipeDetailDto> GetDetail(RecipeTestContext ctx, int id)
    {
        var result = await ctx.CreateController().GetRecipeById(id);
        return Assert.IsType<RecipeDetailDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
    }

    private static async Task<string> CreateShareToken(RecipesController controller, int recipeId)
    {
        var result = await controller.CreateShare(recipeId);
        var dto = result.Value
            ?? Assert.IsType<ShareStatusDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        return dto.Token!;
    }

    // ── Edit view ──────────────────────────────────────────────────────────

    /// <summary>
    /// The edit form writes the section lists straight back on save. If it were handed the
    /// merged view, the tilbehør's ingredients would be copied into the main dish for good --
    /// and the flat lists it converted from would be gone.
    /// </summary>
    [Fact]
    public async Task GetRecipeById_Unmerged_ReturnsTheRecipesOwnListsOnly()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        main.Ingredients = [Ingredient("kylling")];
        main.InstructionSteps = [Step("Stek kyllingen")];
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        rice.Ingredients = [Ingredient("basmatiris")];
        ctx.Db.SaveChanges();

        ctx.AttachSideDish(main.Id, rice.Id, SideDishDisplayModes.Inline);

        var result = await ctx.CreateController().GetRecipeById(main.Id, merged: false);
        var detail = Assert.IsType<RecipeDetailDto>(Assert.IsType<OkObjectResult>(result.Result).Value);

        Assert.Empty(detail.IngredientSections);
        Assert.Empty(detail.InstructionSections);
        Assert.Equal("kylling", Assert.Single(detail.Ingredients).Name);
        Assert.Equal("Stek kyllingen", Assert.Single(detail.InstructionSteps).Text);

        // The display mode still has to reach the form, or editing resets it to Lenke.
        Assert.Equal(SideDishDisplayModes.Inline, Assert.Single(detail.SideDishes).DisplayMode);
    }

    [Fact]
    public async Task GetRecipeById_Unmerged_KeepsTheRecipesOwnSections()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        main.IngredientSections =
        [
            new IngredientSection { Heading = "Marinade", Ingredients = [Ingredient("yoghurt")] }
        ];
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        rice.Ingredients = [Ingredient("basmatiris")];
        ctx.Db.SaveChanges();

        ctx.AttachSideDish(main.Id, rice.Id, SideDishDisplayModes.Inline);

        var result = await ctx.CreateController().GetRecipeById(main.Id, merged: false);
        var detail = Assert.IsType<RecipeDetailDto>(Assert.IsType<OkObjectResult>(result.Result).Value);

        Assert.Equal(["Marinade"], detail.IngredientSections.Select(x => x.Heading));
    }

    /// <summary>
    /// A save round-trip through the unmerged view must leave the stored recipe unchanged --
    /// this is the regression the merged edit view would have caused.
    /// </summary>
    [Fact]
    public async Task EditRoundTrip_ThroughTheUnmergedView_DoesNotAbsorbTheSideDish()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        main.Ingredients = [Ingredient("kylling")];
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        rice.Ingredients = [Ingredient("basmatiris")];
        ctx.Db.SaveChanges();

        ctx.AttachSideDish(main.Id, rice.Id, SideDishDisplayModes.Inline);

        // What the edit form loads...
        var loaded = await ctx.CreateController().GetRecipeById(main.Id, merged: false);
        var form = Assert.IsType<RecipeDetailDto>(Assert.IsType<OkObjectResult>(loaded.Result).Value);

        // ...and saves straight back, untouched.
        await ctx.CreateController().UpdateRecipe(main.Id, new UpdateRecipeRequest
        {
            Title = form.Title,
            Ingredients = form.Ingredients,
            InstructionSteps = form.InstructionSteps,
            IngredientSections = form.IngredientSections,
            InstructionSections = form.InstructionSections,
            SideDishIds = form.SideDishes.Select(sd => sd.Id).ToList(),
            InlineSideDishIds = form.SideDishes
                .Where(sd => sd.DisplayMode == SideDishDisplayModes.Inline)
                .Select(sd => sd.Id)
                .ToList()
        });

        var stored = ctx.Db.Recipes.Single(r => r.Id == main.Id);
        Assert.Equal("kylling", Assert.Single(stored.Ingredients).Name);
        Assert.Empty(stored.IngredientSections);
        Assert.Equal(SideDishDisplayModes.Inline, Assert.Single(ctx.GetSideDishLinks(main.Id)).DisplayMode);
    }

    /// <summary>
    /// A main dish with no content of its own contributes no empty heading -- the merged list
    /// is just the tilbehør. RecipeBody prefers the sections when they exist, so the flat
    /// lists left in the DTO cannot show the same thing twice.
    /// </summary>
    [Fact]
    public async Task GetRecipeById_EmptyMainDish_YieldsOnlyTheSideDishSection()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        rice.Ingredients = [Ingredient("basmatiris")];
        ctx.Db.SaveChanges();

        ctx.AttachSideDish(main.Id, rice.Id, SideDishDisplayModes.Inline);

        var detail = await GetDetail(ctx, main.Id);

        Assert.Equal(["Ris"], detail.IngredientSections.Select(x => x.Heading));
        Assert.Empty(detail.Ingredients);
    }
}
