using Microsoft.AspNetCore.Mvc;
using RecipeApi.Features.MealPlans;
using RecipeApi.Features.Recipes;
using RecipeApi.Features.Stock;
using Xunit;

namespace RecipeApi.Tests.Stock;

public class StockCoverageCalculationTests
{
    private static readonly DateOnly Today = new(2026, 10, 12);

    private static StockItem Stock(string name, decimal? qty = null, string? unit = null,
        bool staple = false, DateOnly? bestBefore = null) => new()
    {
        Id = Math.Abs(name.GetHashCode()) % 10000, Name = name, NormalizedName = IngredientMatcher.Normalize(name),
        Quantity = qty, Unit = unit, IsStaple = staple, BestBefore = bestBefore,
    };

    private static StructuredIngredient Ing(string name, decimal? qty = null, string? unit = null) =>
        new() { Name = name, Quantity = qty, Unit = unit };

    private static IngredientSource Src(string name, decimal? qty = null, string? unit = null, string? sideDish = null) =>
        new(Ing(name, qty, unit), sideDish);

    private static WeekEntryInput Entry(int id, string title, params IngredientSource[] ingredients) =>
        new(id, Today.AddDays(id), title, true, ingredients);

    // ── Flatten ────────────────────────────────────────────────────────────

    [Fact]
    public void Flatten_IncludesFlatListAndAllSections()
    {
        var recipe = new Recipe
        {
            Ingredients = [Ing("løk")],
            IngredientSections =
            [
                new IngredientSection { Heading = "Saus", Ingredients = [Ing("fløte"), Ing("hvitløk")] },
                new IngredientSection { Heading = "Topping", Ingredients = [Ing("persille")] },
            ],
        };

        Assert.Equal(["løk", "fløte", "hvitløk", "persille"], StockCoverage.Flatten(recipe).Select(i => i.Name));
    }

    // ── Week coverage ──────────────────────────────────────────────────────

    [Fact]
    public void BuildWeek_ClassifiesEachIngredient()
    {
        var stock = new[] { Stock("melk", 1, "l"), Stock("kyllingfilet") };
        var week = StockCoverage.BuildWeek(
            [Entry(0, "Gryte", Src("melk", 2, "dl"), Src("kylling"), Src("hvitløk"))], stock);

        var statuses = week.Entries.Single().Ingredients.ToDictionary(i => i.Name, i => i.Status);
        Assert.Equal("har", statuses["melk"]);
        Assert.Equal("kanskje", statuses["kylling"]);
        Assert.Equal("mangler", statuses["hvitløk"]);
    }

    [Fact]
    public void BuildWeek_CoveredIngredient_ShowsStockAmountBeside()
    {
        var week = StockCoverage.BuildWeek([Entry(0, "Gryte", Src("melk", 2, "dl"))], [Stock("melk", 1, "l")]);

        var ingredient = week.Entries.Single().Ingredients.Single();
        Assert.Equal(1, ingredient.StockQuantity);
        Assert.Equal("l", ingredient.StockUnit);
        Assert.NotNull(ingredient.StockItemId);
    }

    [Fact]
    public void BuildWeek_StapleCountsAsHave()
    {
        var week = StockCoverage.BuildWeek([Entry(0, "Gryte", Src("salt"))], [Stock("salt", staple: true)]);

        Assert.Equal("har", week.Entries.Single().Ingredients.Single().Status);
        Assert.Empty(week.Missing);
    }

    [Fact]
    public void BuildWeek_MissingIsMergedAcrossMealsOnNormalizedName()
    {
        var week = StockCoverage.BuildWeek(
        [
            Entry(0, "Pasta", Src("Revet ost", 100, "g")),
            Entry(1, "Pizza", Src("ost", 150, "g")),
        ], []);

        var missing = Assert.Single(week.Missing);
        Assert.Equal("ost", missing.NormalizedName);
        Assert.Equal("Revet ost", missing.Name);
        var amount = Assert.Single(missing.Quantities);
        Assert.Equal(250, amount.Quantity);
        Assert.Equal("g", amount.Unit);
        Assert.Equal(["Pasta", "Pizza"], missing.Recipes);
    }

    [Fact]
    public void BuildWeek_DifferentUnitsAreListedSeparately()
    {
        var week = StockCoverage.BuildWeek(
        [
            Entry(0, "Suppe", Src("fløte", 2, "dl")),
            Entry(1, "Saus", Src("fløte", 1, "pk")),
            Entry(2, "Dessert", Src("fløte", 3, "dl")),
        ], []);

        var quantities = Assert.Single(week.Missing).Quantities;
        Assert.Equal(2, quantities.Count);
        Assert.Equal(5, quantities.Single(q => q.Unit == "dl").Quantity);
        Assert.Equal(1, quantities.Single(q => q.Unit == "pk").Quantity);
    }

    [Fact]
    public void BuildWeek_SameRecipePlannedTwice_CountsTwice()
    {
        var week = StockCoverage.BuildWeek(
        [
            Entry(0, "Taco", Src("lefser", 8, "stk")),
            Entry(3, "Taco", Src("lefser", 8, "stk")),
        ], []);

        var missing = Assert.Single(week.Missing);
        Assert.Equal(16, Assert.Single(missing.Quantities).Quantity);
        Assert.Equal(["Taco"], missing.Recipes);
    }

    [Fact]
    public void BuildWeek_MissingComesBeforeMaybe()
    {
        var week = StockCoverage.BuildWeek(
            [Entry(0, "Gryte", Src("agurk"), Src("kylling"), Src("basilikum"))], [Stock("kyllingfilet")]);

        Assert.Equal(["mangler", "mangler", "kanskje"], week.Missing.Select(m => m.Status));
    }

    [Fact]
    public void BuildWeek_EntryWithoutIngredients_IsFlagged_AndAddsNothing()
    {
        var entry = new WeekEntryInput(1, Today, "HelloFresh-kasse", false, []);

        var week = StockCoverage.BuildWeek([entry], [Stock("melk")]);

        Assert.True(week.Entries.Single().WithoutIngredients);
        Assert.Empty(week.Missing);
    }

    [Fact]
    public void BuildWeek_SideDishIngredientsCarryTheirTitle()
    {
        var week = StockCoverage.BuildWeek(
            [Entry(0, "Kjøttkaker", Src("kjøttdeig"), Src("poteter", sideDish: "Kokte poteter"))], []);

        var ingredients = week.Entries.Single().Ingredients;
        Assert.Null(ingredients.Single(i => i.Name == "kjøttdeig").SideDishTitle);
        Assert.Equal("Kokte poteter", ingredients.Single(i => i.Name == "poteter").SideDishTitle);
    }

    [Fact]
    public void BuildWeek_OrdersEntriesByDate_AndSkipsBlankNames()
    {
        var week = StockCoverage.BuildWeek(
        [
            Entry(2, "Onsdag", Src("agurk")),
            Entry(0, "Mandag", Src("  "), Src("tomat")),
        ], []);

        Assert.Equal(["Mandag", "Onsdag"], week.Entries.Select(e => e.Title));
        Assert.Single(week.Entries[0].Ingredients);
    }

    // ── Suggestions ────────────────────────────────────────────────────────

    private static SuggestionRecipe Recipe(int id, string title, params string[] ingredients) =>
        new(id, title, null, ingredients.Select(n => Ing(n)).ToList());

    [Fact]
    public void Rank_OrdersByShareOfIngredientsAtHome()
    {
        var stock = new[] { Stock("egg"), Stock("melk"), Stock("mel") };

        var ranked = StockCoverage.Rank(
        [
            Recipe(1, "Halvveis", "egg", "melk", "sjokolade", "vaniljesukker"),
            Recipe(2, "Alt", "egg", "melk", "mel"),
        ], stock, Today, 10);

        Assert.Equal(["Alt", "Halvveis"], ranked.Select(r => r.Title));
        Assert.Equal(1.0, ranked[0].Score);
        Assert.Equal(0.5, ranked[1].Score);
        Assert.Equal(["sjokolade", "vaniljesukker"], ranked[1].Missing);
    }

    [Fact]
    public void Rank_PartialMatchCountsHalf()
    {
        var ranked = StockCoverage.Rank([Recipe(1, "Gryte", "kylling", "ris")], [Stock("kyllingfilet"), Stock("ris")], Today, 10);

        var dto = Assert.Single(ranked);
        Assert.Equal(0.75, dto.Score);
        Assert.Equal(1, dto.HaveCount);
        Assert.Equal(1, dto.MaybeCount);
    }

    [Fact]
    public void Rank_StaplesDoNotCountForOrAgainst()
    {
        var stock = new[] { Stock("salt", staple: true), Stock("egg") };

        var dto = Assert.Single(StockCoverage.Rank([Recipe(1, "Omelett", "egg", "salt")], stock, Today, 10));

        Assert.Equal(1.0, dto.Score);
        Assert.Equal(1, dto.HaveCount);
    }

    [Fact]
    public void Rank_RecipeOfOnlyStaples_IsSkipped()
    {
        var ranked = StockCoverage.Rank([Recipe(1, "Saltvann", "salt", "pepper")],
            [Stock("salt", staple: true), Stock("pepper", staple: true)], Today, 10);

        Assert.Empty(ranked);
    }

    [Fact]
    public void Rank_NoRealHit_IsSkipped()
    {
        var ranked = StockCoverage.Rank([Recipe(1, "Taco", "lefser", "kjøttdeig")], [Stock("melk")], Today, 10);

        Assert.Empty(ranked);
    }

    [Fact]
    public void Rank_ExpiringItemBreaksTiesInFavour()
    {
        var stock = new[]
        {
            Stock("fløte", bestBefore: Today.AddDays(2)),
            Stock("yoghurt", bestBefore: Today.AddDays(20)),
        };

        var ranked = StockCoverage.Rank([Recipe(1, "A-yoghurtrett", "yoghurt"), Recipe(2, "Z-fløterett", "fløte")], stock, Today, 10);

        Assert.Equal(["Z-fløterett", "A-yoghurtrett"], ranked.Select(r => r.Title));
        Assert.Equal(["fløte"], ranked[0].UsesExpiring);
        Assert.Empty(ranked[1].UsesExpiring);
    }

    [Fact]
    public void Rank_ExpiryBoostNeverBeatsAHigherScore()
    {
        var stock = new[] { Stock("fløte", bestBefore: Today), Stock("egg"), Stock("melk") };

        var ranked = StockCoverage.Rank(
            [Recipe(1, "Utgår snart", "fløte", "sjokolade"), Recipe(2, "Komplett", "egg", "melk")], stock, Today, 10);

        Assert.Equal("Komplett", ranked[0].Title);
    }

    [Fact]
    public void Rank_ExpiryCutoffIsInclusive_AndAlreadyExpiredCounts()
    {
        var stock = new[]
        {
            Stock("fløte", bestBefore: Today.AddDays(StockCoverage.ExpiringWithinDays)),
            Stock("smør", bestBefore: Today.AddDays(-1)),
            Stock("ost", bestBefore: Today.AddDays(StockCoverage.ExpiringWithinDays + 1)),
        };

        var ranked = StockCoverage.Rank([Recipe(1, "R", "fløte", "smør", "ost")], stock, Today, 10);

        Assert.Equal(["fløte", "smør"], ranked.Single().UsesExpiring.OrderBy(n => n, StringComparer.Ordinal));
    }

    [Fact]
    public void Rank_RespectsLimit()
    {
        var recipes = Enumerable.Range(1, 15).Select(i => Recipe(i, $"Rett {i:00}", "egg")).ToList();

        Assert.Equal(10, StockCoverage.Rank(recipes, [Stock("egg")], Today, 10).Count);
    }
}

public sealed class StockCoverageControllerTests : IDisposable
{
    private static readonly DateOnly Monday = new(2026, 10, 12);

    private readonly StockTestContext _ctx = new();

    public void Dispose() => _ctx.Dispose();

    private StockCoverageController Controller(string? email = StockTestContext.MemberEmail) =>
        StockTestContext.WithCaller(new StockCoverageController(_ctx.Db), email);

    private Recipe AddRecipe(string title, string visibility = "Public", int? groupId = null, params string[] ingredients)
    {
        var recipe = new Recipe
        {
            Title = title,
            Visibility = visibility,
            Ingredients = ingredients.Select(n => new StructuredIngredient { Name = n }).ToList(),
        };
        if (groupId != null) recipe.Groups.Add(new RecipeGroup { GroupId = groupId.Value });
        _ctx.Db.Recipes.Add(recipe);
        _ctx.Db.SaveChanges();
        return recipe;
    }

    private void AddStock(int groupId, string name) =>
        _ctx.Db.StockItems.Add(new StockItem
        {
            GroupId = groupId, Name = name, NormalizedName = IngredientMatcher.Normalize(name),
        });

    private static T Value<T>(ActionResult<T> result) =>
        (T)Assert.IsType<OkObjectResult>(result.Result).Value!;

    // ── Week coverage ──────────────────────────────────────────────────────

    [Fact]
    public async Task WeekCoverage_ReadsIngredientsSectionsAndSideDishes()
    {
        var main = AddRecipe("Kjøttkaker", ingredients: "kjøttdeig");
        main.IngredientSections = [new IngredientSection { Heading = "Saus", Ingredients = [new StructuredIngredient { Name = "brun saus" }] }];
        var side = AddRecipe("Kokte poteter", ingredients: "poteter");
        _ctx.Db.RecipeSideDishes.Add(new RecipeSideDish { RecipeId = main.Id, SideDishRecipeId = side.Id, SortOrder = 0 });
        _ctx.Db.MealPlans.Add(new MealPlan { GroupId = _ctx.GroupId, Date = Monday, RecipeId = main.Id });
        AddStock(_ctx.GroupId, "poteter");
        _ctx.Db.SaveChanges();

        var week = Value(await Controller().GetWeekCoverage(_ctx.GroupId, "2026-10-12"));

        var entry = Assert.Single(week.Entries);
        Assert.Equal("Kjøttkaker", entry.Title);
        Assert.Equal(["kjøttdeig", "brun saus", "poteter"], entry.Ingredients.Select(i => i.Name));
        var potatoes = entry.Ingredients.Single(i => i.Name == "poteter");
        Assert.Equal("har", potatoes.Status);
        Assert.Equal("Kokte poteter", potatoes.SideDishTitle);
        Assert.Equal(["brun saus", "kjøttdeig"], week.Missing.Select(m => m.NormalizedName));
    }

    [Fact]
    public async Task WeekCoverage_CustomEntry_IsFlaggedWithoutIngredients()
    {
        _ctx.Db.MealPlans.Add(new MealPlan { GroupId = _ctx.GroupId, Date = Monday, CustomTitle = "Rester" });
        _ctx.Db.SaveChanges();

        var week = Value(await Controller().GetWeekCoverage(_ctx.GroupId, "2026-10-12"));

        var entry = Assert.Single(week.Entries);
        Assert.Equal("Rester", entry.Title);
        Assert.True(entry.WithoutIngredients);
    }

    [Fact]
    public async Task WeekCoverage_OnlyCoversTheSevenDaysAndThisGroup()
    {
        var recipe = AddRecipe("Pasta", ingredients: "pasta");
        _ctx.Db.MealPlans.AddRange(
            new MealPlan { GroupId = _ctx.GroupId, Date = Monday.AddDays(6), RecipeId = recipe.Id },
            new MealPlan { GroupId = _ctx.GroupId, Date = Monday.AddDays(7), RecipeId = recipe.Id },
            new MealPlan { GroupId = _ctx.GroupId, Date = Monday.AddDays(-1), RecipeId = recipe.Id },
            new MealPlan { GroupId = _ctx.OtherGroupId, Date = Monday, RecipeId = recipe.Id });
        _ctx.Db.SaveChanges();

        var week = Value(await Controller().GetWeekCoverage(_ctx.GroupId, "2026-10-12"));

        Assert.Equal(Monday.AddDays(6).ToString("yyyy-MM-dd"), Assert.Single(week.Entries).Date);
    }

    [Fact]
    public async Task WeekCoverage_UsesOnlyThisGroupsStock()
    {
        var recipe = AddRecipe("Pasta", ingredients: "pasta");
        _ctx.Db.MealPlans.Add(new MealPlan { GroupId = _ctx.GroupId, Date = Monday, RecipeId = recipe.Id });
        AddStock(_ctx.OtherGroupId, "pasta");
        _ctx.Db.SaveChanges();

        var week = Value(await Controller().GetWeekCoverage(_ctx.GroupId, "2026-10-12"));

        Assert.Equal("mangler", week.Entries.Single().Ingredients.Single().Status);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("12.10.2026")]
    public async Task WeekCoverage_BadWeekStart_IsBadRequest(string? weekStart)
    {
        var result = await Controller().GetWeekCoverage(_ctx.GroupId, weekStart);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ── Suggestions ────────────────────────────────────────────────────────

    [Fact]
    public async Task Suggestions_OnlyIncludeRecipesVisibleToTheGroup()
    {
        AddRecipe("Offentlig", ingredients: "egg");
        AddRecipe("Vår gruppe", "Group", _ctx.GroupId, "egg");
        AddRecipe("Annen gruppe", "Group", _ctx.OtherGroupId, "egg");
        AddRecipe("Privat", "Private", null, "egg");
        AddStock(_ctx.GroupId, "egg");
        _ctx.Db.SaveChanges();

        var suggestions = Value(await Controller().GetSuggestions(_ctx.GroupId));

        Assert.Equal(["Offentlig", "Vår gruppe"], suggestions.Select(s => s.Title).OrderBy(t => t, StringComparer.Ordinal));
    }

    [Fact]
    public async Task Suggestions_ClampLimit()
    {
        for (var i = 0; i < 3; i++) AddRecipe($"Rett {i}", ingredients: "egg");
        AddStock(_ctx.GroupId, "egg");
        _ctx.Db.SaveChanges();

        Assert.Single(Value(await Controller().GetSuggestions(_ctx.GroupId, limit: 0)));
        Assert.Equal(3, Value(await Controller().GetSuggestions(_ctx.GroupId, limit: 1000)).Count);
    }

    // ── Access control ─────────────────────────────────────────────────────

    [Fact]
    public async Task NonMember_IsForbidden()
    {
        var outsider = Controller(StockTestContext.OutsiderEmail);

        Assert.Equal(403, ((ObjectResult)(await outsider.GetWeekCoverage(_ctx.GroupId, "2026-10-12")).Result!).StatusCode);
        Assert.Equal(403, ((ObjectResult)(await outsider.GetSuggestions(_ctx.GroupId)).Result!).StatusCode);
    }
}
