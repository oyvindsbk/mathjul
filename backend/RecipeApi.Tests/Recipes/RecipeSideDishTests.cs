using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using RecipeApi.Features.Recipes;
using Xunit;

namespace RecipeApi.Tests.Recipes;

/// <summary>
/// Covers the tilbehør (side dish) rules: only Tilbehør-marked recipes can be attached,
/// a recipe cannot be its own tilbehør, and a tilbehør cannot itself have tilbehør.
/// </summary>
public class RecipeSideDishTests
{
    private static UpdateRecipeRequest UpdateRequest(
        string title = "Hovedrett",
        List<int>? categoryIds = null,
        List<int>? sideDishIds = null) => new()
        {
            Title = title,
            CategoryIds = categoryIds,
            SideDishIds = sideDishIds
        };

    // ── Validation ─────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateRecipe_WithSelfReference_ReturnsBadRequest()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var recipe = ctx.SeedRecipe("Ris", isTilbehor: true);
        var controller = ctx.CreateController();

        // The recipe drops its Tilbehør mark here, so rule (b) does not mask the self-reference.
        var result = await controller.UpdateRecipe(
            recipe.Id, UpdateRequest(sideDishIds: [recipe.Id]));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Contains("seg selv", badRequest.Value!.ToString());
    }

    [Fact]
    public async Task UpdateRecipe_AttachingNonTilbehorRecipe_ReturnsBadRequest()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        var notTilbehor = ctx.SeedRecipe("Pizza");
        var controller = ctx.CreateController();

        var result = await controller.UpdateRecipe(
            main.Id, UpdateRequest(sideDishIds: [notTilbehor.Id]));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Contains("Pizza", badRequest.Value!.ToString());
    }

    [Fact]
    public async Task UpdateRecipe_OnRecipeMarkedTilbehor_WithSideDishes_ReturnsBadRequest()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Ris");
        var side = ctx.SeedRecipe("Naan", isTilbehor: true);
        var controller = ctx.CreateController();

        var result = await controller.UpdateRecipe(main.Id, UpdateRequest(
            categoryIds: [RecipeCategories.TilbehorId],
            sideDishIds: [side.Id]));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Contains("kan ikke ha tilbehør selv", badRequest.Value!.ToString());
    }

    [Fact]
    public async Task UpdateRecipe_WithNonExistentRecipeId_ReturnsBadRequest()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        var controller = ctx.CreateController();

        var result = await controller.UpdateRecipe(main.Id, UpdateRequest(sideDishIds: [9999]));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Contains("finnes ikke", badRequest.Value!.ToString());
    }

    [Fact]
    public async Task UpdateRecipe_MarkingAsTilbehorWhileDroppingSideDishes_Succeeds()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Ris");
        var side = ctx.SeedRecipe("Naan", isTilbehor: true);
        var controller = ctx.CreateController();

        await controller.UpdateRecipe(main.Id, UpdateRequest(sideDishIds: [side.Id]));

        // Validation reads the incoming categories, so this combination is legal.
        var result = await controller.UpdateRecipe(main.Id, UpdateRequest(
            categoryIds: [RecipeCategories.TilbehorId],
            sideDishIds: []));

        Assert.IsType<OkObjectResult>(result.Result);
        Assert.Empty(ctx.GetSideDishLinks(main.Id));
    }

    // ── Persistence ────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateRecipe_WithValidTilbehor_PersistsInOrder()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        var naan = ctx.SeedRecipe("Naan", isTilbehor: true);
        var controller = ctx.CreateController();

        var result = await controller.UpdateRecipe(
            main.Id, UpdateRequest(sideDishIds: [naan.Id, rice.Id]));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var detail = Assert.IsType<RecipeDetailDto>(ok.Value);
        Assert.Equal(["Naan", "Ris"], detail.SideDishes.Select(s => s.Title));

        var links = ctx.GetSideDishLinks(main.Id);
        Assert.Equal([naan.Id, rice.Id], links.Select(l => l.SideDishRecipeId));
        Assert.Equal([0, 1], links.Select(l => l.SortOrder));
    }

    [Fact]
    public async Task UpdateRecipe_WithReorderedIds_UpdatesSortOrder()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        var naan = ctx.SeedRecipe("Naan", isTilbehor: true);
        var controller = ctx.CreateController();

        await controller.UpdateRecipe(main.Id, UpdateRequest(sideDishIds: [rice.Id, naan.Id]));
        await controller.UpdateRecipe(main.Id, UpdateRequest(sideDishIds: [naan.Id, rice.Id]));

        var links = ctx.GetSideDishLinks(main.Id);
        Assert.Equal([naan.Id, rice.Id], links.Select(l => l.SideDishRecipeId));
    }

    [Fact]
    public async Task UpdateRecipe_WithEmptySideDishIds_ClearsExistingLinks()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        var controller = ctx.CreateController();

        await controller.UpdateRecipe(main.Id, UpdateRequest(sideDishIds: [rice.Id]));
        Assert.Single(ctx.GetSideDishLinks(main.Id));

        await controller.UpdateRecipe(main.Id, UpdateRequest(sideDishIds: []));

        Assert.Empty(ctx.GetSideDishLinks(main.Id));
    }

    [Fact]
    public async Task UpdateRecipe_WithDuplicateIds_Deduplicates()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        var controller = ctx.CreateController();

        var result = await controller.UpdateRecipe(
            main.Id, UpdateRequest(sideDishIds: [rice.Id, rice.Id]));

        Assert.IsType<OkObjectResult>(result.Result);
        Assert.Single(ctx.GetSideDishLinks(main.Id));
    }

    [Fact]
    public async Task UpdateRecipe_RemovingTilbehorMark_DetachesFromMainDishes()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var middag = ctx.SeedCategory(3, "Middag", RecipeCategories.MealTypeGroup);
        var main = ctx.SeedRecipe("Tikka masala");
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        var controller = ctx.CreateController();

        await controller.UpdateRecipe(main.Id, UpdateRequest(sideDishIds: [rice.Id]));
        Assert.Single(ctx.GetSideDishLinks(main.Id));

        // Ris is no longer a tilbehør, so it must not linger in any main dish's list.
        await controller.UpdateRecipe(rice.Id, UpdateRequest(
            title: "Ris", categoryIds: [middag.Id]));

        Assert.Empty(ctx.GetSideDishLinks(main.Id));
    }

    // ── Create ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task SaveExtractedRecipe_WithValidTilbehor_PersistsLinks()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        var controller = ctx.CreateController();

        var result = await controller.SaveExtractedRecipe(new SaveExtractedRecipeRequest
        {
            Title = "Tikka masala",
            SideDishIds = [rice.Id]
        });

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var dto = Assert.IsType<RecipeDto>(created.Value);

        var links = ctx.GetSideDishLinks(dto.Id);
        Assert.Equal(rice.Id, Assert.Single(links).SideDishRecipeId);
    }

    [Fact]
    public async Task SaveExtractedRecipe_WithNonTilbehor_ReturnsBadRequest()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var pizza = ctx.SeedRecipe("Pizza");
        var controller = ctx.CreateController();

        var result = await controller.SaveExtractedRecipe(new SaveExtractedRecipeRequest
        {
            Title = "Tikka masala",
            SideDishIds = [pizza.Id]
        });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Contains("Pizza", badRequest.Value!.ToString());
    }

    // ── Read ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetRecipeById_ReturnsSideDishesOrderedBySortOrder()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        var naan = ctx.SeedRecipe("Naan", isTilbehor: true);
        var controller = ctx.CreateController();

        await controller.UpdateRecipe(main.Id, UpdateRequest(sideDishIds: [naan.Id, rice.Id]));

        var result = await ctx.CreateController().GetRecipeById(main.Id);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var detail = Assert.IsType<RecipeDetailDto>(ok.Value);
        Assert.Equal(["Naan", "Ris"], detail.SideDishes.Select(s => s.Title));
    }

    [Fact]
    public async Task GetRecipeById_ReturnsUsedAsSideDishIn()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        var controller = ctx.CreateController();

        await controller.UpdateRecipe(
            main.Id, UpdateRequest(title: "Tikka masala", sideDishIds: [rice.Id]));

        var result = await ctx.CreateController().GetRecipeById(rice.Id);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var detail = Assert.IsType<RecipeDetailDto>(ok.Value);
        Assert.Equal("Tikka masala", Assert.Single(detail.UsedAsSideDishIn).Title);
    }

    [Fact]
    public async Task GetRecipeById_HidesPrivateMainDishFromOtherUsers()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        var main = ctx.SeedRecipe("Hemmelig rett");
        var controller = ctx.CreateController();

        await controller.UpdateRecipe(main.Id, new UpdateRecipeRequest
        {
            Title = "Hemmelig rett",
            Visibility = "Private",
            SideDishIds = [rice.Id]
        });

        var asStranger = ctx.CreateController(email: "someone-else@example.com");
        var result = await asStranger.GetRecipeById(rice.Id);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var detail = Assert.IsType<RecipeDetailDto>(ok.Value);
        Assert.Empty(detail.UsedAsSideDishIn);
    }

    // ── Delete ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteRecipe_UsedAsSideDish_RemovesReverseLinks()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        var main = ctx.SeedRecipe("Tikka masala");
        var rice = ctx.SeedRecipe("Ris", isTilbehor: true);
        var controller = ctx.CreateController();

        await controller.UpdateRecipe(main.Id, UpdateRequest(sideDishIds: [rice.Id]));

        var result = await ctx.CreateController().DeleteRecipe(rice.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(ctx.Db.RecipeSideDishes.AsNoTracking().ToList());
    }

    // ── AI ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetAllCategories_IncludesTilbehor()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        ctx.SeedCategory(3, "Middag", RecipeCategories.MealTypeGroup);
        var controller = ctx.CreateController();

        // The user-facing category list keeps Tilbehør so it can be picked manually.
        var result = await controller.GetAllCategories();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var categories = Assert.IsType<List<CategoryDto>>(ok.Value);
        Assert.Contains(categories, c => c.Id == RecipeCategories.TilbehorId);
    }

    [Fact]
    public async Task ExtractFromUrl_CategoryListSentToAi_ExcludesTilbehor()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        ctx.SeedCategory(3, "Middag", RecipeCategories.MealTypeGroup);

        string? capturedJson = null;
        ctx.UrlProcessor
            .Setup(p => p.ExtractRecipeFromUrlAsync(
                It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<Func<string, Task>?>(), It.IsAny<CancellationToken>()))
            .Callback<string, string?, Func<string, Task>?, CancellationToken>(
                (_, json, _, _) => capturedJson = json)
            .ReturnsAsync(RecipeExtractionResult.Success(new ExtractedRecipeDto { Title = "Tikka masala" }));

        var controller = ctx.CreateController();

        await controller.ExtractRecipeFromUrl(new ExtractFromUrlRequest { Url = "https://example.com/oppskrift" });

        Assert.NotNull(capturedJson);
        Assert.Contains("Middag", capturedJson);
        Assert.DoesNotContain(RecipeCategories.TilbehorName, capturedJson);
    }

    [Fact]
    public async Task ExtractFromUrl_HallucinatedTilbehorId_IsStrippedFromSuggestions()
    {
        using var ctx = new RecipeTestContext();
        ctx.SeedTilbehorCategory();
        ctx.SeedCategory(3, "Middag", RecipeCategories.MealTypeGroup);

        ctx.UrlProcessor
            .Setup(p => p.ExtractRecipeFromUrlAsync(
                It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<Func<string, Task>?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RecipeExtractionResult.Success(new ExtractedRecipeDto
            {
                Title = "Tikka masala",
                SuggestedCategoryIds = [3, RecipeCategories.TilbehorId]
            }));

        var controller = ctx.CreateController();

        var result = await controller.ExtractRecipeFromUrl(new ExtractFromUrlRequest { Url = "https://example.com/oppskrift" });

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<RecipeExtractionResponse>(ok.Value);
        Assert.Equal([3], response.ExtractedRecipe!.SuggestedCategoryIds);
    }
}
