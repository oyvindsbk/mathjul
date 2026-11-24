using NotesApi.Features.Days;
using static NotesApi.Tests.NotesTestContext;

namespace NotesApi.Tests;

public class ItemTests
{
    [Fact]
    public async Task A_carried_original_cannot_be_ticked()
    {
        using var t = new NotesTestContext();
        t.AddDay(Today.AddDays(-1), Todo("task"));
        await t.Days.GetDayAsync(Today);
        var original = t.ItemsOn(Today.AddDays(-1)).Single();

        var ex = await Assert.ThrowsAsync<NotesException>(() =>
            t.Days.UpdateItemAsync(original.Id, new UpdateItemRequest(State: ItemState.Done)));

        Assert.Equal(409, ex.StatusCode);
    }

    [Fact]
    public async Task Ticking_sets_and_clears_completed_at()
    {
        using var t = new NotesTestContext();
        var added = await t.Days.AddItemAsync(Today, new AddItemRequest(ItemKind.Todo, "task", null));

        var done = await t.Days.UpdateItemAsync(added.Id, new UpdateItemRequest(State: ItemState.Done));
        var reopened = await t.Days.UpdateItemAsync(added.Id, new UpdateItemRequest(State: ItemState.Open));

        Assert.NotNull(done.CompletedAt);
        Assert.Null(reopened.CompletedAt);
    }

    [Fact]
    public async Task Notes_cannot_be_ticked()
    {
        using var t = new NotesTestContext();
        var note = await t.Days.AddItemAsync(Today, new AddItemRequest(ItemKind.Note, "note", null));

        var ex = await Assert.ThrowsAsync<NotesException>(() =>
            t.Days.UpdateItemAsync(note.Id, new UpdateItemRequest(State: ItemState.Done)));

        Assert.Equal(400, ex.StatusCode);
    }

    [Fact]
    public async Task Adding_after_an_item_inserts_and_renumbers()
    {
        using var t = new NotesTestContext();
        var a = await t.Days.AddItemAsync(Today, new AddItemRequest(ItemKind.Todo, "a", null));
        await t.Days.AddItemAsync(Today, new AddItemRequest(ItemKind.Todo, "c", null));

        await t.Days.AddItemAsync(Today, new AddItemRequest(ItemKind.Todo, "b", null, AfterItemId: a.Id));

        Assert.Equal(["a", "b", "c"], t.ItemsOn(Today).Select(i => i.Text));
        Assert.Equal([0, 1, 2], t.ItemsOn(Today).Select(i => i.SortOrder));
    }

    [Fact]
    public async Task Adding_to_an_archived_context_is_refused()
    {
        using var t = new NotesTestContext();
        var old = t.AddContext("Old", archived: true);

        var ex = await Assert.ThrowsAsync<NotesException>(() =>
            t.Days.AddItemAsync(Today, new AddItemRequest(ItemKind.Todo, "x", old.Id)));

        Assert.Equal(409, ex.StatusCode);
    }

    [Fact]
    public async Task Moving_to_another_context_renumbers_both_groups()
    {
        using var t = new NotesTestContext();
        var work = t.AddContext("Work");
        var a = await t.Days.AddItemAsync(Today, new AddItemRequest(ItemKind.Todo, "a", null));
        await t.Days.AddItemAsync(Today, new AddItemRequest(ItemKind.Todo, "b", null));
        await t.Days.AddItemAsync(Today, new AddItemRequest(ItemKind.Todo, "w", work.Id));

        await t.Days.MoveItemAsync(a.Id, new MoveItemRequest(work.Id, 0));

        var items = t.ItemsOn(Today);
        Assert.Equal(0, items.Single(i => i.Text == "b").SortOrder);
        Assert.Equal(["a", "w"], items.Where(i => i.ContextId == work.Id).Select(i => i.Text));
        Assert.Equal([0, 1], items.Where(i => i.ContextId == work.Id).Select(i => i.SortOrder));
    }

    [Fact]
    public async Task Deleting_an_original_keeps_its_carried_copy()
    {
        using var t = new NotesTestContext();
        t.AddDay(Today.AddDays(-1), Todo("task"));
        await t.Days.GetDayAsync(Today);
        var original = t.ItemsOn(Today.AddDays(-1)).Single();

        await t.Days.DeleteItemAsync(original.Id);

        var copy = t.ItemsOn(Today).Single();
        Assert.Equal("task", copy.Text);
        Assert.Null(copy.CarriedFromItemId);
    }

    [Fact]
    public async Task Week_summary_counts_by_state()
    {
        using var t = new NotesTestContext();
        var monday = Today.AddDays(-1);
        t.AddDay(monday, Todo("o"), Todo("d", ItemState.Done), Todo("c", ItemState.Carried), Note("n"));

        var week = await t.Days.GetWeekAsync(monday);

        Assert.Equal("2026-W48", week.Week);
        Assert.Equal(7, week.Days.Count);
        var mon = week.Days[0];
        Assert.Equal((1, 1, 1, 1), (mon.Open, mon.Done, mon.Carried, mon.Notes));
    }

    [Theory]
    [InlineData("2026-W48", "2026-11-23")]
    [InlineData("2026-W1", "2025-12-29")]
    [InlineData("2020-W53", "2020-12-28")]
    public void Iso_week_keys_parse_to_monday(string key, string monday)
    {
        Assert.True(IsoWeek.TryParseMonday(key, out var parsed));
        Assert.Equal(DateOnly.Parse(monday), parsed);
        Assert.Equal(key.Replace("W1", "W01"), IsoWeek.Key(parsed));
    }

    [Theory]
    [InlineData("2026-W54")]
    [InlineData("2026-48")]
    [InlineData("2025-W53")]
    public void Invalid_week_keys_are_rejected(string key) =>
        Assert.False(IsoWeek.TryParseMonday(key, out _));
}
