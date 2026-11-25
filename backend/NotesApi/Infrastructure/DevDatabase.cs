using Microsoft.EntityFrameworkCore;
using NotesApi.Features.Projects;
using NotesApi.Features.Days;

namespace NotesApi.Infrastructure;

/// <summary>Local development only: create the notes schema and a sample last workday.</summary>
public static class DevDatabase
{
    public static async Task MigrateAndSeedAsync(IServiceProvider services)
    {
        var logger = services.GetRequiredService<ILogger<NotesDbContext>>();
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                using var scope = services.CreateScope();
                await MigrateAndSeedOnceAsync(
                    scope.ServiceProvider.GetRequiredService<NotesDbContext>(),
                    scope.ServiceProvider.GetRequiredService<LocalClock>(),
                    logger);
                return;
            }
            catch (Exception ex) when (attempt < 10)
            {
                logger.LogWarning(ex, "Notes migration/seed failed (attempt {Attempt}); retrying", attempt);
                await Task.Delay(TimeSpan.FromSeconds(3));
            }
        }
    }

    private static async Task MigrateAndSeedOnceAsync(NotesDbContext db, LocalClock clock, ILogger logger)
    {
        await db.Database.MigrateAsync();
        if (await db.Days.AnyAsync())
            return;

        var jobb = new Project { Name = "Jobb", SortOrder = 0, Color = "blue" };
        var hobby = new Project { Name = "Hobby", SortOrder = 1, Color = "yellow" };
        db.Projects.AddRange(jobb, hobby);

        var previous = clock.Today.AddDays(clock.Today.DayOfWeek == DayOfWeek.Monday ? -3 : -1);
        var now = clock.UtcNow;
        var day = new Day { Date = previous, CreatedAt = now };
        var order = 0;
        Item Line(ItemKind kind, string text, Project? project = null, ItemState state = ItemState.Open, int indent = 0) => new()
        {
            Kind = kind, Text = text, Project = project, State = state, Indent = indent,
            SortOrder = order++, Source = ItemSource.Manual, CreatedAt = now, UpdatedAt = now,
            CompletedAt = state == ItemState.Done ? now : null,
        };
        day.Items.AddRange(
        [
            Line(ItemKind.Note, "Start: 08:00"),
            Line(ItemKind.Todo, "Svare på PR-kommentarer"),
            Line(ItemKind.Todo, "Sende statusoppdatering", state: ItemState.Done),
            Line(ItemKind.Todo, "Avklare krav med kunden", jobb),
            Line(ItemKind.Note, "Gjelder bare nye kunder", jobb, indent: 1),
            Line(ItemKind.Todo, "Bestille ny PC", hobby),
        ]);
        db.Days.Add(day);
        await db.SaveChangesAsync();
        logger.LogInformation("Seeded a sample day on {Date}", previous);
    }
}
