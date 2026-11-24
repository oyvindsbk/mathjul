using Microsoft.EntityFrameworkCore;
using NotesApi.Features.Contexts;
using NotesApi.Features.Days;

namespace NotesApi.Infrastructure;

/// <summary>
/// Lives in the same database as the recipe app but entirely in the <c>notes</c> schema,
/// with its own migrations history table, so neither app's migrations see the other's tables.
/// </summary>
public class NotesDbContext(DbContextOptions<NotesDbContext> options) : DbContext(options)
{
    public const string Schema = "notes";

    public DbSet<Day> Days => Set<Day>();
    public DbSet<Item> Items => Set<Item>();
    public DbSet<WorkContext> Contexts => Set<WorkContext>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.Entity<Day>(entity =>
        {
            entity.HasIndex(d => d.Date).IsUnique();
            entity.Property(d => d.CarriedOverAt).IsConcurrencyToken();
        });

        modelBuilder.Entity<WorkContext>(entity =>
        {
            entity.ToTable("Contexts");
            entity.Property(c => c.Name).IsRequired().HasMaxLength(WorkContext.MaxNameLength);
            entity.HasIndex(c => c.Name).IsUnique();
        });

        modelBuilder.Entity<Item>(entity =>
        {
            entity.Property(i => i.Text).IsRequired();
            entity.Property(i => i.Kind).HasConversion<string>().HasMaxLength(10);
            entity.Property(i => i.State).HasConversion<string>().HasMaxLength(10);
            entity.Property(i => i.Source).HasConversion<string>().HasMaxLength(10);

            entity.HasOne(i => i.Day).WithMany(d => d.Items)
                .HasForeignKey(i => i.DayId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(i => i.Context).WithMany()
                .HasForeignKey(i => i.ContextId).OnDelete(DeleteBehavior.SetNull);
            // Deleting an original must not delete its carried copy, and SQL Server
            // rejects a second cascade path to Items, so the link is cleared in code.
            entity.HasOne(i => i.CarriedFrom).WithMany()
                .HasForeignKey(i => i.CarriedFromItemId).OnDelete(DeleteBehavior.NoAction);

            entity.HasIndex(i => new { i.DayId, i.ContextId, i.SortOrder });
            entity.HasIndex(i => i.CarriedFromItemId);
        });
    }
}

public static class NotesDbContextOptions
{
    /// <summary>The SQL Server options every NotesDbContext registration must use.</summary>
    public static void Configure(Microsoft.EntityFrameworkCore.Infrastructure.SqlServerDbContextOptionsBuilder sql) =>
        sql.MigrationsHistoryTable("__EFMigrationsHistory", NotesDbContext.Schema);
}
