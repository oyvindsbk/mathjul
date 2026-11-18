using Microsoft.AspNetCore.Mvc;
using Moq;
using RecipeApi.Features.Recipes;
using Xunit;

namespace RecipeApi.Tests.Recipes;

/// <summary>
/// Covers the Jul category behind the /jul page: it is seeded, filterable like any category
/// (and AND-ed with Måltidstype since it lives in its own group), and never offered to the
/// AI extraction or to Jev, so it is only ever tagged by hand.
/// </summary>
public class RecipeJulCategoryTests
{
    private const int Middag = 3;
    private const int Dessert = 4;

    private static async Task<List<string>> FilterTitlesAsync(RecipeTestContext ctx, string categories)
    {
        var result = await ctx.CreateController().GetAllRecipes(categories);
        var recipes = result.Value
            ?? Assert.IsType<List<RecipeDto>>(Assert.IsType<OkObjectResult>(result.Result).Value);
        return recipes.Select(r => r.Title).OrderBy(t => t).ToList();
    }

    private static RecipeTestContext SeedFixture()
    {
        var ctx = new RecipeTestContext();
        var middag = ctx.SeedCategory(Middag, "Middag", RecipeCategories.MealTypeGroup);
        var dessert = ctx.SeedCategory(Dessert, "Dessert", RecipeCategories.MealTypeGroup);
        var jul = ctx.SeedCategory(RecipeCategories.JulId, RecipeCategories.JulName, RecipeCategories.OccasionGroup);

        ctx.SeedRecipeWithCategories("Pinnekjøtt", middag, jul);
        ctx.SeedRecipeWithCategories("Riskrem", dessert, jul);
        ctx.SeedRecipeWithCategories("Taco", middag);

        return ctx;
    }

    [Fact]
    public async Task GetAllCategories_IncludesSeededJulInAnledning()
    {
        using var ctx = new RecipeTestContext();

        var result = await ctx.CreateController().GetAllCategories();

        var categories = Assert.IsType<List<CategoryDto>>(Assert.IsType<OkObjectResult>(result.Result).Value);
        var jul = Assert.Single(categories, c => c.Id == RecipeCategories.JulId);
        Assert.Equal(RecipeCategories.JulName, jul.Name);
        Assert.Equal(RecipeCategories.OccasionGroup, jul.Group);
    }

    [Fact]
    public async Task FilterByJul_ReturnsOnlyJulRecipes()
    {
        using var ctx = SeedFixture();

        var titles = await FilterTitlesAsync(ctx, $"{RecipeCategories.JulId}");

        Assert.Equal(["Pinnekjøtt", "Riskrem"], titles);
    }

    [Fact]
    public async Task FilterByMiddagAndJul_IsAnded()
    {
        using var ctx = SeedFixture();

        // Separate groups: "Christmas dinners", not "dinners or Christmas".
        var titles = await FilterTitlesAsync(ctx, $"{Middag},{RecipeCategories.JulId}");

        Assert.Equal(["Pinnekjøtt"], titles);
    }

    [Fact]
    public async Task ExtractFromUrl_CategoryListSentToAi_ExcludesJul()
    {
        using var ctx = new RecipeTestContext();

        string? capturedJson = null;
        ctx.UrlProcessor
            .Setup(p => p.ExtractRecipeFromUrlAsync(
                It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<Func<string, Task>?>(), It.IsAny<CancellationToken>()))
            .Callback<string, string?, Func<string, Task>?, CancellationToken>(
                (_, json, _, _) => capturedJson = json)
            .ReturnsAsync(RecipeExtractionResult.Success(new ExtractedRecipeDto { Title = "Pepperkaker" }));

        await ctx.CreateController().ExtractRecipeFromUrl(new ExtractFromUrlRequest { Url = "https://example.com/pepperkaker" });

        Assert.NotNull(capturedJson);
        var categories = JevClassificationInput.ParseCategoryList(capturedJson);
        Assert.Contains(categories, c => c.Name == "Middag");
        Assert.DoesNotContain(categories, c => c.Id == RecipeCategories.JulId);
        Assert.DoesNotContain(categories, c => c.Group == RecipeCategories.OccasionGroup);
    }

    /// <summary>
    /// Pins that Jev never gets a question for the one-option Anledning group, even if Jul
    /// slipped into its input. Adding a second occasion (påske) would change that, and this
    /// test makes the change visible.
    /// </summary>
    [Fact]
    public void JevRequest_SingleOptionAnledningGroup_GetsNoQuestion()
    {
        var questions = JevRequestBuilder.BuildQuestions(
        [
            new CategoryOption(Middag, "Middag", RecipeCategories.MealTypeGroup),
            new CategoryOption(Dessert, "Dessert", RecipeCategories.MealTypeGroup),
            new CategoryOption(RecipeCategories.JulId, RecipeCategories.JulName, RecipeCategories.OccasionGroup)
        ]);

        var question = Assert.Single(questions).Value;
        Assert.DoesNotContain(JevRequestBuilder.CriterionKey(RecipeCategories.JulId), question.Criteria.Keys);
    }
}
