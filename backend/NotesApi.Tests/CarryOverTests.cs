using NotesApi.Features.Days;
using static NotesApi.Tests.NotesTestContext;

namespace NotesApi.Tests;

public class CarryOverTests
{
    [Fact]
    public async Task Opening_today_copies_only_open_todos_and_marks_originals_carried()
    {
        using var t = new NotesTestContext();
        var jobb = t.AddContext("Jobb");
        var yesterday = Today.AddDays(-1);
        t.AddDay(yesterday,
            Todo("open one"),
            Todo("done one", ItemState.Done),
            Note("a note"),
            Todo("open in context", context: jobb, indent: 1));

        var day = await t.Days.GetDayAsync(Today);

        Assert.True(day.IsToday);
        Assert.Equal(["open one", "open in context"], day.Items.Select(i => i.Text));
        Assert.All(day.Items, i => Assert.Equal(ItemState.Open, i.State));
        Assert.All(day.Items, i => Assert.Equal(yesterday, i.CarriedFromDate));
        var inContext = day.Items.Single(i => i.Text == "open in context");
        Assert.Equal(jobb.Id, inContext.ContextId);
        Assert.Equal(1, inContext.Indent);

        var originals = t.ItemsOn(yesterday);
        Assert.Equal(ItemState.Carried, originals.Single(i => i.Text == "open one").State);
        Assert.Equal(ItemState.Done, originals.Single(i => i.Text == "done one").State);
        Assert.Equal(ItemState.Open, originals.Single(i => i.Text == "a note").State);
    }

    [Fact]
    public async Task Carry_over_keeps_order_within_each_group()
    {
        using var t = new NotesTestContext();
        t.AddDay(Today.AddDays(-1), Todo("first"), Todo("second"), Todo("third"));

        var day = await t.Days.GetDayAsync(Today);

        Assert.Equal(["first", "second", "third"], day.Items.Select(i => i.Text));
        Assert.Equal([0, 1, 2], day.Items.Select(i => i.SortOrder));
    }

    [Fact]
    public async Task Carry_over_runs_once()
    {
        using var t = new NotesTestContext();
        t.AddDay(Today.AddDays(-1), Todo("task"));

        await t.Days.GetDayAsync(Today);
        var second = await t.Days.GetDayAsync(Today);

        Assert.Single(second.Items);
    }

    [Fact]
    public async Task Carry_over_uses_the_most_recent_day_with_items_and_skips_empty_days()
    {
        using var t = new NotesTestContext();
        t.AddDay(Today.AddDays(-7), Todo("a week ago"));
        t.AddDay(Today.AddDays(-4), Todo("friday"));
        t.AddDay(Today.AddDays(-1)); // opened yesterday, nothing written

        var day = await t.Days.GetDayAsync(Today);

        Assert.Equal(["friday"], day.Items.Select(i => i.Text));
    }

    [Fact]
    public async Task Reading_past_or_future_dates_creates_nothing()
    {
        using var t = new NotesTestContext();
        t.AddDay(Today.AddDays(-2), Todo("task"));

        var past = await t.Days.GetDayAsync(Today.AddDays(-1));
        var future = await t.Days.GetDayAsync(Today.AddDays(1));

        Assert.Empty(past.Items);
        Assert.Empty(future.Items);
        Assert.Single(t.Db.Days); // only the seeded day
        Assert.Equal(ItemState.Open, t.ItemsOn(Today.AddDays(-2)).Single().State);
    }

    [Fact]
    public async Task Open_todos_in_an_archived_context_land_in_dagens_todos()
    {
        using var t = new NotesTestContext();
        var old = t.AddContext("Gammelt prosjekt", archived: true);
        t.AddDay(Today.AddDays(-1), Todo("left over", context: old));

        var day = await t.Days.GetDayAsync(Today);

        Assert.Null(day.Items.Single().ContextId);
    }

    [Fact]
    public void Today_follows_the_oslo_calendar_not_utc()
    {
        // 23:30 UTC on the 23rd is 00:30 on the 24th in Oslo (winter time, UTC+1).
        var time = new Microsoft.Extensions.Time.Testing.FakeTimeProvider(
            new DateTimeOffset(2026, 11, 23, 23, 30, 0, TimeSpan.Zero));

        Assert.Equal(Today, new NotesApi.Infrastructure.LocalClock(time).Today);
    }
}
