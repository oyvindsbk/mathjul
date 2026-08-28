using Microsoft.AspNetCore.Mvc;
using RecipeApi.Features.Recipes;
using Xunit;

namespace RecipeApi.Tests.Recipes;

/// <summary>
/// Covers GetRecipeIngredientNames, the lightweight endpoint Snurr mathjulet uses to
/// build its ingredient filter (the regular list endpoint omits ingredients entirely).
/// </summary>
public class RecipeIngredientNamesTests
{
    private static async Task<List<RecipeIngredientNamesDto>> FetchAsync(RecipeTestContext ctx)
    {
        var controller = ctx.CreateController();
        var result = await controller.GetRecipeIngredientNames();
        return result.Value
            ?? Assert.IsType<List<RecipeIngredientNamesDto>>(Assert.IsType<OkObjectResult>(result.Result).Value);
    }

    [Fact]
    public async Task ReturnsNamesFromFlatIngredientsList()
    {
        using var ctx = new RecipeTestContext();

        var recipe = ctx.SeedRecipe("Kyllinggryte");
        recipe.Ingredients =
        [
            new StructuredIngredient { Name = "Kyllinglårfilet" },
            new StructuredIngredient { Name = "Løk" }
        ];
        ctx.Db.SaveChanges();

        var entries = await FetchAsync(ctx);

        var entry = Assert.Single(entries, e => e.RecipeId == recipe.Id);
        Assert.Contains("Kyllinglårfilet", entry.IngredientNames);
        Assert.Contains("Løk", entry.IngredientNames);
    }

    [Fact]
    public async Task ReturnsNamesFromIngredientSections()
    {
        using var ctx = new RecipeTestContext();

        var recipe = ctx.SeedRecipe("Taco");
        recipe.IngredientSections =
        [
            new IngredientSection
            {
                Heading = "Fyll",
                Ingredients = [new StructuredIngredient { Name = "Kyllinglårfilet eller kyllingbryst" }]
            }
        ];
        ctx.Db.SaveChanges();

        var entries = await FetchAsync(ctx);

        var entry = Assert.Single(entries, e => e.RecipeId == recipe.Id);
        Assert.Contains("Kyllinglårfilet eller kyllingbryst", entry.IngredientNames);
    }

    [Fact]
    public async Task RecipeWithNoIngredients_ReturnsEmptyList()
    {
        using var ctx = new RecipeTestContext();

        var recipe = ctx.SeedRecipe("Tomboks");

        var entries = await FetchAsync(ctx);

        var entry = Assert.Single(entries, e => e.RecipeId == recipe.Id);
        Assert.Empty(entry.IngredientNames);
    }
}
