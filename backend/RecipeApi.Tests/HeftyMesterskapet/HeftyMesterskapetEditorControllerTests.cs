using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using RecipeApi.Features.Auth;
using RecipeApi.Features.HeftyMesterskapet;
using RecipeApi.Infrastructure;
using Xunit;

namespace RecipeApi.Tests.HeftyMesterskapet;

/// <summary>
/// The write endpoints are the security boundary this feature exists to create: reading the
/// scoreboard is public, changing it is not. These tests drive the real controller through the real
/// token service and editor list, so the whole token -> email -> editor chain is covered rather
/// than mocked around.
///
/// The recipe-app whitelist is deliberately absent here: these paths bypass
/// EmailWhitelistMiddleware, so the editor list is the only thing authorizing them.
/// </summary>
public sealed class HeftyMesterskapetEditorControllerTests : IDisposable
{
    private const string EditorEmail = "scorekeeper@example.com";
    private const string NonEditorEmail = "recipe-user@example.com";

    private readonly RecipeDbContext _db;
    private readonly TokenService _tokenService;
    private readonly HeftyMesterskapetEditorController _controller;

    public HeftyMesterskapetEditorControllerTests()
    {
        var options = new DbContextOptionsBuilder<RecipeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new RecipeDbContext(options);
        _db.Database.EnsureCreated();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:SecretKey"] = "test-secret-key-that-is-long-enough-32chars",
                ["Jwt:Issuer"] = "RecipeApi",
                ["Jwt:Audience"] = "RecipeFrontend",
                [$"{HeftyMesterskapetEditorService.ConfigurationSection}:0"] = EditorEmail,
            })
            .Build();

        _tokenService = new TokenService(configuration, NullLogger<TokenService>.Instance);

        var editorService = new HeftyMesterskapetEditorService(
            NullLogger<HeftyMesterskapetEditorService>.Instance, configuration);

        _controller = new HeftyMesterskapetEditorController(
            _db,
            new HeftyMesterskapetCallerResolver(_tokenService, editorService))
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
    }

    /// <summary>Signs the request in as <paramref name="email"/>, or anonymously when null.</summary>
    private void SignInAs(string? email)
    {
        var headers = _controller.ControllerContext.HttpContext!.Request.Headers;
        if (email == null)
        {
            headers.Remove("Authorization");
            return;
        }

        headers.Authorization = $"Bearer {_tokenService.GenerateToken(email)}";
    }

    private async Task<HeftyMesterskapetCompetition> SeedCompetitionAsync()
    {
        var competition = new HeftyMesterskapetCompetition
        {
            Slug = HeftyMesterskapetCompetition.DefaultSlug,
            Name = HeftyMesterskapetCompetition.DefaultName,
            State = new HeftyMesterskapetState()
        };
        _db.HeftyMesterskapetCompetitions.Add(competition);
        await _db.SaveChangesAsync();
        return competition;
    }

    private static SaveStateRequest StateWithParticipant() => new()
    {
        State = new HeftyMesterskapetState
        {
            Participants = { new HeftyMesterskapetParticipant { Id = "abc1234", Name = "Kari" } }
        }
    };

    private static int StatusOf(IActionResult result) => result switch
    {
        ObjectResult o => o.StatusCode ?? 200,
        StatusCodeResult s => s.StatusCode,   // covers NoContentResult (204) too
        _ => 200
    };

    // ---- Anonymous callers ----

    [Fact]
    public async Task Anonymous_cannot_save_state()
    {
        await SeedCompetitionAsync();
        SignInAs(null);

        var result = await _controller.SaveState(
            HeftyMesterskapetCompetition.DefaultSlug, StateWithParticipant());

        Assert.Equal(401, StatusOf(result));
    }

    [Fact]
    public async Task Anonymous_cannot_create_a_competition()
    {
        SignInAs(null);

        var result = await _controller.CreateCompetition(new CreateCompetitionRequest { Name = "Ny" });

        Assert.Equal(401, StatusOf(result.Result!));
    }

    [Fact]
    public async Task Anonymous_cannot_delete_a_competition()
    {
        await SeedCompetitionAsync();
        SignInAs(null);

        var result = await _controller.DeleteCompetition(HeftyMesterskapetCompetition.DefaultSlug);

        Assert.Equal(401, StatusOf(result));
    }

    [Fact]
    public async Task An_anonymous_save_attempt_leaves_the_state_untouched()
    {
        await SeedCompetitionAsync();
        SignInAs(null);

        await _controller.SaveState(HeftyMesterskapetCompetition.DefaultSlug, StateWithParticipant());

        var stored = await _db.HeftyMesterskapetCompetitions.AsNoTracking()
            .FirstAsync(c => c.Slug == HeftyMesterskapetCompetition.DefaultSlug);
        Assert.Empty(stored.State.Participants);
    }

    [Fact]
    public async Task A_garbled_token_is_treated_as_anonymous()
    {
        await SeedCompetitionAsync();
        _controller.ControllerContext.HttpContext!.Request.Headers.Authorization = "Bearer not.a.real.token";

        var result = await _controller.SaveState(
            HeftyMesterskapetCompetition.DefaultSlug, StateWithParticipant());

        Assert.Equal(401, StatusOf(result));
    }

    // ---- Signed in, but not an editor ----

    [Fact]
    public async Task A_signed_in_non_editor_is_forbidden_rather_than_unauthorized()
    {
        // 403 vs 401 matters: the page tells this person they lack access instead of
        // sending them back through a login that would not help.
        await SeedCompetitionAsync();
        SignInAs(NonEditorEmail);

        var result = await _controller.SaveState(
            HeftyMesterskapetCompetition.DefaultSlug, StateWithParticipant());

        Assert.Equal(403, StatusOf(result));
    }

    [Fact]
    public async Task A_signed_in_non_editor_cannot_delete()
    {
        await SeedCompetitionAsync();
        SignInAs(NonEditorEmail);

        var result = await _controller.DeleteCompetition(HeftyMesterskapetCompetition.DefaultSlug);

        Assert.Equal(403, StatusOf(result));
    }

    // ---- Editors ----

    [Fact]
    public async Task An_editor_can_save_state()
    {
        await SeedCompetitionAsync();
        SignInAs(EditorEmail);

        var result = await _controller.SaveState(
            HeftyMesterskapetCompetition.DefaultSlug, StateWithParticipant());

        Assert.Equal(200, StatusOf(result));

        var stored = await _db.HeftyMesterskapetCompetitions.AsNoTracking()
            .FirstAsync(c => c.Slug == HeftyMesterskapetCompetition.DefaultSlug);
        Assert.Equal("Kari", Assert.Single(stored.State.Participants).Name);
    }

    [Fact]
    public async Task An_editor_who_is_not_a_recipe_app_user_still_gets_in()
    {
        // The whole point of the separate list: editors are not recipe-app users. Nothing in this
        // test's configuration mentions the approved-users whitelist, and it must stay that way.
        await SeedCompetitionAsync();
        SignInAs(EditorEmail);

        var result = await _controller.SaveState(
            HeftyMesterskapetCompetition.DefaultSlug, StateWithParticipant());

        Assert.Equal(200, StatusOf(result));
    }

    [Fact]
    public async Task An_editor_can_create_and_delete_a_competition()
    {
        SignInAs(EditorEmail);

        var created = await _controller.CreateCompetition(new CreateCompetitionRequest { Name = "Ny" });
        var dto = Assert.IsType<CompetitionDto>(Assert.IsType<OkObjectResult>(created.Result).Value);

        var deleted = await _controller.DeleteCompetition(dto.Slug);

        Assert.Equal(204, StatusOf(deleted));
    }

    [Fact]
    public async Task Editor_checks_run_before_input_validation()
    {
        // An unauthorized caller should learn nothing about whether their payload was valid.
        await SeedCompetitionAsync();
        SignInAs(null);

        var result = await _controller.SaveState(
            HeftyMesterskapetCompetition.DefaultSlug, new SaveStateRequest { State = null });

        Assert.Equal(401, StatusOf(result));
    }

    [Fact]
    public async Task Editor_checks_run_before_the_competition_is_looked_up()
    {
        // A missing slug must not leak existence to an unauthorized caller via 404 vs 401.
        SignInAs(null);

        var result = await _controller.SaveState("does-not-exist", StateWithParticipant());

        Assert.Equal(401, StatusOf(result));
    }

    public void Dispose() => _db.Dispose();
}
