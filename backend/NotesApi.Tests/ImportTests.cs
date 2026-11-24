using NotesApi.Features.Days;
using NotesApi.Features.Import;
using static NotesApi.Tests.NotesTestContext;

namespace NotesApi.Tests;

public class ImportTests
{
    private static readonly DateOnly Monday = new(2026, 11, 2);

    private static ImportRequest Batch(params ImportDay[] days) => new(null, days);

    private static ImportItem Line(string text, ItemKind kind = ItemKind.Todo, ItemState state = ItemState.Open, string? context = null, int indent = 0) =>
        new(kind, text, state, indent, context);

    [Fact]
    public async Task Import_creates_days_items_and_contexts()
    {
        using var t = new NotesTestContext();

        var result = await t.Import.ImportAsync(new ImportRequest(
            ["Hobby", "Jobb"],
            [new ImportDay(Monday, [
                Line("Start: 08:00", ItemKind.Note),
                Line("PR review", state: ItemState.Done),
                Line("Bildeoptimalisering", state: ItemState.Carried, context: "jobb"),
                Line("Workshop-roller", context: "Prosjekt B", indent: 1),
            ])]));

        Assert.Equal(new ImportResult(1, 4, 3), result);
        Assert.Equal(["Hobby", "Jobb", "Prosjekt B"], t.Db.Contexts.OrderBy(c => c.SortOrder).Select(c => c.Name));
        var items = t.ItemsOn(Monday);
        Assert.All(items, i => Assert.Equal(ItemSource.OneNote, i.Source));
        Assert.Equal(ItemState.Carried, items.Single(i => i.Text == "Bildeoptimalisering").State);
        Assert.NotNull(items.Single(i => i.Text == "PR review").CompletedAt);
        Assert.Equal(1, items.Single(i => i.Text == "Workshop-roller").Indent);
    }

    [Fact]
    public async Task Reimporting_a_date_replaces_imported_items_and_keeps_manual_ones()
    {
        using var t = new NotesTestContext();
        await t.Import.ImportAsync(Batch(new ImportDay(Monday, [Line("old a"), Line("old b")])));
        await t.Days.AddItemAsync(Monday, new AddItemRequest(ItemKind.Todo, "manual", null));

        await t.Import.ImportAsync(Batch(new ImportDay(Monday, [Line("new a")])));

        var items = t.ItemsOn(Monday);
        Assert.Equal(["new a", "manual"], items.Select(i => i.Text));
        Assert.Equal([0, 1], items.Select(i => i.SortOrder));
    }

    [Fact]
    public async Task Import_is_idempotent()
    {
        using var t = new NotesTestContext();
        var batch = Batch(new ImportDay(Monday, [Line("a", context: "Jobb"), Line("b")]));

        await t.Import.ImportAsync(batch);
        await t.Import.ImportAsync(batch);

        Assert.Equal(2, t.ItemsOn(Monday).Count);
        Assert.Single(t.Db.Contexts);
    }

    [Fact]
    public async Task Notes_never_import_as_ticked_or_carried()
    {
        using var t = new NotesTestContext();

        await t.Import.ImportAsync(Batch(new ImportDay(Monday, [Line("note", ItemKind.Note, ItemState.Done)])));

        Assert.Equal(ItemState.Open, t.ItemsOn(Monday).Single().State);
    }

    [Fact]
    public async Task Duplicate_dates_in_a_batch_are_rejected()
    {
        using var t = new NotesTestContext();

        var ex = await Assert.ThrowsAsync<NotesException>(() => t.Import.ImportAsync(
            Batch(new ImportDay(Monday, [Line("a")]), new ImportDay(Monday, [Line("b")]))));

        Assert.Equal(400, ex.StatusCode);
    }

    [Fact]
    public async Task Import_after_opening_an_empty_today_lets_carry_over_run()
    {
        using var t = new NotesTestContext();
        await t.Days.GetDayAsync(Today); // signed in before importing: today created empty

        await t.Import.ImportAsync(Batch(new ImportDay(Today.AddDays(-1), [Line("still open")])));
        var today = await t.Days.GetDayAsync(Today);

        Assert.Equal(["still open"], today.Items.Select(i => i.Text));
    }
}
