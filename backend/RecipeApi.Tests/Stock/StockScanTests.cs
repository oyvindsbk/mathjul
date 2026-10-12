using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RecipeApi.Features.Stock;
using ImageMagick;
using Xunit;

namespace RecipeApi.Tests.Stock;

public class StockScanParserTests
{
    [Fact]
    public void TryParse_ReadsItems()
    {
        var ok = StockScanParser.TryParse("""
            { "items": [
              { "name": "melk", "quantity": 2, "unit": "l" },
              { "name": "smør", "quantity": null, "unit": null }
            ] }
            """, out var items);

        Assert.True(ok);
        Assert.Equal(2, items.Count);
        Assert.Equal(("melk", 2m, "l"), (items[0].Name, items[0].Quantity, items[0].Unit));
        Assert.Null(items[1].Quantity);
        Assert.Null(items[1].Unit);
    }

    [Fact]
    public void TryParse_EmptyList_IsValidAndEmpty()
    {
        Assert.True(StockScanParser.TryParse("""{ "items": [] }""", out var items));
        Assert.Empty(items);
    }

    [Fact]
    public void TryParse_DropsBlankNames_NegativeQuantities_AndTrimsOversizedFields()
    {
        var longName = new string('a', 150);
        StockScanParser.TryParse($$"""
            { "items": [
              { "name": "  ", "quantity": 1, "unit": "stk" },
              { "name": "  egg ", "quantity": -3, "unit": "  " },
              { "name": "{{longName}}", "quantity": 1, "unit": "{{new string('x', 40)}}" }
            ] }
            """, out var items);

        Assert.Equal(2, items.Count);
        Assert.Equal("egg", items[0].Name);
        Assert.Null(items[0].Quantity);
        Assert.Null(items[0].Unit);
        Assert.Equal(StockFields.MaxNameLength, items[1].Name.Length);
        Assert.Equal(StockFields.MaxUnitLength, items[1].Unit!.Length);
    }

    [Fact]
    public void TryParse_TolerantOfOddRows()
    {
        StockScanParser.TryParse("""
            { "items": [ "melk", { "name": 5 }, { "name": "egg", "quantity": "mange", "unit": 3 } ] }
            """, out var items);

        var egg = Assert.Single(items);
        Assert.Equal("egg", egg.Name);
        Assert.Null(egg.Quantity);
        Assert.Null(egg.Unit);
    }

    [Fact]
    public void TryParse_CapsAtMaxItems()
    {
        var rows = string.Join(",", Enumerable.Range(0, 150).Select(i => $$"""{ "name": "vare {{i}}", "quantity": 1, "unit": "stk" }"""));

        StockScanParser.TryParse($$"""{ "items": [ {{rows}} ] }""", out var items);

        Assert.Equal(DraftItems.MaxItems, items.Count);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("ikke json")]
    [InlineData("[]")]
    [InlineData("""{ "oppskrifter": [] }""")]
    [InlineData("""{ "items": "melk" }""")]
    [InlineData("""{ "items": [ { "name": "melk" """)]
    public void TryParse_MalformedContent_ReturnsFalse(string? content)
    {
        Assert.False(StockScanParser.TryParse(content, out var items));
        Assert.Empty(items);
    }
}

public class StockImagesTests
{
    private static IFormFile File(byte[] bytes, string contentType = "image/png", string name = "bilde.png") =>
        new FormFile(new MemoryStream(bytes), 0, bytes.Length, "images", name)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType,
        };

    private static byte[] Png(int width, int height)
    {
        using var image = new MagickImage(MagickColors.White, (uint)width, (uint)height);
        image.Format = MagickFormat.Png;
        return image.ToByteArray();
    }

    // ── Validate ───────────────────────────────────────────────────────────

    [Fact]
    public void Validate_AcceptsOneToFourImages()
    {
        Assert.Null(StockImages.Validate([File([1])]));
        Assert.Null(StockImages.Validate([File([1]), File([1]), File([1]), File([1])]));
    }

    [Fact]
    public void Validate_RejectsNoImages_AndTooMany()
    {
        Assert.NotNull(StockImages.Validate([]));
        Assert.NotNull(StockImages.Validate(Enumerable.Range(0, 5).Select(_ => File([1])).ToList()));
    }

    [Fact]
    public void Validate_RejectsEmptyFile()
    {
        Assert.NotNull(StockImages.Validate([File([])]));
    }

    [Fact]
    public void Validate_RejectsOversizedFile()
    {
        var big = new FormFile(Stream.Null, 0, StockImages.MaxFileSizeBytes + 1, "images", "stor.jpg")
        {
            Headers = new HeaderDictionary(),
            ContentType = "image/jpeg",
        };

        Assert.Contains("for stort", StockImages.Validate([big]));
    }

    [Theory]
    [InlineData("application/pdf")]
    [InlineData("image/gif")]
    [InlineData("text/plain")]
    public void Validate_RejectsOtherContentTypes(string contentType)
    {
        Assert.NotNull(StockImages.Validate([File([1], contentType)]));
    }

    [Fact]
    public void Validate_ContentTypeIsCaseInsensitive()
    {
        Assert.Null(StockImages.Validate([File([1], "IMAGE/JPEG")]));
    }

    // ── Prepare ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Prepare_ScalesLargeImageDownKeepingAspectRatio()
    {
        var bytes = await StockImages.PrepareAsync(File(Png(3072, 1024)));

        Assert.NotNull(bytes);
        var info = new MagickImageInfo(bytes);
        Assert.Equal((uint)StockImages.MaxDimension, info.Width);
        Assert.Equal(512u, info.Height);
    }

    [Fact]
    public async Task Prepare_DoesNotUpscaleSmallImage()
    {
        var bytes = await StockImages.PrepareAsync(File(Png(400, 300)));

        var info = new MagickImageInfo(bytes!);
        Assert.Equal((400u, 300u), (info.Width, info.Height));
    }

    [Fact]
    public async Task Prepare_AlwaysReturnsJpeg()
    {
        var bytes = await StockImages.PrepareAsync(File(Png(50, 50)));

        Assert.Equal(MagickFormat.Jpeg, new MagickImageInfo(bytes!).Format);
    }

    [Fact]
    public async Task Prepare_UnreadableBytes_ReturnsNull()
    {
        Assert.Null(await StockImages.PrepareAsync(File([1, 2, 3, 4, 5])));
    }
}

public class StockScanApplierTests
{
    private const int GroupId = 1;
    private static readonly DateTime Now = new(2026, 10, 12, 8, 0, 0, DateTimeKind.Utc);

    private static StockItem Existing(int id, string name, decimal? qty = null, string? unit = null,
        bool staple = false, string location = StockLocations.Fridge) => new()
    {
        Id = id, GroupId = GroupId, Name = name, NormalizedName = IngredientMatcher.Normalize(name),
        Quantity = qty, Unit = unit, IsStaple = staple, Location = location,
    };

    private static DraftItem Row(string name, decimal? qty = null, string? unit = null) =>
        new() { Name = name, Quantity = qty, Unit = unit };

    private static ScanApplyResult Apply(string mode, DraftItem[] draft, StockItem[] existing, int[]? keep = null) =>
        StockScanApplier.Apply(GroupId, StockLocations.Fridge, mode, draft, existing, keep ?? [], "me@example.com", Now);

    // ── Add mode ───────────────────────────────────────────────────────────

    [Fact]
    public void Add_CreatesNewItems()
    {
        var result = Apply(ScanApplyModes.Add, [Row(" Melk ", 2, "l")], []);

        var item = Assert.Single(result.Added);
        Assert.Equal("Melk", item.Name);
        Assert.Equal("melk", item.NormalizedName);
        Assert.Equal(2, item.Quantity);
        Assert.Equal(StockLocations.Fridge, item.Location);
        Assert.Equal(GroupId, item.GroupId);
        Assert.Equal("me@example.com", item.UpdatedByEmail);
        Assert.Equal(Now, item.CreatedAt);
    }

    [Fact]
    public void Add_ExistingItem_GetsScannedQuantity_NotASum()
    {
        var milk = Existing(1, "Melk", 1, "l");

        var result = Apply(ScanApplyModes.Add, [Row("melk", 2, "L")], [milk]);

        Assert.Empty(result.Added);
        Assert.Same(milk, Assert.Single(result.Updated));
        Assert.Equal(2, milk.Quantity);
        Assert.Equal(Now, milk.UpdatedAt);
    }

    [Fact]
    public void Add_SameQuantity_IsNotReportedAsUpdate()
    {
        var result = Apply(ScanApplyModes.Add, [Row("melk", 1, "l")], [Existing(1, "Melk", 1, "l")]);

        Assert.Empty(result.Added);
        Assert.Empty(result.Updated);
    }

    [Fact]
    public void Add_DraftWithoutQuantity_KeepsExistingAmount()
    {
        var milk = Existing(1, "Melk", 3, "l");

        Apply(ScanApplyModes.Add, [Row("melk")], [milk]);

        Assert.Equal(3, milk.Quantity);
    }

    [Fact]
    public void Add_DraftWithoutUnit_MatchesByNameButLeavesAmountAlone()
    {
        var milk = Existing(1, "Melk", 1, "l");

        var result = Apply(ScanApplyModes.Add, [Row("melk", 2)], [milk]);

        Assert.Empty(result.Added);
        Assert.Empty(result.Updated);
        Assert.Equal(1, milk.Quantity);
    }

    [Fact]
    public void Add_DifferentUnit_CreatesSeparateItem()
    {
        var result = Apply(ScanApplyModes.Add, [Row("melk", 1, "pk")], [Existing(1, "Melk", 1, "l")]);

        Assert.Single(result.Added);
    }

    [Fact]
    public void Add_NeverRemoves()
    {
        var result = Apply(ScanApplyModes.Add, [Row("egg", 6, "stk")], [Existing(1, "Melk", 1, "l")]);

        Assert.Empty(result.Removed);
    }

    [Fact]
    public void Add_DuplicateRowsInDraft_AreCombinedFirst()
    {
        var result = Apply(ScanApplyModes.Add, [Row("egg", 6, "stk"), Row("Egg", 6, "stk")], []);

        var egg = Assert.Single(result.Added);
        Assert.Equal(12, egg.Quantity);
    }

    [Fact]
    public void Add_StapleIsNeverGivenAQuantity()
    {
        var salt = Existing(1, "Salt", staple: true, location: StockLocations.Fridge);

        var result = Apply(ScanApplyModes.Add, [Row("salt", 500, "g")], [salt]);

        Assert.Empty(result.Added);
        Assert.Empty(result.Updated);
        Assert.Null(salt.Quantity);
    }

    // ── Replace mode ───────────────────────────────────────────────────────

    [Fact]
    public void Replace_RemovesItemsMissingFromDraft()
    {
        var milk = Existing(1, "Melk", 1, "l");
        var butter = Existing(2, "Smør");

        var result = Apply(ScanApplyModes.Replace, [Row("melk", 1, "l")], [milk, butter]);

        Assert.Same(butter, Assert.Single(result.Removed));
    }

    [Fact]
    public void Replace_KeepIdsSurvive()
    {
        var milk = Existing(1, "Melk");
        var butter = Existing(2, "Smør");

        var result = Apply(ScanApplyModes.Replace, [Row("egg", 6, "stk")], [milk, butter], keep: [2]);

        Assert.Same(milk, Assert.Single(result.Removed));
    }

    [Fact]
    public void Replace_NeverRemovesStaples()
    {
        var salt = Existing(1, "Salt", staple: true);

        var result = Apply(ScanApplyModes.Replace, [Row("egg", 6, "stk")], [salt]);

        Assert.Empty(result.Removed);
    }

    [Fact]
    public void Replace_StillAddsAndUpdates()
    {
        var milk = Existing(1, "Melk", 1, "l");

        var result = Apply(ScanApplyModes.Replace, [Row("melk", 2, "l"), Row("egg", 6, "stk")], [milk]);

        Assert.Single(result.Added);
        Assert.Single(result.Updated);
        Assert.Empty(result.Removed);
    }

    [Fact]
    public void Replace_ItemMatchedLooselyByName_IsNotRemoved()
    {
        var milk = Existing(1, "Melk", 1, "l");

        var result = Apply(ScanApplyModes.Replace, [Row("melk")], [milk]);

        Assert.Empty(result.Removed);
    }
}

public sealed class StockScanControllerTests : IDisposable
{
    private readonly StockTestContext _ctx = new();
    private readonly FakeScanProcessor _processor = new();

    public void Dispose() => _ctx.Dispose();

    private sealed class FakeScanProcessor : IStockScanProcessor
    {
        public StockScanResult Result { get; set; } = StockScanResult.Success([new DraftItem { Name = "melk", Quantity = 1, Unit = "l" }]);
        public int Calls { get; private set; }
        public string? LastLocation { get; private set; }

        public Task<StockScanResult> ScanAsync(IReadOnlyList<IFormFile> images, string location, CancellationToken cancellationToken = default)
        {
            Calls++;
            LastLocation = location;
            return Task.FromResult(Result);
        }
    }

    private StockScanController Controller(string? email = StockTestContext.MemberEmail) =>
        StockTestContext.WithCaller(
            new StockScanController(_ctx.Db, _processor, NullLogger<StockScanController>.Instance), email);

    private static FormFileCollection Files(int count)
    {
        var files = new FormFileCollection();
        for (var i = 0; i < count; i++)
        {
            files.Add(new FormFile(new MemoryStream([1, 2, 3]), 0, 3, "images", $"{i}.jpg")
            {
                Headers = new HeaderDictionary(),
                ContentType = "image/jpeg",
            });
        }
        return files;
    }

    private void SeedStock(string name, decimal? qty = null, string? unit = null, string location = StockLocations.Fridge, int? groupId = null)
    {
        _ctx.Db.StockItems.Add(new StockItem
        {
            GroupId = groupId ?? _ctx.GroupId, Name = name, NormalizedName = IngredientMatcher.Normalize(name),
            Quantity = qty, Unit = unit, Location = location,
        });
        _ctx.Db.SaveChanges();
    }

    private static ApplyScanRequest Request(string mode, params DraftItem[] items) =>
        new() { Location = StockLocations.Fridge, Mode = mode, Items = [.. items] };

    // ── Scan ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Scan_ReturnsDraft_AndSavesNothing()
    {
        var result = await Controller().Scan(_ctx.GroupId, StockLocations.Fridge, Files(2), default);

        var response = Assert.IsType<OkObjectResult>(result.Result).Value as StockDraftResponse;
        Assert.Equal("melk", Assert.Single(response!.Items).Name);
        Assert.Equal(StockLocations.Fridge, _processor.LastLocation);
        Assert.Empty(_ctx.Db.StockItems);
    }

    [Fact]
    public async Task Scan_ProcessorFailure_IsBadRequestWithItsMessage()
    {
        _processor.Result = StockScanResult.Failure("Fant ingen matvarer i bildene");

        var result = await Controller().Scan(_ctx.GroupId, StockLocations.Fridge, Files(1), default);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Scan_InvalidLocation_NeverCallsTheModel()
    {
        var result = await Controller().Scan(_ctx.GroupId, "garasjen", Files(1), default);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(0, _processor.Calls);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(5)]
    public async Task Scan_WrongNumberOfImages_NeverCallsTheModel(int count)
    {
        var result = await Controller().Scan(_ctx.GroupId, StockLocations.Fridge, Files(count), default);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(0, _processor.Calls);
    }

    [Fact]
    public async Task Scan_NonMember_IsForbiddenAndNeverCallsTheModel()
    {
        var result = await Controller(StockTestContext.OutsiderEmail).Scan(_ctx.GroupId, StockLocations.Fridge, Files(1), default);

        Assert.Equal(403, ((ObjectResult)result.Result!).StatusCode);
        Assert.Equal(0, _processor.Calls);
    }

    [Fact]
    public async Task DisabledProcessor_SaysScanningIsNotConfigured()
    {
        var result = await new DisabledStockScanProcessor().ScanAsync(Files(1), StockLocations.Fridge);

        Assert.False(result.IsSuccess);
        Assert.Contains("ikke konfigurert", result.ErrorMessage);
    }

    // ── Apply ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Apply_AddMode_PersistsNewAndUpdatedItems()
    {
        SeedStock("Melk", 1, "l");

        var result = await Controller().Apply(_ctx.GroupId, Request(ScanApplyModes.Add,
            new DraftItem { Name = "melk", Quantity = 2, Unit = "l" },
            new DraftItem { Name = "egg", Quantity = 6, Unit = "stk" }));

        var response = Assert.IsType<OkObjectResult>(result.Result).Value as ApplyScanResponse;
        Assert.Equal((1, 1, 0), (response!.Added, response.Updated, response.Removed));
        Assert.Equal(2, await _ctx.Db.StockItems.CountAsync());
        Assert.Equal(2, (await _ctx.Db.StockItems.SingleAsync(s => s.NormalizedName == "melk")).Quantity);
    }

    [Fact]
    public async Task Apply_ReplaceMode_DeletesWhatIsMissing_ButNotKeepIds_NorOtherLocations()
    {
        SeedStock("Melk");
        SeedStock("Smør");
        SeedStock("Yoghurt");
        SeedStock("Erter", location: StockLocations.Freezer);
        var keepId = (await _ctx.Db.StockItems.SingleAsync(s => s.Name == "Smør")).Id;

        var request = Request(ScanApplyModes.Replace, new DraftItem { Name = "egg", Quantity = 6, Unit = "stk" });
        request.KeepIds = [keepId];
        await Controller().Apply(_ctx.GroupId, request);

        var names = _ctx.Db.StockItems.Select(s => s.Name).OrderBy(n => n).ToList();
        Assert.Equal(["egg", "Erter", "Smør"], names);
    }

    [Fact]
    public async Task Apply_ReplaceMode_NeverTouchesAnotherGroupsStock()
    {
        SeedStock("Naboens melk", groupId: _ctx.OtherGroupId);

        await Controller().Apply(_ctx.GroupId, Request(ScanApplyModes.Replace, new DraftItem { Name = "egg" }));

        Assert.Contains(_ctx.Db.StockItems, s => s.Name == "Naboens melk");
    }

    [Fact]
    public async Task Apply_EmptyDraft_IsRefused_SoReplaceCannotWipeALocation()
    {
        SeedStock("Melk");

        var result = await Controller().Apply(_ctx.GroupId, Request(ScanApplyModes.Replace));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Single(_ctx.Db.StockItems);
    }

    [Fact]
    public async Task Apply_InvalidRowOrMode_SavesNothing()
    {
        var blank = await Controller().Apply(_ctx.GroupId, Request(ScanApplyModes.Add,
            new DraftItem { Name = "egg" }, new DraftItem { Name = " " }));
        var negative = await Controller().Apply(_ctx.GroupId, Request(ScanApplyModes.Add,
            new DraftItem { Name = "egg", Quantity = -1 }));
        var badMode = await Controller().Apply(_ctx.GroupId, Request("slett-alt", new DraftItem { Name = "egg" }));

        Assert.IsType<BadRequestObjectResult>(blank.Result);
        Assert.IsType<BadRequestObjectResult>(negative.Result);
        Assert.IsType<BadRequestObjectResult>(badMode.Result);
        Assert.Empty(_ctx.Db.StockItems);
    }

    [Fact]
    public async Task Apply_TooManyRows_IsRefused()
    {
        var items = Enumerable.Range(0, DraftItems.MaxItems + 1).Select(i => new DraftItem { Name = $"vare {i}" }).ToArray();

        var result = await Controller().Apply(_ctx.GroupId, Request(ScanApplyModes.Add, items));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Apply_NonMember_IsForbidden()
    {
        SeedStock("Melk");

        var result = await Controller(StockTestContext.OutsiderEmail).Apply(_ctx.GroupId,
            Request(ScanApplyModes.Replace, new DraftItem { Name = "egg" }));

        Assert.Equal(403, ((ObjectResult)result.Result!).StatusCode);
        Assert.Equal("Melk", (await _ctx.Db.StockItems.SingleAsync()).Name);
    }
}
