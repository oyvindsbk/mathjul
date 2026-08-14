using Microsoft.EntityFrameworkCore;
using RecipeApi.Infrastructure;

namespace RecipeApi.Features.HeftyMesterskapet;

/// <summary>
/// Ensures the single standing competition exists, since the UI has no way to create one.
/// </summary>
public static class HeftyMesterskapetSeeder
{
    /// <summary>
    /// Creates the default competition if it is missing. Idempotent, so it is safe to run on
    /// every startup. IgnoreQueryFilters is deliberate: if the row was soft-deleted we must
    /// still find it, otherwise we would insert a duplicate on the same unique slug.
    /// </summary>
    public static async Task SeedDefaultCompetitionAsync(RecipeDbContext db, ILogger logger)
    {
        var existing = await db.HeftyMesterskapetCompetitions
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Slug == HeftyMesterskapetCompetition.DefaultSlug);

        if (existing == null)
        {
            db.HeftyMesterskapetCompetitions.Add(new HeftyMesterskapetCompetition
            {
                Slug = HeftyMesterskapetCompetition.DefaultSlug,
                Name = HeftyMesterskapetCompetition.DefaultName,
                State = new HeftyMesterskapetState()
            });

            await db.SaveChangesAsync();
            logger.LogInformation("Seeded default competition {Slug}", HeftyMesterskapetCompetition.DefaultSlug);
            return;
        }

        // Previously soft-deleted: revive it rather than leave the page with nothing to open.
        if (existing.DeletedAt != null)
        {
            existing.DeletedAt = null;
            existing.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            logger.LogInformation("Restored soft-deleted default competition {Slug}", HeftyMesterskapetCompetition.DefaultSlug);
        }
    }
}
