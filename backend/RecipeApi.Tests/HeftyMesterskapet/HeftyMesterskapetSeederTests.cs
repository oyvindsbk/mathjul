using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RecipeApi.Features.HeftyMesterskapet;
using RecipeApi.Infrastructure;
using Xunit;

namespace RecipeApi.Tests.HeftyMesterskapet;

/// <summary>
/// The scoring page has no competition picker, so it can only ever open the competition at
/// HeftyMesterskapetCompetition.DefaultSlug. These tests cover the seeder that guarantees it exists.
///
/// Note: the InMemory provider does not enforce unique indexes, so these tests verify the
/// seeder's own duplicate avoidance rather than the database constraint behind it.
/// </summary>
public sealed class HeftyMesterskapetSeederTests : IDisposable
{
    private readonly RecipeDbContext _db;

    public HeftyMesterskapetSeederTests()
    {
        var options = new DbContextOptionsBuilder<RecipeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new RecipeDbContext(options);
        _db.Database.EnsureCreated();
    }

    private Task SeedAsync() =>
        HeftyMesterskapetSeeder.SeedDefaultCompetitionAsync(_db, NullLogger.Instance);

    [Fact]
    public async Task Creates_the_default_competition_when_the_table_is_empty()
    {
        await SeedAsync();

        var competition = Assert.Single(_db.HeftyMesterskapetCompetitions.ToList());
        Assert.Equal(HeftyMesterskapetCompetition.DefaultSlug, competition.Slug);
        Assert.Equal(HeftyMesterskapetCompetition.DefaultName, competition.Name);
        Assert.Empty(competition.State.Participants);
        Assert.Null(competition.DeletedAt);
    }

    [Fact]
    public async Task Running_twice_does_not_create_a_duplicate()
    {
        await SeedAsync();
        await SeedAsync();

        Assert.Single(_db.HeftyMesterskapetCompetitions.ToList());
    }

    [Fact]
    public async Task Preserves_existing_results_on_later_startups()
    {
        await SeedAsync();

        // Simulate scoring, the way a PUT to /state would leave the row.
        var competition = await _db.HeftyMesterskapetCompetitions.FirstAsync();
        competition.State = new HeftyMesterskapetState
        {
            Participants = [new HeftyMesterskapetParticipant { Id = "p1", Name = "Øyvind" }],
            Results = new Dictionary<string, Dictionary<string, string>>
            {
                ["hoyde"] = new() { ["p1"] = "1.80" }
            }
        };
        await _db.SaveChangesAsync();

        await SeedAsync();

        var reloaded = await _db.HeftyMesterskapetCompetitions.AsNoTracking().FirstAsync();
        var participant = Assert.Single(reloaded.State.Participants);
        Assert.Equal("Øyvind", participant.Name);
        Assert.Equal("1.80", reloaded.State.Results["hoyde"]["p1"]);
    }

    [Fact]
    public async Task Restores_the_competition_when_it_was_soft_deleted()
    {
        await SeedAsync();

        var competition = await _db.HeftyMesterskapetCompetitions.FirstAsync();
        competition.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // The query filter hides it, so the page would have nothing to open.
        Assert.Empty(_db.HeftyMesterskapetCompetitions.ToList());

        await SeedAsync();

        // Revived rather than duplicated -- the slug is unique in the database.
        var restored = Assert.Single(_db.HeftyMesterskapetCompetitions.IgnoreQueryFilters().ToList());
        Assert.Null(restored.DeletedAt);
        Assert.Equal(HeftyMesterskapetCompetition.DefaultSlug, restored.Slug);
    }

    public void Dispose() => _db.Dispose();
}
