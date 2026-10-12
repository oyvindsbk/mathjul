using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Features.Stock;
using Xunit;

namespace RecipeApi.Tests.Stock;

public class ItemMergerTests
{
    private static ShoppingListItem Open(string name, decimal? qty = null, string? unit = null, string? note = null) => new()
    {
        Name = name, NormalizedName = IngredientMatcher.Normalize(name),
        Quantity = qty, Unit = unit, Note = note, Status = ShoppingListStatuses.Open,
    };

    private static StockItem Stock(string name, decimal? qty = null, string? unit = null,
        string location = StockLocations.Fridge, bool staple = false) => new()
    {
        Name = name, NormalizedName = IngredientMatcher.Normalize(name),
        Quantity = qty, Unit = unit, Location = location, IsStaple = staple,
    };

    // ── Shopping list ──────────────────────────────────────────────────────

    [Fact]
    public void ShoppingList_SameNameAndUnit_SumsQuantity()
    {
        var existing = Open("Melk", 1, "l");
        var list = new List<ShoppingListItem> { existing };

        var target = ItemMerger.MergeIntoShoppingList(list, Open("melk", 2, "L"));

        Assert.Same(existing, target);
        Assert.Single(list);
        Assert.Equal(3, existing.Quantity);
    }

    [Fact]
    public void ShoppingList_DifferentUnit_AddsSeparateRow()
    {
        var list = new List<ShoppingListItem> { Open("Melk", 1, "l") };
        var incoming = Open("Melk", 2, "pk");

        var target = ItemMerger.MergeIntoShoppingList(list, incoming);

        Assert.Same(incoming, target);
        Assert.Equal(2, list.Count);
    }

    [Fact]
    public void ShoppingList_NormalizedNamesMatch_AcrossPreparationWords()
    {
        var existing = Open("ost", 100, "g");
        var list = new List<ShoppingListItem> { existing };

        ItemMerger.MergeIntoShoppingList(list, Open("Revet ost", 50, "g"));

        Assert.Single(list);
        Assert.Equal(150, existing.Quantity);
    }

    [Fact]
    public void ShoppingList_BoughtItemIsNotMergedInto()
    {
        var bought = Open("Melk", 1, "l");
        bought.Status = ShoppingListStatuses.Bought;
        var list = new List<ShoppingListItem> { bought };

        var incoming = Open("Melk", 1, "l");
        var target = ItemMerger.MergeIntoShoppingList(list, incoming);

        Assert.Same(incoming, target);
        Assert.Equal(1, bought.Quantity);
    }

    [Fact]
    public void ShoppingList_UnknownQuantityDoesNotWipeKnownOne()
    {
        var existing = Open("Melk");
        var list = new List<ShoppingListItem> { existing };

        ItemMerger.MergeIntoShoppingList(list, Open("Melk", 2));

        Assert.Equal(2, existing.Quantity);
    }

    [Fact]
    public void ShoppingList_KeepsExistingNote_FillsMissingOne()
    {
        var withNote = Open("Melk", note: "lettmelk");
        ItemMerger.MergeIntoShoppingList([withNote], Open("Melk", note: "økologisk"));
        Assert.Equal("lettmelk", withNote.Note);

        var withoutNote = Open("Egg");
        ItemMerger.MergeIntoShoppingList([withoutNote], Open("Egg", note: "frittgående"));
        Assert.Equal("frittgående", withoutNote.Note);
    }

    // ── Stock ──────────────────────────────────────────────────────────────

    [Fact]
    public void Stock_SameNameUnitAndLocation_SumsQuantity()
    {
        var existing = Stock("Melk", 1, "l");

        var target = ItemMerger.MergeIntoStock([existing], Stock("Melk", 2, "l"));

        Assert.Same(existing, target);
        Assert.Equal(3, existing.Quantity);
    }

    [Fact]
    public void Stock_DifferentLocation_AddsSeparateRow()
    {
        var list = new List<StockItem> { Stock("Brød", 1, "stk", StockLocations.Pantry) };

        ItemMerger.MergeIntoStock(list, Stock("Brød", 1, "stk", StockLocations.Freezer));

        Assert.Equal(2, list.Count);
    }

    [Fact]
    public void Stock_MatchingStaple_IsLeftUntouched()
    {
        var salt = Stock("Salt", location: StockLocations.Pantry, staple: true);

        var target = ItemMerger.MergeIntoStock([salt], Stock("Salt", 500, "g", StockLocations.Pantry));

        Assert.Same(salt, target);
        Assert.Null(salt.Quantity);
    }
}

public sealed class ShoppingListControllerTests : IDisposable
{
    private readonly StockTestContext _ctx = new();

    public void Dispose() => _ctx.Dispose();

    private ShoppingListController Controller(string? email = StockTestContext.MemberEmail) =>
        StockTestContext.WithCaller(new ShoppingListController(_ctx.Db), email);

    private static ShoppingListItemRequest Req(string name, decimal? qty = null, string? unit = null,
        string? note = null, string? source = null) =>
        new() { Name = name, Quantity = qty, Unit = unit, Note = note, Source = source };

    private static AddShoppingListItemsRequest Add(params ShoppingListItemRequest[] items) => new() { Items = [.. items] };

    private ShoppingListItem Seed(int groupId, string name, string status = ShoppingListStatuses.Open,
        decimal? qty = null, string? unit = null)
    {
        var item = new ShoppingListItem
        {
            GroupId = groupId, Name = name, NormalizedName = IngredientMatcher.Normalize(name),
            Status = status, Quantity = qty, Unit = unit,
        };
        _ctx.Db.ShoppingListItems.Add(item);
        _ctx.Db.SaveChanges();
        return item;
    }

    private static T Value<T>(ActionResult<T> result) =>
        (T)Assert.IsType<OkObjectResult>(result.Result).Value!;

    // ── Add ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Add_CreatesItemsWithDefaults()
    {
        var result = await Controller().AddItems(_ctx.GroupId, Add(Req("  Melk ", 2, "l"), Req("Egg")));

        var dtos = Value(result);
        Assert.Equal(2, dtos.Count);
        var melk = await _ctx.Db.ShoppingListItems.SingleAsync(i => i.NormalizedName == "melk");
        Assert.Equal("Melk", melk.Name);
        Assert.Equal(ShoppingListSources.Manual, melk.Source);
        Assert.Equal(ShoppingListStatuses.Open, melk.Status);
        Assert.Equal(StockTestContext.MemberEmail, melk.CreatedByEmail);
    }

    [Fact]
    public async Task Add_MergesWithExistingOpenItem()
    {
        Seed(_ctx.GroupId, "Melk", qty: 1, unit: "l");

        var result = await Controller().AddItems(_ctx.GroupId, Add(Req("melk", 2, "l", source: ShoppingListSources.MealPlan)));

        Assert.Single(Value(result));
        var saved = await _ctx.Db.ShoppingListItems.SingleAsync();
        Assert.Equal(3, saved.Quantity);
        // The merged row keeps the origin it was created with.
        Assert.Equal(ShoppingListSources.Manual, saved.Source);
    }

    [Fact]
    public async Task Add_DuplicatesInsideOneRequest_AreMerged()
    {
        var result = await Controller().AddItems(_ctx.GroupId, Add(Req("Egg", 6, "stk"), Req("egg", 6, "stk")));

        Assert.Single(Value(result));
        Assert.Equal(12, (await _ctx.Db.ShoppingListItems.SingleAsync()).Quantity);
    }

    [Fact]
    public async Task Add_OneInvalidRow_SavesNothing()
    {
        var result = await Controller().AddItems(_ctx.GroupId, Add(Req("Melk"), Req("  ")));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Empty(_ctx.Db.ShoppingListItems);
    }

    [Fact]
    public async Task Add_EmptyRequest_IsBadRequest()
    {
        var result = await Controller().AddItems(_ctx.GroupId, Add());

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Add_InvalidSource_IsBadRequest()
    {
        var result = await Controller().AddItems(_ctx.GroupId, Add(Req("Melk", source: "oda")));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ── Get ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Get_FiltersByStatus_AndOnlyReturnsThisGroup()
    {
        Seed(_ctx.GroupId, "Melk");
        Seed(_ctx.GroupId, "Smør", ShoppingListStatuses.Bought);
        Seed(_ctx.OtherGroupId, "Naboens egg");

        var open = Value(await Controller().GetShoppingList(_ctx.GroupId, ShoppingListStatuses.Open));
        var all = Value(await Controller().GetShoppingList(_ctx.GroupId));

        Assert.Equal(["Melk"], open.Select(i => i.Name));
        Assert.Equal(["Melk", "Smør"], all.Select(i => i.Name));
    }

    [Fact]
    public async Task Get_InvalidStatus_IsBadRequest()
    {
        var result = await Controller().GetShoppingList(_ctx.GroupId, "i-kurv");

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ── Patch ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Patch_MarkingBought_SetsBoughtAt_AndReopeningClearsIt()
    {
        var item = Seed(_ctx.GroupId, "Melk");

        await Controller().UpdateItem(_ctx.GroupId, item.Id, new UpdateShoppingListItemRequest { Status = ShoppingListStatuses.Bought });
        Assert.NotNull((await _ctx.Db.ShoppingListItems.SingleAsync()).BoughtAt);

        await Controller().UpdateItem(_ctx.GroupId, item.Id, new UpdateShoppingListItemRequest { Status = ShoppingListStatuses.Open });
        Assert.Null((await _ctx.Db.ShoppingListItems.SingleAsync()).BoughtAt);
    }

    [Fact]
    public async Task Patch_NullFieldsAreLeftUntouched_AndRenameRecomputesNormalizedName()
    {
        var item = Seed(_ctx.GroupId, "Melk", qty: 2, unit: "l");

        await Controller().UpdateItem(_ctx.GroupId, item.Id, new UpdateShoppingListItemRequest { Name = "Revet ost" });

        var saved = await _ctx.Db.ShoppingListItems.SingleAsync();
        Assert.Equal("Revet ost", saved.Name);
        Assert.Equal("ost", saved.NormalizedName);
        Assert.Equal(2, saved.Quantity);
        Assert.Equal("l", saved.Unit);
    }

    [Fact]
    public async Task Patch_InvalidStatus_IsBadRequest()
    {
        var item = Seed(_ctx.GroupId, "Melk");

        var result = await Controller().UpdateItem(_ctx.GroupId, item.Id, new UpdateShoppingListItemRequest { Status = "i-kurv" });

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Patch_ItemInAnotherGroup_IsNotFound()
    {
        var foreign = Seed(_ctx.OtherGroupId, "Egg");

        var result = await Controller().UpdateItem(_ctx.GroupId, foreign.Id, new UpdateShoppingListItemRequest { Name = "X" });

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    // ── Delete ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Delete_RemovesOnlyThatItem()
    {
        var item = Seed(_ctx.GroupId, "Melk");
        Seed(_ctx.GroupId, "Egg");

        Assert.IsType<NoContentResult>(await Controller().DeleteItem(_ctx.GroupId, item.Id));
        Assert.Equal("Egg", (await _ctx.Db.ShoppingListItems.SingleAsync()).Name);
    }

    [Fact]
    public async Task ClearBought_RemovesOnlyBoughtItemsInThisGroup()
    {
        Seed(_ctx.GroupId, "Melk");
        Seed(_ctx.GroupId, "Smør", ShoppingListStatuses.Bought);
        Seed(_ctx.OtherGroupId, "Naboens egg", ShoppingListStatuses.Bought);

        var result = await Controller().ClearBought(_ctx.GroupId, ShoppingListStatuses.Bought);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(["Melk", "Naboens egg"], _ctx.Db.ShoppingListItems.Select(i => i.Name).OrderBy(n => n));
    }

    [Theory]
    [InlineData(null)]
    [InlineData(ShoppingListStatuses.Open)]
    public async Task ClearBought_AnythingButBought_IsRefused(string? status)
    {
        Seed(_ctx.GroupId, "Melk");

        var result = await Controller().ClearBought(_ctx.GroupId, status);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Single(_ctx.Db.ShoppingListItems);
    }

    // ── Move to stock ──────────────────────────────────────────────────────

    [Fact]
    public async Task MoveToStock_CreatesStockAndRemovesBoughtFromList()
    {
        Seed(_ctx.GroupId, "Melk", ShoppingListStatuses.Bought, 2, "l");
        Seed(_ctx.GroupId, "Egg");

        var result = await Controller().MoveBoughtToStock(_ctx.GroupId, new MoveToStockRequest { Location = StockLocations.Fridge });

        Assert.IsType<OkObjectResult>(result);
        var stock = await _ctx.Db.StockItems.SingleAsync();
        Assert.Equal("Melk", stock.Name);
        Assert.Equal(2, stock.Quantity);
        Assert.Equal(StockLocations.Fridge, stock.Location);
        Assert.Equal(_ctx.GroupId, stock.GroupId);
        Assert.Equal("Egg", (await _ctx.Db.ShoppingListItems.SingleAsync()).Name);
    }

    [Fact]
    public async Task MoveToStock_SumsIntoExistingStockItem()
    {
        _ctx.Db.StockItems.Add(new StockItem
        {
            GroupId = _ctx.GroupId, Name = "Melk", NormalizedName = "melk",
            Quantity = 1, Unit = "l", Location = StockLocations.Fridge,
        });
        _ctx.Db.SaveChanges();
        Seed(_ctx.GroupId, "Melk", ShoppingListStatuses.Bought, 2, "l");

        await Controller().MoveBoughtToStock(_ctx.GroupId, new MoveToStockRequest { Location = StockLocations.Fridge });

        Assert.Equal(3, (await _ctx.Db.StockItems.SingleAsync()).Quantity);
    }

    [Fact]
    public async Task MoveToStock_InvalidLocation_ChangesNothing()
    {
        Seed(_ctx.GroupId, "Melk", ShoppingListStatuses.Bought);

        var result = await Controller().MoveBoughtToStock(_ctx.GroupId, new MoveToStockRequest { Location = "garasjen" });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(_ctx.Db.StockItems);
        Assert.Single(_ctx.Db.ShoppingListItems);
    }

    // ── Access control ─────────────────────────────────────────────────────

    [Fact]
    public async Task NonMember_IsForbiddenOnEveryEndpoint()
    {
        var item = Seed(_ctx.GroupId, "Melk");
        var outsider = Controller(StockTestContext.OutsiderEmail);

        Assert.Equal(403, ((ObjectResult)(await outsider.GetShoppingList(_ctx.GroupId)).Result!).StatusCode);
        Assert.Equal(403, ((ObjectResult)(await outsider.AddItems(_ctx.GroupId, Add(Req("X")))).Result!).StatusCode);
        Assert.Equal(403, ((ObjectResult)(await outsider.UpdateItem(_ctx.GroupId, item.Id, new UpdateShoppingListItemRequest())).Result!).StatusCode);
        Assert.Equal(403, ((ObjectResult)await outsider.DeleteItem(_ctx.GroupId, item.Id)).StatusCode);
        Assert.Equal(403, ((ObjectResult)await outsider.ClearBought(_ctx.GroupId, ShoppingListStatuses.Bought)).StatusCode);
        Assert.Equal(403, ((ObjectResult)await outsider.MoveBoughtToStock(_ctx.GroupId, new MoveToStockRequest { Location = StockLocations.Fridge })).StatusCode);
        Assert.Single(_ctx.Db.ShoppingListItems);
    }
}
