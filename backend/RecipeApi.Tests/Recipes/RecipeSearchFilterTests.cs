using Microsoft.AspNetCore.Mvc;
using RecipeApi.Features.Recipes;
using Xunit;

namespace RecipeApi.Tests.Recipes;

/// <summary>
/// Covers how GetAllRecipes applies the `search` query parameter: substring
/// matching on Title, case-insensitivity, blank input, and combination with
/// the `categories` filter.
///
/// Note: the controller escapes `%`/`_`/`[` before calling EF.Functions.Like so
/// SQL Server treats them as literals. The InMemory provider used here does not
/// implement the `[...]` escape syntax at all, so that escaping is not covered
/// by these tests; it is exercised by the migration applying against SQL Server.
/// </summary>
public class RecipeSearchFilterTests
{
    private const int Lunsj = 2;
    private const int Middag = 3;

    private static async Task<List<string>> SearchTitlesAsync(RecipeTestContext ctx, string? search, string? categories = null)
    {
        var controller = ctx.CreateController();
        var result = await controller.GetAllRecipes(categories, search: search);
        var recipes = result.Value
            ?? Assert.IsType<List<RecipeDto>>(Assert.IsType<OkObjectResult>(result.Result).Value);
        return recipes.Select(r => r.Title).OrderBy(t => t).ToList();
    }

    private static RecipeTestContext SeedFixture()
    {
        var ctx = new RecipeTestContext();

        var lunsj = ctx.SeedCategory(Lunsj, "Lunsj", RecipeCategories.MealTypeGroup);
        var middag = ctx.SeedCategory(Middag, "Middag", RecipeCategories.MealTypeGroup);

        ctx.SeedRecipeWithCategories("Kremet Kyllingpasta", lunsj);
        ctx.SeedRecipeWithCategories("Enkel Fiskesuppe", lunsj);
        ctx.SeedRecipeWithCategories("Kyllinggryte med ris", middag);
        ctx.SeedRecipeWithCategories("Sjokoladekake", middag);

        return ctx;
    }

    [Fact]
    public async Task Search_MatchesSubstringInTitle()
    {
        using var ctx = SeedFixture();

        var titles = await SearchTitlesAsync(ctx, "kylling");

        Assert.Equal(["Kremet Kyllingpasta", "Kyllinggryte med ris"], titles);
    }

    [Fact]
    public async Task Search_IsCaseInsensitive()
    {
        using var ctx = SeedFixture();

        var titles = await SearchTitlesAsync(ctx, "KYLLING");

        Assert.Equal(["Kremet Kyllingpasta", "Kyllinggryte med ris"], titles);
    }

    [Fact]
    public async Task Search_NoMatch_ReturnsEmpty()
    {
        using var ctx = SeedFixture();

        var titles = await SearchTitlesAsync(ctx, "quinoa");

        Assert.Empty(titles);
    }

    [Fact]
    public async Task Search_BlankOrWhitespace_ReturnsEverything()
    {
        using var ctx = SeedFixture();

        var titles = await SearchTitlesAsync(ctx, "   ");

        foreach (var expected in new[] { "Kremet Kyllingpasta", "Enkel Fiskesuppe", "Kyllinggryte med ris", "Sjokoladekake" })
            Assert.Contains(expected, titles);
    }

    [Fact]
    public async Task Search_CombinedWithCategories_FiltersOnBoth()
    {
        using var ctx = SeedFixture();

        var titles = await SearchTitlesAsync(ctx, "kylling", categories: $"{Middag}");

        Assert.Equal(["Kyllinggryte med ris"], titles);
    }
}
