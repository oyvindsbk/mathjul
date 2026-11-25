using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;
using NotesApi.Features.Projects;
using NotesApi.Features.Days;
using NotesApi.Features.Import;
using NotesApi.Infrastructure;

namespace NotesApi.Tests;

/// <summary>An in-memory notes database with a clock fixed at noon, Oslo time, on <see cref="Today"/>.</summary>
public sealed class NotesTestContext : IDisposable
{
    public static readonly DateOnly Today = new(2026, 11, 24); // a Tuesday

    public NotesDbContext Db { get; }
    public FakeTimeProvider Time { get; }
    public LocalClock Clock { get; }
    public DayService Days { get; }
    public ImportService Import { get; }

    public NotesTestContext()
    {
        var options = new DbContextOptionsBuilder<NotesDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        Db = new NotesDbContext(options);
        Time = new FakeTimeProvider(new DateTimeOffset(Today.ToDateTime(new TimeOnly(11, 0)), TimeSpan.Zero));
        Clock = new LocalClock(Time);
        Days = new DayService(Db, Clock);
        Import = new ImportService(Db, Clock);
    }

    public Project AddProject(string name, bool archived = false)
    {
        var project = new Project { Name = name, IsArchived = archived, SortOrder = Db.Projects.Count() };
        Db.Projects.Add(project);
        Db.SaveChanges();
        return project;
    }

    /// <summary>Adds a day with the given items directly, bypassing carry-over.</summary>
    public Day AddDay(DateOnly date, params Item[] items)
    {
        var day = new Day { Date = date, CreatedAt = DateTime.UtcNow };
        var order = new Dictionary<int, int>();
        foreach (var item in items)
        {
            var key = item.ProjectId ?? item.Project?.Id ?? 0;
            item.SortOrder = order.GetValueOrDefault(key);
            order[key] = item.SortOrder + 1;
            item.CreatedAt = item.UpdatedAt = DateTime.UtcNow;
            day.Items.Add(item);
        }
        Db.Days.Add(day);
        Db.SaveChanges();
        return day;
    }

    public static Item Todo(string text, ItemState state = ItemState.Open, Project? project = null, int indent = 0) =>
        new() { Kind = ItemKind.Todo, Text = text, State = state, Project = project, Indent = indent };

    public static Item Note(string text, Project? project = null) =>
        new() { Kind = ItemKind.Note, Text = text, Project = project };

    /// <summary>Reads through a fresh tracker so tests see what was saved, not what is cached.</summary>
    public List<Item> ItemsOn(DateOnly date)
    {
        Db.ChangeTracker.Clear();
        return Db.Items.Include(i => i.Day).Where(i => i.Day.Date == date)
            .OrderBy(i => i.ProjectId).ThenBy(i => i.SortOrder).ToList();
    }

    public void Dispose() => Db.Dispose();
}
