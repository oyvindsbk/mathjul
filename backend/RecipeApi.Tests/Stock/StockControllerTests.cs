using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Features.Stock;
using Xunit;

namespace RecipeApi.Tests.Stock;

public sealed class StockControllerTests : IDisposable
{
    private readonly StockTestContext _ctx = new();

    public void Dispose() => _ctx.Dispose();

    private StockController Controller(string? email = StockTestContext.MemberEmail) =>
        StockTestContext.WithCaller(new StockController(_ctx.Db), email);

    private static StockItemRequest Request(
        string name = "Melk", decimal? quantity = 1, string? unit = "l",
        string location = StockLocations.Fridge, string? bestBefore = null, bool staple = false) => new()
    {
        Name = name, Quantity = quantity, Unit = unit, Location = location,
        BestBefore = bestBefore, IsStaple = staple,
    };

    private StockItem Seed(int groupId, string name = "Egg", string location = StockLocations.Fridge)
    {
        var item = new StockItem
        {
            GroupId = groupId, Name = name, NormalizedName = IngredientMatcher.Normalize(name), Location = location,
        };
        _ctx.Db.StockItems.Add(item);
        _ctx.Db.SaveChanges();
        return item;
    }

    // ── Create ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_StoresTrimmedNameAndNormalizedName()
    {
        var result = await Controller().CreateStockItem(_ctx.GroupId, Request(name: "  Revet Ost "));

        var dto = Assert.IsType<OkObjectResult>(result.Result).Value as StockItemDto;
        Assert.NotNull(dto);
        Assert.Equal("Revet Ost", dto.Name);

        var saved = await _ctx.Db.StockItems.SingleAsync();
        Assert.Equal("ost", saved.NormalizedName);
        Assert.Equal(_ctx.GroupId, saved.GroupId);
        Assert.Equal(StockTestContext.MemberEmail, saved.UpdatedByEmail);
    }

    [Fact]
    public async Task Create_ParsesBestBeforeAndBlanksEmptyUnit()
    {
        await Controller().CreateStockItem(_ctx.GroupId, Request(unit: "  ", bestBefore: "2026-10-15"));

        var saved = await _ctx.Db.StockItems.SingleAsync();
        Assert.Equal(new DateOnly(2026, 10, 15), saved.BestBefore);
        Assert.Null(saved.Unit);
    }

    [Fact]
    public async Task Create_Staple_DropsQuantityAndUnit()
    {
        await Controller().CreateStockItem(_ctx.GroupId,
            Request(name: "Salt", quantity: 500, unit: "g", location: StockLocations.Pantry, staple: true));

        var saved = await _ctx.Db.StockItems.SingleAsync();
        Assert.True(saved.IsStaple);
        Assert.Null(saved.Quantity);
        Assert.Null(saved.Unit);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Create_BlankName_IsBadRequest(string name)
    {
        var result = await Controller().CreateStockItem(_ctx.GroupId, Request(name: name));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Empty(_ctx.Db.StockItems);
    }

    [Fact]
    public async Task Create_NegativeQuantity_IsBadRequest()
    {
        var result = await Controller().CreateStockItem(_ctx.GroupId, Request(quantity: -1));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_InvalidLocation_IsBadRequest()
    {
        var result = await Controller().CreateStockItem(_ctx.GroupId, Request(location: "garasjen"));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Empty(_ctx.Db.StockItems);
    }

    [Theory]
    [InlineData("15.10.2026")]
    [InlineData("i morgen")]
    public async Task Create_InvalidBestBefore_IsBadRequest(string bestBefore)
    {
        var result = await Controller().CreateStockItem(_ctx.GroupId, Request(bestBefore: bestBefore));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_TooLongName_IsBadRequest()
    {
        var result = await Controller().CreateStockItem(_ctx.GroupId, Request(name: new string('a', 101)));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ── Read ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Get_ReturnsOnlyThisGroupsItems_SortedByLocationThenName()
    {
        Seed(_ctx.GroupId, "Yoghurt");
        Seed(_ctx.GroupId, "Erter", StockLocations.Freezer);
        Seed(_ctx.GroupId, "Egg");
        Seed(_ctx.OtherGroupId, "Naboens smør");

        var result = await Controller().GetStock(_ctx.GroupId);

        var items = Assert.IsType<OkObjectResult>(result.Result).Value as List<StockItemDto>;
        Assert.NotNull(items);
        // Fridge before freezer, even though "fryser" sorts before "kjoleskap" alphabetically.
        Assert.Equal(["Egg", "Yoghurt", "Erter"], items.Select(i => i.Name));
    }

    // ── Update ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_ChangesFieldsAndRecomputesNormalizedName()
    {
        var item = Seed(_ctx.GroupId, "Melk");

        var result = await Controller().UpdateStockItem(_ctx.GroupId, item.Id,
            Request(name: "Revet Ost", quantity: 2, unit: "pk", location: StockLocations.Freezer));

        Assert.IsType<OkObjectResult>(result.Result);
        var saved = await _ctx.Db.StockItems.SingleAsync();
        Assert.Equal("Revet Ost", saved.Name);
        Assert.Equal("ost", saved.NormalizedName);
        Assert.Equal(2, saved.Quantity);
        Assert.Equal(StockLocations.Freezer, saved.Location);
    }

    [Fact]
    public async Task Update_InvalidRequest_LeavesItemUntouched()
    {
        var item = Seed(_ctx.GroupId, "Melk");

        var result = await Controller().UpdateStockItem(_ctx.GroupId, item.Id, Request(name: "Ny", location: "garasjen"));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal("Melk", (await _ctx.Db.StockItems.SingleAsync()).Name);
    }

    [Fact]
    public async Task Update_ItemInAnotherGroup_IsNotFound()
    {
        var foreign = Seed(_ctx.OtherGroupId, "Naboens smør");

        var result = await Controller().UpdateStockItem(_ctx.GroupId, foreign.Id, Request(name: "Hijacked"));

        Assert.IsType<NotFoundObjectResult>(result.Result);
        Assert.Equal("Naboens smør", (await _ctx.Db.StockItems.SingleAsync()).Name);
    }

    // ── Delete ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Delete_RemovesItem()
    {
        var item = Seed(_ctx.GroupId);

        var result = await Controller().DeleteStockItem(_ctx.GroupId, item.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(_ctx.Db.StockItems);
    }

    [Fact]
    public async Task Delete_ItemInAnotherGroup_IsNotFoundAndKept()
    {
        var foreign = Seed(_ctx.OtherGroupId);

        var result = await Controller().DeleteStockItem(_ctx.GroupId, foreign.Id);

        Assert.IsType<NotFoundObjectResult>(result);
        Assert.Single(_ctx.Db.StockItems);
    }

    // ── Access control ─────────────────────────────────────────────────────

    [Fact]
    public async Task NonMember_IsForbiddenOnEveryEndpoint()
    {
        var item = Seed(_ctx.GroupId);
        var outsider = Controller(StockTestContext.OutsiderEmail);

        Assert.Equal(403, ((ObjectResult)(await outsider.GetStock(_ctx.GroupId)).Result!).StatusCode);
        Assert.Equal(403, ((ObjectResult)(await outsider.CreateStockItem(_ctx.GroupId, Request())).Result!).StatusCode);
        Assert.Equal(403, ((ObjectResult)(await outsider.UpdateStockItem(_ctx.GroupId, item.Id, Request())).Result!).StatusCode);
        Assert.Equal(403, ((ObjectResult)await outsider.DeleteStockItem(_ctx.GroupId, item.Id)).StatusCode);
        Assert.Single(_ctx.Db.StockItems);
    }

    [Fact]
    public async Task MemberOfAnotherGroup_CannotUseThisGroup()
    {
        var result = await Controller().GetStock(_ctx.OtherGroupId);

        Assert.Equal(403, ((ObjectResult)result.Result!).StatusCode);
    }

    [Fact]
    public async Task Anonymous_IsUnauthorized()
    {
        var result = await Controller(null).GetStock(_ctx.GroupId);

        Assert.IsType<UnauthorizedResult>(result.Result);
    }
}
