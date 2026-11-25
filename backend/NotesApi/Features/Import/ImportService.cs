using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using NotesApi.Features.Projects;
using NotesApi.Features.Days;
using NotesApi.Infrastructure;

namespace NotesApi.Features.Import;

public record ImportItem(
    ItemKind Kind,
    [MaxLength(Item.MaxTextLength)] string Text,
    ItemState State,
    [Range(0, Item.MaxIndent)] int Indent,
    [MaxLength(Project.MaxNameLength)] string? Project);

public record ImportDay(DateOnly Date, [Required] IReadOnlyList<ImportItem> Items);

/// <summary>
/// A batch of days from the OneNote importer. All date resolution and to-do state mapping
/// happen in the importer; the API stores what it is given.
/// </summary>
public record ImportRequest(
    IReadOnlyList<string>? Projects,
    [Required, MaxLength(200)] IReadOnlyList<ImportDay> Days);

public record ImportResult(int Days, int Items, int ProjectsCreated);

public class ImportService(NotesDbContext db, LocalClock clock)
{
    /// <summary>
    /// Idempotent per date: a day's previously imported items are replaced, and items
    /// created in the app on that day are kept (after the imported ones).
    /// </summary>
    public async Task<ImportResult> ImportAsync(ImportRequest request, CancellationToken ct = default)
    {
        var now = clock.UtcNow;
        var projects = await db.Projects.ToListAsync(ct);
        var created = 0;

        Project? Resolve(string? name)
        {
            name = name?.Trim();
            if (string.IsNullOrEmpty(name))
                return null;
            var existing = projects.FirstOrDefault(c => string.Equals(c.Name, name, StringComparison.OrdinalIgnoreCase));
            if (existing is not null)
                return existing;

            var project = new Project
            {
                Name = name,
                SortOrder = projects.Count == 0 ? 0 : projects.Max(c => c.SortOrder) + 1,
            };
            projects.Add(project);
            db.Projects.Add(project);
            created++;
            return project;
        }

        foreach (var name in request.Projects ?? [])
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

            // Previously imported lines are matched to the new ones (same project, kind and text, in
            // order) and updated in place, so what happened in the app since survives a re-import:
            // a carried or ticked to-do keeps its state, and carried copies keep their link.
            string ProjectKey(int? id) => id is null ? "" : projects.First(c => c.Id == id).Name.ToLowerInvariant();
            string LineKey(string projectKey, ItemKind kind, string text) => $"{projectKey}\u0001{kind}\u0001{text}";
            var previous = day.Items.Where(i => i.Source == ItemSource.OneNote)
                .OrderBy(i => i.ProjectId).ThenBy(i => i.SortOrder).ThenBy(i => i.Id)
                .GroupBy(i => LineKey(ProjectKey(i.ProjectId), i.Kind, i.Text))
                .ToDictionary(g => g.Key, g => new Queue<Item>(g));
            var manual = day.Items.Where(i => i.Source != ItemSource.OneNote).ToList();
            // Imported item count per project group (NoProject = "Dagens TODOs"); new projects have no id yet.
            var importedByGroup = new Dictionary<Project, int>(ReferenceEqualityComparer.Instance);

            foreach (var line in import.Items)
            {
                if (string.IsNullOrWhiteSpace(line.Text))
                    continue;
                var project = Resolve(line.Project);
                var order = importedByGroup.GetValueOrDefault(project ?? NoProject);
                importedByGroup[project ?? NoProject] = order + 1;

                var isTodo = line.Kind == ItemKind.Todo;
                var state = isTodo ? line.State : ItemState.Open;
                var key = LineKey(project?.Name.ToLowerInvariant() ?? "", line.Kind, line.Text);
                if (previous.TryGetValue(key, out var matches) && matches.TryDequeue(out var existing))
                {
                    // The app's progress wins over the export's "open".
                    if (state == ItemState.Open && existing.State is ItemState.Carried or ItemState.Done)
                        state = existing.State;
                    existing.Indent = line.Indent;
                    existing.SortOrder = order;
                    existing.UpdatedAt = now;
                    if (existing.State != state)
                    {
                        existing.State = state;
                        existing.CompletedAt = state == ItemState.Done ? now : null;
                    }
                }
                else
                {
                    day.Items.Add(new Item
                    {
                        Project = project,
                        Kind = line.Kind,
                        Text = line.Text,
                        State = state,
                        Indent = line.Indent,
                        SortOrder = order,
                        CompletedAt = state == ItemState.Done ? now : null,
                        Source = ItemSource.OneNote,
                        CreatedAt = now,
                        UpdatedAt = now,
                    });
                }
                itemCount++;
            }

            // Lines no longer in the export are removed; any carried copy just loses its link.
            var removed = previous.Values.SelectMany(q => q).ToList();
            if (removed.Count > 0)
            {
                var removedIds = removed.Select(i => i.Id).ToList();
                foreach (var copy in await db.Items.Where(i => i.CarriedFromItemId != null && removedIds.Contains(i.CarriedFromItemId.Value)).ToListAsync(ct))
                    copy.CarriedFromItemId = null;
                foreach (var old in removed)
                {
                    day.Items.Remove(old);
                    db.Items.Remove(old);
                }
            }

            // Manual items keep their relative order, placed after the imported ones in their group.
            foreach (var group in manual.GroupBy(i => i.ProjectId))
            {
                var project = group.Key is null ? NoProject : projects.First(c => c.Id == group.Key);
                var offset = importedByGroup.GetValueOrDefault(project);
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

    /// <summary>Stands in for "no project" as a dictionary key.</summary>
    private static readonly Project NoProject = new() { Name = "" };
}
