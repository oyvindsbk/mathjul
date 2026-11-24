using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using NotesApi.Features.Contexts;
using NotesApi.Features.Days;
using NotesApi.Infrastructure;

namespace NotesApi.Features.Import;

public record ImportItem(
    ItemKind Kind,
    [MaxLength(Item.MaxTextLength)] string Text,
    ItemState State,
    [Range(0, Item.MaxIndent)] int Indent,
    [MaxLength(WorkContext.MaxNameLength)] string? Context);

public record ImportDay(DateOnly Date, [Required] IReadOnlyList<ImportItem> Items);

/// <summary>
/// A batch of days from the OneNote importer. All date resolution and to-do state mapping
/// happen in the importer; the API stores what it is given.
/// </summary>
public record ImportRequest(
    IReadOnlyList<string>? Contexts,
    [Required, MaxLength(200)] IReadOnlyList<ImportDay> Days);

public record ImportResult(int Days, int Items, int ContextsCreated);

public class ImportService(NotesDbContext db, LocalClock clock)
{
    /// <summary>
    /// Idempotent per date: a day's previously imported items are replaced, and items
    /// created in the app on that day are kept (after the imported ones).
    /// </summary>
    public async Task<ImportResult> ImportAsync(ImportRequest request, CancellationToken ct = default)
    {
        var now = clock.UtcNow;
        var contexts = await db.Contexts.ToListAsync(ct);
        var created = 0;

        WorkContext? Resolve(string? name)
        {
            name = name?.Trim();
            if (string.IsNullOrEmpty(name))
                return null;
            var existing = contexts.FirstOrDefault(c => string.Equals(c.Name, name, StringComparison.OrdinalIgnoreCase));
            if (existing is not null)
                return existing;

            var context = new WorkContext
            {
                Name = name,
                SortOrder = contexts.Count == 0 ? 0 : contexts.Max(c => c.SortOrder) + 1,
            };
            contexts.Add(context);
            db.Contexts.Add(context);
            created++;
            return context;
        }

        foreach (var name in request.Contexts ?? [])
            Resolve(name);

        var dates = request.Days.Select(d => d.Date).ToList();
        if (dates.Count != dates.Distinct().Count())
            throw new NotesException(StatusCodes.Status400BadRequest, "Each date may appear once per batch");

        var existingDays = await db.Days.Include(d => d.Items)
            .Where(d => dates.Contains(d.Date))
            .ToDictionaryAsync(d => d.Date, ct);

        var itemCount = 0;
        foreach (var import in request.Days)
        {
            if (!existingDays.TryGetValue(import.Date, out var day))
            {
                day = new Day { Date = import.Date, CreatedAt = now };
                db.Days.Add(day);
            }

            var oldImported = day.Items.Where(i => i.Source == ItemSource.OneNote).ToList();
            if (oldImported.Count > 0)
            {
                var oldIds = oldImported.Select(i => i.Id).ToList();
                foreach (var copy in await db.Items.Where(i => i.CarriedFromItemId != null && oldIds.Contains(i.CarriedFromItemId.Value)).ToListAsync(ct))
                    copy.CarriedFromItemId = null;
                foreach (var old in oldImported)
                {
                    day.Items.Remove(old);
                    db.Items.Remove(old);
                }
            }

            var manual = day.Items.ToList();
            // Imported item count per context group (NoContext = "Dagens TODOs"); new contexts have no id yet.
            var importedByGroup = new Dictionary<WorkContext, int>(ReferenceEqualityComparer.Instance);

            foreach (var line in import.Items)
            {
                if (string.IsNullOrWhiteSpace(line.Text))
                    continue;
                var context = Resolve(line.Context);
                var order = importedByGroup.GetValueOrDefault(context ?? NoContext);
                importedByGroup[context ?? NoContext] = order + 1;

                var isTodo = line.Kind == ItemKind.Todo;
                day.Items.Add(new Item
                {
                    Context = context,
                    Kind = line.Kind,
                    Text = line.Text,
                    State = isTodo ? line.State : ItemState.Open,
                    Indent = line.Indent,
                    SortOrder = order,
                    CompletedAt = isTodo && line.State == ItemState.Done ? now : null,
                    Source = ItemSource.OneNote,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                itemCount++;
            }

            // Manual items keep their relative order, placed after the imported ones in their group.
            foreach (var group in manual.GroupBy(i => i.ContextId))
            {
                var context = group.Key is null ? NoContext : contexts.First(c => c.Id == group.Key);
                var offset = importedByGroup.GetValueOrDefault(context);
                foreach (var (item, index) in group.OrderBy(i => i.SortOrder).Select((item, index) => (item, index)))
                    item.SortOrder = offset + index;
            }
        }

        await db.SaveChangesAsync(ct);
        await ResetEmptyTodayAsync(ct);
        return new ImportResult(request.Days.Count, itemCount, created);
    }

    /// <summary>
    /// If today was opened before the history arrived, it was created empty and carried nothing.
    /// Removing the empty day lets the next open run carry-over from the newly imported days.
    /// </summary>
    private async Task ResetEmptyTodayAsync(CancellationToken ct)
    {
        var today = clock.Today;
        var emptyToday = await db.Days.FirstOrDefaultAsync(d => d.Date == today && !d.Items.Any(), ct);
        if (emptyToday is null)
            return;
        db.Days.Remove(emptyToday);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Stands in for "no context" as a dictionary key.</summary>
    private static readonly WorkContext NoContext = new() { Name = "" };
}
