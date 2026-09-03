using Microsoft.AspNetCore.Mvc;
using RecipeApi.Features.Recipes;
using Xunit;

namespace RecipeApi.Tests.Recipes;

/// <summary>
/// Covers the pan (form) rules for cake recipes: QuantityType "form" requires a known
/// shape plus the dimensions that shape needs, the fields round-trip through the
/// create/update/detail DTOs, and a recipe that is not a cake carries no pan.
/// </summary>
public class RecipePanFieldsTests
{
    private static UpdateRecipeRequest UpdateRequest(
        string quantityType = "form",
        string? panShape = "rund",
        decimal? panDiameter = 24,
        decimal? panLength = null,
        decimal? panWidth = null,
        decimal? panHeight = null,
        double? servings = 452,
        List<string>? availablePanPresetIds = null,
        string? defaultPanPresetId = null) => new()
        {
            Title = "Sjokoladekake",
            QuantityType = quantityType,
            PanShape = panShape,
            PanDiameter = panDiameter,
            PanLength = panLength,
            PanWidth = panWidth,
            PanHeight = panHeight,
            Servings = servings,
            AvailablePanPresetIds = availablePanPresetIds,
            DefaultPanPresetId = defaultPanPresetId
        };

    // ── Validation ─────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateRecipe_FormWithoutShape_ReturnsBadRequest()
    {
        using var ctx = new RecipeTestContext();
        var recipe = ctx.SeedRecipe("Sjokoladekake");
        var controller = ctx.CreateController();

        var result = await controller.UpdateRecipe(
            recipe.Id, UpdateRequest(panShape: null, panDiameter: null));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Contains("formtype", badRequest.Value!.ToString());
    }

    [Fact]
    public async Task UpdateRecipe_FormWithUnknownShape_ReturnsBadRequest()
    {
        using var ctx = new RecipeTestContext();
        var recipe = ctx.SeedRecipe("Sjokoladekake");
        var controller = ctx.CreateController();

        var result = await controller.UpdateRecipe(
            recipe.Id, UpdateRequest(panShape: "trekant", panDiameter: 24));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Contains("Ukjent formtype", badRequest.Value!.ToString());
    }

    [Fact]
    public async Task UpdateRecipe_RoundPanWithoutDiameter_ReturnsBadRequest()
    {
        using var ctx = new RecipeTestContext();
        var recipe = ctx.SeedRecipe("Sjokoladekake");
        var controller = ctx.CreateController();

        var result = await controller.UpdateRecipe(
            recipe.Id, UpdateRequest(panShape: "rund", panDiameter: null));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Contains("diameter", badRequest.Value!.ToString());
    }

    [Fact]
    public async Task UpdateRecipe_RoundPanWithZeroDiameter_ReturnsBadRequest()
    {
        using var ctx = new RecipeTestContext();
        var recipe = ctx.SeedRecipe("Sjokoladekake");
        var controller = ctx.CreateController();

        var result = await controller.UpdateRecipe(recipe.Id, UpdateRequest(panDiameter: 0));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Contains("diameter", badRequest.Value!.ToString());
    }

    [Theory]
    [InlineData(null, 20d)]
    [InlineData(30d, null)]
    [InlineData(-5d, 20d)]
    public async Task UpdateRecipe_RectangularPanMissingDimension_ReturnsBadRequest(
        double? length, double? width)
    {
        using var ctx = new RecipeTestContext();
        var recipe = ctx.SeedRecipe("Langpannekake");
        var controller = ctx.CreateController();

        var result = await controller.UpdateRecipe(recipe.Id, UpdateRequest(
            panShape: "rektangulaer",
            panDiameter: null,
            panLength: (decimal?)length,
            panWidth: (decimal?)width));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Contains("lengde og bredde", badRequest.Value!.ToString());
    }

    [Theory]
    [InlineData(9999d, null, null, null)]
    [InlineData(null, 9999d, 20d, null)]
    [InlineData(null, 30d, 9999d, null)]
    [InlineData(24d, null, null, 9999d)]
    public async Task UpdateRecipe_OversizedDimension_ReturnsBadRequest(
        double? diameter, double? length, double? width, double? height)
    {
        using var ctx = new RecipeTestContext();
        var recipe = ctx.SeedRecipe("Sjokoladekake");
        var controller = ctx.CreateController();

        // The columns are decimal(5,1); without an explicit bound these would pass
        // validation and then overflow on save, turning a 400 into a 500.
        var result = await controller.UpdateRecipe(recipe.Id, UpdateRequest(
            panShape: length is null ? "rund" : "rektangulaer",
            panDiameter: (decimal?)diameter,
            panLength: (decimal?)length,
            panWidth: (decimal?)width,
            panHeight: (decimal?)height));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Contains("mindre enn", badRequest.Value!.ToString());
    }

    [Fact]
    public async Task UpdateRecipe_NonPositiveHeight_ReturnsBadRequest()
    {
        using var ctx = new RecipeTestContext();
        var recipe = ctx.SeedRecipe("Sjokoladekake");
        var controller = ctx.CreateController();

        var result = await controller.UpdateRecipe(recipe.Id, UpdateRequest(panHeight: 0));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Contains("Høyden", badRequest.Value!.ToString());
    }

    [Fact]
    public async Task UpdateRecipe_MuffinsNeedsNoDimensions()
    {
        using var ctx = new RecipeTestContext();
        var recipe = ctx.SeedRecipe("Muffins");
        var controller = ctx.CreateController();

        var result = await controller.UpdateRecipe(recipe.Id, UpdateRequest(
            panShape: "muffins", panDiameter: null, servings: 600));

        var detail = Assert.IsType<RecipeDetailDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal("muffins", detail.PanShape);
    }

    [Fact]
    public async Task UpdateRecipe_NonFormQuantityType_SkipsPanValidation()
    {
        using var ctx = new RecipeTestContext();
        var recipe = ctx.SeedRecipe("Tikka masala");
        var controller = ctx.CreateController();

        // No shape and no dimensions — fine, because this is not a cake.
        var result = await controller.UpdateRecipe(recipe.Id, UpdateRequest(
            quantityType: "porsjoner", panShape: null, panDiameter: null, servings: 4));

        Assert.IsType<OkObjectResult>(result.Result);
    }

    // ── Available preset subset + default ─────────────────────────────────

    [Fact]
    public async Task UpdateRecipe_UnknownPresetId_ReturnsBadRequest()
    {
        using var ctx = new RecipeTestContext();
        var recipe = ctx.SeedRecipe("Sjokoladekake");
        var controller = ctx.CreateController();

        var result = await controller.UpdateRecipe(recipe.Id, UpdateRequest(
            availablePanPresetIds: ["rund-24", "ikke-en-form"]));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Contains("Ukjent formvariant", badRequest.Value!.ToString());
    }

    [Fact]
    public async Task UpdateRecipe_DefaultNotInSubset_ReturnsBadRequest()
    {
        using var ctx = new RecipeTestContext();
        var recipe = ctx.SeedRecipe("Sjokoladekake");
        var controller = ctx.CreateController();

        var result = await controller.UpdateRecipe(recipe.Id, UpdateRequest(
            availablePanPresetIds: ["rund-24", "rund-26"],
            defaultPanPresetId: "langpanne-30x40"));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Contains("Standardformen", badRequest.Value!.ToString());
    }

    [Fact]
    public async Task UpdateRecipe_EmptySubset_IsAccepted()
    {
        using var ctx = new RecipeTestContext();
        var recipe = ctx.SeedRecipe("Sjokoladekake");
        var controller = ctx.CreateController();

        var result = await controller.UpdateRecipe(recipe.Id, UpdateRequest(
            availablePanPresetIds: []));

        Assert.IsType<OkObjectResult>(result.Result);
    }

    [Fact]
    public async Task UpdateRecipe_ValidSubsetAndDefault_PersistsBoth()
    {
        using var ctx = new RecipeTestContext();
        var recipe = ctx.SeedRecipe("Sjokoladekake");
        var controller = ctx.CreateController();

        var result = await controller.UpdateRecipe(recipe.Id, UpdateRequest(
            availablePanPresetIds: ["rund-24", "rund-26", "langpanne-30x40"],
            defaultPanPresetId: "rund-26"));

        var detail = Assert.IsType<RecipeDetailDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(["rund-24", "rund-26", "langpanne-30x40"], detail.AvailablePanPresetIds);
        Assert.Equal("rund-26", detail.DefaultPanPresetId);

        var stored = ctx.Db.Recipes.Find(recipe.Id)!;
        Assert.Equal(["rund-24", "rund-26", "langpanne-30x40"], stored.AvailablePanPresetIds);
        Assert.Equal("rund-26", stored.DefaultPanPresetId);
    }

    [Fact]
    public async Task UpdateRecipe_SwitchingAwayFromForm_ClearsAvailablePresetsAndDefault()
    {
        using var ctx = new RecipeTestContext();
        var recipe = ctx.SeedRecipe("Var en kake");
        recipe.QuantityType = "form";
        recipe.PanShape = "rund";
        recipe.PanDiameter = 24;
        recipe.AvailablePanPresetIds = ["rund-24", "rund-26"];
        recipe.DefaultPanPresetId = "rund-26";
        ctx.Db.SaveChanges();

        var controller = ctx.CreateController();

        var result = await controller.UpdateRecipe(recipe.Id, UpdateRequest(
            quantityType: "porsjoner", servings: 8));

        var detail = Assert.IsType<RecipeDetailDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Null(detail.AvailablePanPresetIds);
        Assert.Null(detail.DefaultPanPresetId);

        var stored = ctx.Db.Recipes.Find(recipe.Id)!;
        Assert.Null(stored.AvailablePanPresetIds);
        Assert.Null(stored.DefaultPanPresetId);
    }

    // ── Round-tripping ─────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateRecipe_PersistsAndReturnsPanFields()
    {
        using var ctx = new RecipeTestContext();
        var recipe = ctx.SeedRecipe("Langpannekake");
        var controller = ctx.CreateController();

        var result = await controller.UpdateRecipe(recipe.Id, UpdateRequest(
            panShape: "rektangulaer",
            panDiameter: null,
            panLength: 40,
            panWidth: 30,
            panHeight: 5,
            servings: 1200));

        var detail = Assert.IsType<RecipeDetailDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal("rektangulaer", detail.PanShape);
        Assert.Equal(40m, detail.PanLength);
        Assert.Equal(30m, detail.PanWidth);
        Assert.Equal(5m, detail.PanHeight);
        Assert.Equal(1200, detail.Servings);

        var stored = ctx.Db.Recipes.Find(recipe.Id)!;
        Assert.Equal("form", stored.QuantityType);
        Assert.Equal("rektangulaer", stored.PanShape);
        Assert.Equal(1200, stored.Servings);
    }

    [Fact]
    public async Task GetRecipeById_ReturnsPanFields()
    {
        using var ctx = new RecipeTestContext();
        var recipe = ctx.SeedRecipe("Sjokoladekake");
        recipe.QuantityType = "form";
        recipe.PanShape = "rund";
        recipe.PanDiameter = 24;
        recipe.Servings = 452;
        ctx.Db.SaveChanges();

        var controller = ctx.CreateController();
        var result = await controller.GetRecipeById(recipe.Id);

        var detail = Assert.IsType<RecipeDetailDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal("form", detail.QuantityType);
        Assert.Equal("rund", detail.PanShape);
        Assert.Equal(24m, detail.PanDiameter);
    }

    [Fact]
    public async Task SaveExtractedRecipe_PersistsPanFields()
    {
        using var ctx = new RecipeTestContext();
        var controller = ctx.CreateController();

        var result = await controller.SaveExtractedRecipe(new SaveExtractedRecipeRequest
        {
            Title = "Formkake",
            QuantityType = "form",
            PanShape = "rund",
            PanDiameter = 26,
            Servings = 531
        });

        Assert.IsNotType<BadRequestObjectResult>(result.Result);

        var stored = ctx.Db.Recipes.Single(r => r.Title == "Formkake");
        Assert.Equal("rund", stored.PanShape);
        Assert.Equal(26m, stored.PanDiameter);
    }

    [Fact]
    public async Task SaveExtractedRecipe_FormWithoutDimensions_ReturnsBadRequest()
    {
        using var ctx = new RecipeTestContext();
        var controller = ctx.CreateController();

        var result = await controller.SaveExtractedRecipe(new SaveExtractedRecipeRequest
        {
            Title = "Formkake",
            QuantityType = "form",
            PanShape = "rund"
        });

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Contains("diameter", badRequest.Value!.ToString());
    }

    // ── Clearing ───────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateRecipe_SwitchingAwayFromForm_ClearsPanFields()
    {
        using var ctx = new RecipeTestContext();
        var recipe = ctx.SeedRecipe("Var en kake");
        recipe.QuantityType = "form";
        recipe.PanShape = "rund";
        recipe.PanDiameter = 24;
        recipe.PanHeight = 6;
        ctx.Db.SaveChanges();

        var controller = ctx.CreateController();

        // The form posts every field, so the stale pan values come back with the request.
        var result = await controller.UpdateRecipe(recipe.Id, UpdateRequest(
            quantityType: "porsjoner", servings: 8));

        var detail = Assert.IsType<RecipeDetailDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Null(detail.PanShape);
        Assert.Null(detail.PanDiameter);
        Assert.Null(detail.PanHeight);

        var stored = ctx.Db.Recipes.Find(recipe.Id)!;
        Assert.Null(stored.PanShape);
        Assert.Null(stored.PanDiameter);
    }
}
