using Microsoft.AspNetCore.Mvc;
using RecipeApi.Features.Recipes;
using Xunit;

namespace RecipeApi.Tests.Recipes;

/// <summary>
/// Covers how GetAllRecipes combines the category filter: choices inside one
/// category group (Måltidstype, Tilberedningstid, Vanskelighetsgrad) are OR-ed,
/// while separate groups are AND-ed together.
/// </summary>
public class RecipeCategoryFilterTests
{
    private const int Lunsj = 2;
    private const int Middag = 3;
    private const int Dessert = 4;
    private const int Enkel = 9;
    private const int Middels = 10;
    private const int Under30Min = 13;

    private static async Task<List<string>> FilterTitlesAsync(RecipeTestContext ctx, string? categories)
    {
        var controller = ctx.CreateController();
        var result = await controller.GetAllRecipes(categories);
        var recipes = result.Value
            ?? Assert.IsType<List<RecipeDto>>(Assert.IsType<OkObjectResult>(result.Result).Value);
        return recipes.Select(r => r.Title).OrderBy(t => t).ToList();
    }

    /// <summary>Seeds one recipe per meal-type/difficulty combination used by the tests.</summary>
    private static RecipeTestContext SeedFixture()
    {
        var ctx = new RecipeTestContext();

        var lunsj = ctx.SeedCategory(Lunsj, "Lunsj", RecipeCategories.MealTypeGroup);
        var middag = ctx.SeedCategory(Middag, "Middag", RecipeCategories.MealTypeGroup);
        var dessert = ctx.SeedCategory(Dessert, "Dessert", RecipeCategories.MealTypeGroup);
        var enkel = ctx.SeedCategory(Enkel, "Enkel", "Vanskelighetsgrad");
        var middels = ctx.SeedCategory(Middels, "Middels", "Vanskelighetsgrad");
        var under30 = ctx.SeedCategory(Under30Min, "Under 30 min", "Tilberedningstid");

        ctx.SeedRecipeWithCategories("Enkel lunsj", lunsj, enkel, under30);
        ctx.SeedRecipeWithCategories("Enkel middag", middag, enkel);
        ctx.SeedRecipeWithCategories("Avansert middag", middag, middels);
        ctx.SeedRecipeWithCategories("Enkel dessert", dessert, enkel);

        return ctx;
    }

    [Fact]
    public async Task NoCategories_ReturnsEverything()
    {
        using var ctx = SeedFixture();

        var titles = await FilterTitlesAsync(ctx, null);

        // EnsureCreated also seeds the default recipes, so assert containment
        // rather than an exact list.
        foreach (var expected in new[] { "Avansert middag", "Enkel dessert", "Enkel lunsj", "Enkel middag" })
            Assert.Contains(expected, titles);
    }

    [Fact]
    public async Task TwoChoicesInSameGroup_AreOred()
    {
        using var ctx = SeedFixture();

        var titles = await FilterTitlesAsync(ctx, $"{Lunsj},{Middag}");

        Assert.Equal(["Avansert middag", "Enkel lunsj", "Enkel middag"], titles);
    }

    [Fact]
    public async Task ChoicesInDifferentGroups_AreAnded()
    {
        using var ctx = SeedFixture();

        // Lunsj OR Middag, and additionally Enkel — "Avansert middag" drops out.
        var titles = await FilterTitlesAsync(ctx, $"{Lunsj},{Middag},{Enkel}");

        Assert.Equal(["Enkel lunsj", "Enkel middag"], titles);
    }

    [Fact]
    public async Task ThreeGroupsCombined_NarrowToTheIntersection()
    {
        using var ctx = SeedFixture();

        var titles = await FilterTitlesAsync(ctx, $"{Lunsj},{Middag},{Enkel},{Under30Min}");

        Assert.Equal(["Enkel lunsj"], titles);
    }

    [Fact]
    public async Task GroupsWithNoOverlap_ReturnNothing()
    {
        using var ctx = SeedFixture();

        var titles = await FilterTitlesAsync(ctx, $"{Dessert},{Middels}");

        Assert.Empty(titles);
    }

    [Fact]
    public async Task UnknownCategoryId_MatchesNothing()
    {
        using var ctx = SeedFixture();

        var titles = await FilterTitlesAsync(ctx, "9999");

        Assert.Empty(titles);
    }
}
