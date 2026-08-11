using Microsoft.AspNetCore.Mvc;
using RecipeApi.Features.Recipes;
using Xunit;

namespace RecipeApi.Tests.Recipes;

/// <summary>
/// Covers the <c>categories</c> query filter on GET /api/recipes: several selected
/// categories widen the result (OR), they do not narrow it (AND).
/// </summary>
public class RecipeCategoryFilterTests
{
    private static Recipe SeedWithCategories(RecipeTestContext ctx, string title, params Category[] categories)
    {
        var recipe = ctx.SeedRecipe(title);
        foreach (var category in categories)
            recipe.Categories.Add(category);
        ctx.Db.SaveChanges();
        return recipe;
    }

    private static List<RecipeDto> Ok(ActionResult<List<RecipeDto>> result) =>
        Assert.IsType<List<RecipeDto>>(Assert.IsType<OkObjectResult>(result.Result).Value);

    [Fact]
    public async Task GetAllRecipes_WithTwoCategories_ReturnsRecipesMatchingEither()
    {
        using var ctx = new RecipeTestContext();
        var middag = ctx.SeedCategory(901, "Middag", "Måltidstype");
        var dessert = ctx.SeedCategory(902, "Dessert", "Måltidstype");
        var frokost = ctx.SeedCategory(903, "Frokost", "Måltidstype");

        SeedWithCategories(ctx, "Lasagne", middag);
        SeedWithCategories(ctx, "Sjokoladekake", dessert);
        SeedWithCategories(ctx, "Begge deler", middag, dessert);
        SeedWithCategories(ctx, "Grøt", frokost);

        var controller = ctx.CreateController();

        var recipes = Ok(await controller.GetAllRecipes($"{middag.Id},{dessert.Id}"));

        Assert.Equal(
            ["Begge deler", "Lasagne", "Sjokoladekake"],
            recipes.Select(r => r.Title).OrderBy(t => t));
    }

    [Fact]
    public async Task GetAllRecipes_WithSingleCategory_ReturnsOnlyThatCategory()
    {
        using var ctx = new RecipeTestContext();
        var middag = ctx.SeedCategory(901, "Middag", "Måltidstype");
        var dessert = ctx.SeedCategory(902, "Dessert", "Måltidstype");

        SeedWithCategories(ctx, "Lasagne", middag);
        SeedWithCategories(ctx, "Sjokoladekake", dessert);

        var controller = ctx.CreateController();

        var recipes = Ok(await controller.GetAllRecipes(middag.Id.ToString()));

        Assert.Equal(["Lasagne"], recipes.Select(r => r.Title));
    }

    [Fact]
    public async Task GetAllRecipes_WithoutCategories_ReturnsAll()
    {
        using var ctx = new RecipeTestContext();
        var middag = ctx.SeedCategory(901, "Middag", "Måltidstype");

        SeedWithCategories(ctx, "Lasagne", middag);
        ctx.SeedRecipe("Ukategorisert");

        var controller = ctx.CreateController();

        // The DbContext seeds default recipes too, so assert on the two seeded here.
        var recipes = Ok(await controller.GetAllRecipes());

        Assert.Contains(recipes, r => r.Title == "Lasagne");
        Assert.Contains(recipes, r => r.Title == "Ukategorisert");
    }
}
