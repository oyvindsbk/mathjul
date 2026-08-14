using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using RecipeApi.Features.HeftyMesterskapet;
using Xunit;

namespace RecipeApi.Tests.HeftyMesterskapet;

/// <summary>
/// The editor list is the only thing standing between the public link and a rewritable scoreboard,
/// so these tests pin down the two properties that matter: the right people get in, and every
/// failure mode keeps everyone else out.
///
/// These cover the configuration path (local dev). The Key Vault path shares all logic below the
/// load, and registering a SecretClient here would mean reaching for the network.
/// </summary>
public sealed class HeftyMesterskapetEditorServiceTests
{
    private static HeftyMesterskapetEditorService CreateService(params string[] editors)
    {
        var values = editors
            .Select((email, i) => new KeyValuePair<string, string?>(
                $"{HeftyMesterskapetEditorService.ConfigurationSection}:{i}", email));

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();

        return new HeftyMesterskapetEditorService(
            NullLogger<HeftyMesterskapetEditorService>.Instance,
            configuration);
    }

    [Fact]
    public async Task Allows_an_email_on_the_editor_list()
    {
        var service = CreateService("scorekeeper@example.com");

        Assert.True(await service.IsEditorAsync("scorekeeper@example.com"));
    }

    [Fact]
    public async Task Denies_an_email_that_is_not_on_the_list()
    {
        var service = CreateService("scorekeeper@example.com");

        Assert.False(await service.IsEditorAsync("someone-else@example.com"));
    }

    [Theory]
    [InlineData("SCOREKEEPER@EXAMPLE.COM")]
    [InlineData("ScoreKeeper@Example.Com")]
    [InlineData("  scorekeeper@example.com  ")]
    public async Task Matches_regardless_of_casing_or_surrounding_whitespace(string email)
    {
        var service = CreateService("ScoreKeeper@Example.com");

        Assert.True(await service.IsEditorAsync(email));
    }

    [Fact]
    public async Task Denies_everyone_when_the_list_is_empty()
    {
        // Fail closed: a missing list must not read as "no restrictions".
        var service = CreateService();

        Assert.False(await service.IsEditorAsync("scorekeeper@example.com"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Denies_a_missing_email(string? email)
    {
        var service = CreateService("scorekeeper@example.com");

        Assert.False(await service.IsEditorAsync(email));
    }

    [Fact]
    public async Task Ignores_blank_entries_in_the_configured_list()
    {
        // A stray comma in the secret must not turn into an entry that matches a blank caller.
        var service = CreateService("scorekeeper@example.com", "", "   ");

        Assert.False(await service.IsEditorAsync(""));
        Assert.True(await service.IsEditorAsync("scorekeeper@example.com"));
    }

    [Fact]
    public async Task Serves_repeated_checks_from_the_cache()
    {
        var service = CreateService("scorekeeper@example.com");

        Assert.True(await service.IsEditorAsync("scorekeeper@example.com"));
        Assert.True(await service.IsEditorAsync("scorekeeper@example.com"));
        Assert.False(await service.IsEditorAsync("someone-else@example.com"));
    }
}
