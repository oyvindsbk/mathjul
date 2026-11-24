using Microsoft.EntityFrameworkCore;
using NotesApi.Infrastructure;

namespace NotesApi.Features.Days;

public class NotesException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

public class DayService(NotesDbContext db, LocalClock clock)
{
    /// <summary>
    /// Returns a day. Today's day is created on first read, carrying open to-dos forward from
    /// the most recent earlier day that has items. Other dates are never created by reading.
    /// </summary>
    public async Task<DayDto> GetDayAsync(DateOnly date, CancellationToken ct = default)
    {
        if (date == clock.Today)
            await EnsureTodayAsync(ct);

        var items = await db.Items
            .Where(i => i.Day.Date == date)
            .OrderBy(i => i.ContextId).ThenBy(i => i.SortOrder).ThenBy(i => i.Id)
            .Select(i => new ItemDto(
                i.Id, i.Kind, i.Text, i.State, i.Indent, i.SortOrder, i.ContextId,
                i.CarriedFrom == null ? null : i.CarriedFrom.Day.Date,
                i.CompletedAt))
            .ToListAsync(ct);

        return new DayDto(date, date == clock.Today, items);
    }

    public async Task<WeekDto> GetWeekAsync(DateOnly monday, CancellationToken ct = default)
    {
        var sunday = monday.AddDays(6);
        var counts = await db.Items
            .Where(i => i.Day.Date >= monday && i.Day.Date <= sunday)
            .GroupBy(i => i.Day.Date)
            .Select(g => new DaySummaryDto(
                g.Key,
                g.Count(i => i.Kind == ItemKind.Todo && i.State == ItemState.Open),
                g.Count(i => i.Kind == ItemKind.Todo && i.State == ItemState.Done),
                g.Count(i => i.Kind == ItemKind.Todo && i.State == ItemState.Carried),
                g.Count(i => i.Kind == ItemKind.Note)))
            .ToDictionaryAsync(s => s.Date, ct);

        var days = Enumerable.Range(0, 7)
            .Select(offset => monday.AddDays(offset))
            .Select(date => counts.GetValueOrDefault(date) ?? new DaySummaryDto(date, 0, 0, 0, 0))
            .ToList();

        return new WeekDto(IsoWeek.Key(monday), monday, clock.Today, days);
    }

    public async Task EnsureTodayAsync(CancellationToken ct = default)
    {
        var today = clock.Today;
        var now = clock.UtcNow;
        var day = await db.Days.FirstOrDefaultAsync(d => d.Date == today, ct);
        if (day is { CarriedOverAt: not null })
            return;

        // A day planned ahead already exists but hasn't been carried into yet.
        var plannedDayId = day?.Id;
        if (day is null)
        {
            day = new Day { Date = today, CreatedAt = now };
            db.Days.Add(day);
        }
        day.CarriedOverAt = now;

        var sourceDayId = await db.Days
            .Where(d => d.Date < today && d.Items.Any())
            .OrderByDescending(d => d.Date)
            .Select(d => (int?)d.Id)
            .FirstOrDefaultAsync(ct);

        if (sourceDayId is not null)
        {
            var open = await db.Items
                .Include(i => i.Context)
                .Where(i => i.DayId == sourceDayId && i.Kind == ItemKind.Todo && i.State == ItemState.Open)
                .OrderBy(i => i.ContextId).ThenBy(i => i.SortOrder)
                .ToListAsync(ct);

            // Carried copies go after anything already planned on the day, per group.
            var nextOrder = plannedDayId is null
                ? new Dictionary<int, int>()
                : await db.Items
                    .Where(i => i.DayId == plannedDayId)
                    .GroupBy(i => i.ContextId ?? 0)
                    .Select(g => new { g.Key, Next = g.Max(i => i.SortOrder) + 1 })
                    .ToDictionaryAsync(g => g.Key, g => g.Next, ct); // key: context id, 0 for no context
            foreach (var original in open)
            {
                // Archived contexts take no new items, so their open to-dos land in "Dagens TODOs".
                var contextId = original.Context is { IsArchived: true } ? null : original.ContextId;
                var key = contextId ?? 0;
                var order = nextOrder.GetValueOrDefault(key);
                nextOrder[key] = order + 1;

                db.Items.Add(new Item
                {
                    Day = day,
                    Kind = ItemKind.Todo,
                    Text = original.Text,
                    State = ItemState.Open,
                    Indent = original.Indent,
                    ContextId = contextId,
                    SortOrder = order,
                    CarriedFromItemId = original.Id,
                    Source = ItemSource.Manual,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                original.State = ItemState.Carried;
                original.UpdatedAt = now;
            }
        }

        try
        {
            // One SaveChanges: the day, the copies and the originals' new state commit together.
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // A concurrent request created today (unique Date) or carried first (CarriedOverAt is a
            // concurrency token, so the losing UPDATE matches no row); its carry-over stands.
            db.ChangeTracker.Clear();
            if (!await db.Days.AnyAsync(d => d.Date == today && d.CarriedOverAt != null, ct))
                throw;
        }
    }

    public async Task<ItemDto> AddItemAsync(DateOnly date, AddItemRequest request, CancellationToken ct = default)
    {
        await EnsureContextUsableAsync(request.ContextId, ct);
        if (date == clock.Today)
            await EnsureTodayAsync(ct);

        var now = clock.UtcNow;
        var day = await db.Days.FirstOrDefaultAsync(d => d.Date == date, ct);
        if (day is null)
        {
            day = new Day { Date = date, CreatedAt = now };
            db.Days.Add(day);
            await db.SaveChangesAsync(ct);
        }

        var group = await GroupAsync(day.Id, request.ContextId, ct);
        var index = group.Count;
        if (request.AfterItemId is { } afterId)
        {
            var after = group.FindIndex(i => i.Id == afterId);
            if (after < 0)
                throw new NotesException(StatusCodes.Status400BadRequest, "afterItemId is not in the same day and context");
            index = after + 1;
        }

        var item = new Item
        {
            DayId = day.Id,
            ContextId = request.ContextId,
            Kind = request.Kind,
            Text = request.Text,
            State = ItemState.Open,
            Indent = request.Indent,
            Source = ItemSource.Manual,
            CreatedAt = now,
            UpdatedAt = now,
        };
        group.Insert(index, item);
        Renumber(group);
        db.Items.Add(item);
        await db.SaveChangesAsync(ct);

        return await ToDtoAsync(item.Id, ct);
    }

    public async Task<ItemDto> UpdateItemAsync(int id, UpdateItemRequest request, CancellationToken ct = default)
    {
        var item = await db.Items.FirstOrDefaultAsync(i => i.Id == id, ct)
            ?? throw new NotesException(StatusCodes.Status404NotFound, "Item not found");
        var now = clock.UtcNow;

        if (request.Text is not null)
            item.Text = request.Text;
        if (request.Indent is { } indent)
            item.Indent = indent;

        if (request.Kind is { } kind && kind != item.Kind)
        {
            if (item.State == ItemState.Carried)
                throw new NotesException(StatusCodes.Status409Conflict, "A carried item can't change kind");
            item.Kind = kind;
            item.State = ItemState.Open;
            item.CompletedAt = null;
        }

        if (request.State is { } state && state != item.State)
        {
            if (item.State == ItemState.Carried)
                throw new NotesException(StatusCodes.Status409Conflict, "This to-do was carried to a later day; tick it there");
            if (state == ItemState.Carried)
                throw new NotesException(StatusCodes.Status400BadRequest, "Carried is set by carry-over only");
            if (item.Kind != ItemKind.Todo)
                throw new NotesException(StatusCodes.Status400BadRequest, "Only to-dos can be ticked");
            item.State = state;
            item.CompletedAt = state == ItemState.Done ? now : null;
        }

        item.UpdatedAt = now;
        await db.SaveChangesAsync(ct);
        return await ToDtoAsync(item.Id, ct);
    }

    public async Task<ItemDto> MoveItemAsync(int id, MoveItemRequest request, CancellationToken ct = default)
    {
        var item = await db.Items.FirstOrDefaultAsync(i => i.Id == id, ct)
            ?? throw new NotesException(StatusCodes.Status404NotFound, "Item not found");
        if (request.ContextId != item.ContextId)
            await EnsureContextUsableAsync(request.ContextId, ct);

        var from = await GroupAsync(item.DayId, item.ContextId, ct);
        from.RemoveAll(i => i.Id == item.Id);
        Renumber(from);

        var to = request.ContextId == item.ContextId ? from : await GroupAsync(item.DayId, request.ContextId, ct);
        item.ContextId = request.ContextId;
        to.Insert(Math.Min(request.Index ?? to.Count, to.Count), item);
        Renumber(to);

        item.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        return await ToDtoAsync(item.Id, ct);
    }

    public async Task DeleteItemAsync(int id, CancellationToken ct = default)
    {
        var item = await db.Items.FirstOrDefaultAsync(i => i.Id == id, ct)
            ?? throw new NotesException(StatusCodes.Status404NotFound, "Item not found");

        // The carry link has no cascade (see NotesDbContext); a later copy just loses its hint.
        foreach (var copy in await db.Items.Where(i => i.CarriedFromItemId == id).ToListAsync(ct))
            copy.CarriedFromItemId = null;

        var group = await GroupAsync(item.DayId, item.ContextId, ct);
        group.RemoveAll(i => i.Id == id);
        Renumber(group);
        db.Items.Remove(item);
        await db.SaveChangesAsync(ct);
    }

    private async Task<List<Item>> GroupAsync(int dayId, int? contextId, CancellationToken ct) =>
        await db.Items
            .Where(i => i.DayId == dayId && i.ContextId == contextId)
            .OrderBy(i => i.SortOrder).ThenBy(i => i.Id)
            .ToListAsync(ct);

    private static void Renumber(List<Item> group)
    {
        for (var i = 0; i < group.Count; i++)
            group[i].SortOrder = i;
    }

    private async Task EnsureContextUsableAsync(int? contextId, CancellationToken ct)
    {
        if (contextId is null)
            return;
        var context = await db.Contexts.FirstOrDefaultAsync(c => c.Id == contextId, ct)
            ?? throw new NotesException(StatusCodes.Status400BadRequest, "Unknown context");
        if (context.IsArchived)
            throw new NotesException(StatusCodes.Status409Conflict, $"Context '{context.Name}' is archived");
    }

    private Task<ItemDto> ToDtoAsync(int id, CancellationToken ct) =>
        db.Items.Where(i => i.Id == id)
            .Select(i => new ItemDto(
                i.Id, i.Kind, i.Text, i.State, i.Indent, i.SortOrder, i.ContextId,
                i.CarriedFrom == null ? null : i.CarriedFrom.Day.Date,
                i.CompletedAt))
            .FirstAsync(ct);
}
