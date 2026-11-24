using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace NotesApi.Infrastructure;

/// <summary>
/// Used by `dotnet ef` only. CI passes the real server with --connection; the placeholder
/// here is enough to generate migrations.
/// </summary>
public class NotesDbContextFactory : IDesignTimeDbContextFactory<NotesDbContext>
{
    public NotesDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<NotesDbContext>()
            .UseSqlServer("Server=localhost;Database=design-time;Integrated Security=true;TrustServerCertificate=true",
                NotesDbContextOptions.Configure)
            .Options;
        return new NotesDbContext(options);
    }
}
