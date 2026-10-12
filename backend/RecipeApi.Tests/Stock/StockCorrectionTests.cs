using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using RecipeApi.Features.Stock;
using Xunit;

namespace RecipeApi.Tests.Stock;

public class StockCorrectionApplierTests
{
    private static List<DraftItem> Draft() =>
    [
        new() { Name = "melk", Quantity = 1, Unit = "l" },
        new() { Name = "yoghurt", Quantity = 2, Unit = "stk" },
        new() { Name = "smør" },
    ];

    private static CorrectionChange Remove(int? index) => new() { Op = CorrectionOps.Remove, Index = index };

    private static CorrectionChange Update(int? index, string? name = null, decimal? qty = null, string? unit = null) =>
        new() { Op = CorrectionOps.Update, Index = index, Name = name, Quantity = qty, Unit = unit };

    private static CorrectionChange Add(string? name, decimal? qty = null, string? unit = null) =>
        new() { Op = CorrectionOps.Add, Name = name, Quantity = qty, Unit = unit };

    // ── The example from the spec ──────────────────────────────────────────

    [Fact]
    public void Apply_RemoveUpdateAndAdd_Together()
    {
        // «fjern yoghurten, det er 2 melk, legg til 12 egg»
        var result = StockCorrectionApplier.Apply(Draft(), [Remove(2), Update(1, qty: 2), Add("egg", 12, "stk")]);

        Assert.Equal(["melk", "smør", "egg"], result.Items.Select(i => i.Name));
        Assert.Equal(2, result.Items[0].Quantity);
        Assert.Equal("l", result.Items[0].Unit);
        Assert.Equal((12m, "stk"), (result.Items[2].Quantity, result.Items[2].Unit));
        Assert.Equal(3, result.Applied.Count);
        Assert.Empty(result.Rejected);
    }

    [Fact]
    public void Apply_NoChanges_ReturnsDraftUnchanged()
    {
        var result = StockCorrectionApplier.Apply(Draft(), []);

        Assert.Equal(["melk", "yoghurt", "smør"], result.Items.Select(i => i.Name));
        Assert.Empty(result.Applied);
        Assert.Empty(result.Rejected);
    }

    [Fact]
    public void Apply_DoesNotMutateTheInputDraft()
    {
        var draft = Draft();

        StockCorrectionApplier.Apply(draft, [Update(1, name: "lettmelk", qty: 9), Remove(2)]);

        Assert.Equal(3, draft.Count);
        Assert.Equal("melk", draft[0].Name);
        Assert.Equal(1, draft[0].Quantity);
    }

    // ── Indexes ────────────────────────────────────────────────────────────

    [Fact]
    public void Apply_IndexesRefereToTheOriginalDraft_EvenAfterARemoval()
    {
        // Removing row 1 must not shift "row 3" onto what was row 4.
        var result = StockCorrectionApplier.Apply(Draft(), [Remove(1), Update(3, name: "usaltet smør")]);

        Assert.Equal(["yoghurt", "usaltet smør"], result.Items.Select(i => i.Name));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(4)]
    [InlineData(-1)]
    [InlineData(null)]
    public void Apply_UnknownRow_IsRejected_AndOthersStillApply(int? index)
    {
        var result = StockCorrectionApplier.Apply(Draft(), [Remove(index), Remove(3)]);

        Assert.Equal(["melk", "yoghurt"], result.Items.Select(i => i.Name));
        Assert.Single(result.Rejected);
        Assert.Contains("finnes ikke", result.Rejected[0]);
    }

    [Fact]
    public void Apply_TwoChangesToTheSameRow_FirstWins()
    {
        var result = StockCorrectionApplier.Apply(Draft(), [Remove(1), Update(1, qty: 5)]);

        Assert.Equal(["yoghurt", "smør"], result.Items.Select(i => i.Name));
        var rejected = Assert.Single(result.Rejected);
        Assert.Contains("allerede endret", rejected);
    }

    // ── Validation of individual changes ───────────────────────────────────

    [Fact]
    public void Apply_UpdateWithNothingToChange_IsRejected()
    {
        var result = StockCorrectionApplier.Apply(Draft(), [Update(1)]);

        Assert.Single(result.Rejected);
        Assert.Empty(result.Applied);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Apply_UpdateToBlankName_IsRejected_RowKeepsItsName(string name)
    {
        var result = StockCorrectionApplier.Apply(Draft(), [Update(1, name: name)]);

        Assert.Single(result.Rejected);
        Assert.Equal("melk", result.Items[0].Name);
    }

    [Fact]
    public void Apply_UpdateToNegativeQuantity_IsRejected()
    {
        var result = StockCorrectionApplier.Apply(Draft(), [Update(1, qty: -2)]);

        Assert.Single(result.Rejected);
        Assert.Equal(1, result.Items[0].Quantity);
    }

    [Fact]
    public void Apply_AddWithBlankNameOrBadQuantity_IsRejected()
    {
        var result = StockCorrectionApplier.Apply(Draft(), [Add(" "), Add(null), Add("egg", -1), Add(new string('x', 101))]);

        Assert.Equal(4, result.Rejected.Count);
        Assert.Equal(3, result.Items.Count);
    }

    [Fact]
    public void Apply_UnknownOp_IsRejected()
    {
        var result = StockCorrectionApplier.Apply(Draft(), [new CorrectionChange { Op = "slett-alt" }, new CorrectionChange()]);

        Assert.Equal(2, result.Rejected.Count);
        Assert.Equal(3, result.Items.Count);
    }

    [Fact]
    public void Apply_TrimsNamesAndBlanksEmptyUnit()
    {
        var result = StockCorrectionApplier.Apply([], [Add("  egg ", 6, "  ")]);

        var egg = Assert.Single(result.Items);
        Assert.Equal("egg", egg.Name);
        Assert.Null(egg.Unit);
    }

    [Fact]
    public void Apply_AddsAreRefusedOnceTheDraftIsFull()
    {
        var full = Enumerable.Range(0, DraftItems.MaxItems).Select(i => new DraftItem { Name = $"vare {i}" }).ToList();

        var result = StockCorrectionApplier.Apply(full, [Add("én for mye")]);

        Assert.Equal(DraftItems.MaxItems, result.Items.Count);
        Assert.Contains("fullt", Assert.Single(result.Rejected));
    }

    [Fact]
    public void Apply_RemovalsMakeRoomForAdds_InAFullDraft()
    {
        var full = Enumerable.Range(0, DraftItems.MaxItems).Select(i => new DraftItem { Name = $"vare {i}" }).ToList();

        var result = StockCorrectionApplier.Apply(full, [Remove(1), Add("ny")]);

        Assert.Equal(DraftItems.MaxItems, result.Items.Count);
        Assert.Empty(result.Rejected);
    }

    [Fact]
    public void Apply_DescribesChangesInNorwegian()
    {
        var result = StockCorrectionApplier.Apply(Draft(), [Remove(2), Update(1, qty: 2), Add("egg", 12, "stk")]);

        Assert.Equal(["Fjernet «yoghurt»", "Endret «melk» (2 l)", "La til «egg» (12 stk)"], result.Applied);
    }
}

public class StockCorrectionParserTests
{
    [Fact]
    public void TryParse_ReadsAllFields()
    {
        var ok = StockCorrectionParser.TryParse("""
            { "changes": [
              { "op": "remove", "index": 2, "name": null, "quantity": null, "unit": null },
              { "op": "update", "index": 1, "name": null, "quantity": 2.5, "unit": "l" },
              { "op": "add", "index": null, "name": "egg", "quantity": 12, "unit": "stk" }
            ] }
            """, out var changes);

        Assert.True(ok);
        Assert.Equal(3, changes.Count);
        Assert.Equal((CorrectionOps.Remove, 2), (changes[0].Op, changes[0].Index));
        Assert.Equal((2.5m, "l"), (changes[1].Quantity, changes[1].Unit));
        Assert.Equal(("egg", (int?)null), (changes[2].Name, changes[2].Index));
    }

    [Fact]
    public void TryParse_EmptyChanges_IsValid()
    {
        Assert.True(StockCorrectionParser.TryParse("""{ "changes": [] }""", out var changes));
        Assert.Empty(changes);
    }

    [Fact]
    public void TryParse_OddFieldTypes_BecomeNull_SoTheApplierRejectsThem()
    {
        StockCorrectionParser.TryParse("""
            { "changes": [ { "op": "remove", "index": "to", "name": 5, "quantity": "mye", "unit": 1 }, "tekst" ] }
            """, out var changes);

        var change = Assert.Single(changes);
        Assert.Null(change.Index);
        Assert.Null(change.Name);
        Assert.Null(change.Quantity);
        Assert.Null(change.Unit);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("tull")]
    [InlineData("[]")]
    [InlineData("""{ "items": [] }""")]
    [InlineData("""{ "changes": {} }""")]
    public void TryParse_Malformed_ReturnsFalse(string? content)
    {
        Assert.False(StockCorrectionParser.TryParse(content, out var changes));
        Assert.Empty(changes);
    }

    [Fact]
    public void FormatDraft_NumbersRowsFromOne_WithAmounts()
    {
        var text = StockCorrectionParser.FormatDraft(
        [
            new DraftItem { Name = "melk", Quantity = 1.5m, Unit = "l" },
            new DraftItem { Name = "smør" },
            new DraftItem { Name = "egg", Quantity = 12 },
        ]);

        Assert.Equal("1. melk — 1.5 l\n2. smør\n3. egg — 12", text);
    }

    [Fact]
    public void FormatDraft_Empty_SaysSo() =>
        Assert.Equal("(tom liste)", StockCorrectionParser.FormatDraft([]));
}

public sealed class StockCorrectionControllerTests : IDisposable
{
    private readonly StockTestContext _ctx = new();
    private readonly FakeProcessor _processor = new();

    public void Dispose() => _ctx.Dispose();

    private sealed class FakeProcessor : IStockCorrectionProcessor
    {
        public StockCorrectionModelResult Result { get; set; } = StockCorrectionModelResult.Success([]);
        public int Calls { get; private set; }
        public IReadOnlyList<DraftItem>? LastDraft { get; private set; }
        public string? LastInstruction { get; private set; }
        public int LastImageCount { get; private set; }

        public Task<StockCorrectionModelResult> InterpretAsync(
            IReadOnlyList<DraftItem> draft, string instruction, IReadOnlyList<IFormFile> images, CancellationToken cancellationToken = default)
        {
            Calls++;
            LastDraft = draft;
            LastInstruction = instruction;
            LastImageCount = images.Count;
            return Task.FromResult(Result);
        }
    }

    private StockCorrectionController Controller(string? email = StockTestContext.MemberEmail) =>
        StockTestContext.WithCaller(
            new StockCorrectionController(_ctx.Db, _processor, NullLogger<StockCorrectionController>.Instance), email);

    private static string DraftJson(params DraftItem[] items) =>
        JsonSerializer.Serialize(items, new JsonSerializerOptions(JsonSerializerDefaults.Web));

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

    private Task<ActionResult<CorrectionResponse>> Correct(string draft, string instruction, int images = 0, string? caller = StockTestContext.MemberEmail) =>
        Controller(caller).Correct(_ctx.GroupId, draft, instruction, Files(images), default);

    private static T Value<T>(ActionResult<T> result) => (T)Assert.IsType<OkObjectResult>(result.Result).Value!;

    [Fact]
    public async Task Correct_AppliesTheModelsChanges_AndSavesNothing()
    {
        _processor.Result = StockCorrectionModelResult.Success(
        [
            new CorrectionChange { Op = CorrectionOps.Remove, Index = 2 },
            new CorrectionChange { Op = CorrectionOps.Add, Name = "egg", Quantity = 12, Unit = "stk" },
        ]);

        var response = Value(await Correct(
            DraftJson(new DraftItem { Name = "melk" }, new DraftItem { Name = "yoghurt" }),
            "fjern yoghurten, legg til 12 egg"));

        Assert.Equal(["melk", "egg"], response.Items.Select(i => i.Name));
        Assert.Equal(2, response.Applied.Count);
        Assert.Empty(_ctx.Db.StockItems);
    }

    [Fact]
    public async Task Correct_ReportsRejectedChanges_ButStillAppliesTheRest()
    {
        _processor.Result = StockCorrectionModelResult.Success(
        [
            new CorrectionChange { Op = CorrectionOps.Remove, Index = 9 },
            new CorrectionChange { Op = CorrectionOps.Add, Name = "egg" },
        ]);

        var response = Value(await Correct(DraftJson(new DraftItem { Name = "melk" }), "x"));

        Assert.Equal(["melk", "egg"], response.Items.Select(i => i.Name));
        Assert.Single(response.Rejected);
    }

    [Fact]
    public async Task Correct_PassesDraftInstructionAndImagesToTheModel()
    {
        await Correct(DraftJson(new DraftItem { Name = "melk" }), "  du gikk glipp av smøret  ", images: 2);

        Assert.Equal("melk", _processor.LastDraft!.Single().Name);
        Assert.Equal("du gikk glipp av smøret", _processor.LastInstruction);
        Assert.Equal(2, _processor.LastImageCount);
    }

    [Fact]
    public async Task Correct_WithoutImages_SendsNone()
    {
        await Correct(DraftJson(new DraftItem { Name = "melk" }), "x");

        Assert.Equal(0, _processor.LastImageCount);
    }

    [Fact]
    public async Task Correct_EmptyDraft_IsAllowed()
    {
        _processor.Result = StockCorrectionModelResult.Success([new CorrectionChange { Op = CorrectionOps.Add, Name = "egg", Quantity = 12 }]);

        var response = Value(await Correct("[]", "legg til 12 egg"));

        Assert.Single(response.Items);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Correct_BlankInstruction_NeverCallsTheModel(string instruction)
    {
        var result = await Correct("[]", instruction);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(0, _processor.Calls);
    }

    [Fact]
    public async Task Correct_TooLongInstruction_NeverCallsTheModel()
    {
        var result = await Correct("[]", new string('a', StockCorrectionController.MaxInstructionLength + 1));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(0, _processor.Calls);
    }

    [Theory]
    [InlineData("ikke json")]
    [InlineData("null")]
    [InlineData("""{ "name": "melk" }""")]
    [InlineData("""[ { "name": " " } ]""")]
    [InlineData("""[ { "name": "melk", "quantity": -1 } ]""")]
    public async Task Correct_InvalidDraft_NeverCallsTheModel(string draft)
    {
        var result = await Correct(draft, "x");

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(0, _processor.Calls);
    }

    [Fact]
    public async Task Correct_TooManyRowsOrImages_NeverCallsTheModel()
    {
        var rows = Enumerable.Range(0, DraftItems.MaxItems + 1).Select(i => new DraftItem { Name = $"vare {i}" }).ToArray();

        Assert.IsType<BadRequestObjectResult>((await Correct(DraftJson(rows), "x")).Result);
        Assert.IsType<BadRequestObjectResult>((await Correct("[]", "x", images: 5)).Result);
        Assert.Equal(0, _processor.Calls);
    }

    [Fact]
    public async Task Correct_ModelFailure_IsBadRequestWithItsMessage()
    {
        _processor.Result = StockCorrectionModelResult.Failure("Kunne ikke lese AI-svaret. Prøv igjen.");

        var result = await Correct("[]", "x");

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task Correct_NonMember_IsForbidden_AndNeverCallsTheModel()
    {
        var result = await Correct("[]", "x", caller: StockTestContext.OutsiderEmail);

        Assert.Equal(403, ((ObjectResult)result.Result!).StatusCode);
        Assert.Equal(0, _processor.Calls);
    }

    [Fact]
    public async Task DisabledProcessor_SaysCorrectionIsNotConfigured()
    {
        var result = await new DisabledStockCorrectionProcessor().InterpretAsync([], "x", []);

        Assert.False(result.IsSuccess);
        Assert.Contains("ikke konfigurert", result.ErrorMessage);
    }
}
