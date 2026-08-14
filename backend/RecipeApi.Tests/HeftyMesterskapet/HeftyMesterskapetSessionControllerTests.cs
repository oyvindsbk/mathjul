using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using RecipeApi.Features.Auth;
using RecipeApi.Features.HeftyMesterskapet;
using Xunit;

namespace RecipeApi.Tests.HeftyMesterskapet;

/// <summary>
/// The session endpoint decides which of the two modes the page renders, and the handoff carries
/// the JWT from the frontend login onto this origin.
///
/// /me must stay reachable without editor rights: a non-editor has to be able to learn that they
/// are a non-editor, or the page cannot explain why editing is unavailable.
/// </summary>
public sealed class HeftyMesterskapetSessionControllerTests
{
    private const string EditorEmail = "scorekeeper@example.com";
    private const string NonEditorEmail = "recipe-user@example.com";

    private readonly TokenService _tokenService;
    private readonly HeftyMesterskapetSessionController _controller;

    public HeftyMesterskapetSessionControllerTests()
    {
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

        _controller = new HeftyMesterskapetSessionController(
            new HeftyMesterskapetCallerResolver(_tokenService, editorService),
            new HeftyMesterskapetHandoffStore(),
            editorService,
            _tokenService,
            new FakeWebHostEnvironment())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
    }

    private void SignInAs(string email) =>
        _controller.ControllerContext.HttpContext!.Request.Headers.Authorization =
            $"Bearer {_tokenService.GenerateToken(email)}";

    private static T ValueOf<T>(ActionResult<T> result) =>
        (T)Assert.IsType<OkObjectResult>(result.Result).Value!;

    private static int StatusOf(IActionResult result) => result switch
    {
        ObjectResult o => o.StatusCode ?? 200,
        StatusCodeResult s => s.StatusCode,
        _ => 200
    };

    // ---- /me ----

    [Fact]
    public async Task Me_reports_an_anonymous_visitor_as_signed_out()
    {
        var session = ValueOf(await _controller.Me());

        Assert.False(session.SignedIn);
        Assert.False(session.IsEditor);
        Assert.Null(session.Email);
    }

    [Fact]
    public async Task Me_reports_an_editor_as_able_to_edit()
    {
        SignInAs(EditorEmail);

        var session = ValueOf(await _controller.Me());

        Assert.True(session.SignedIn);
        Assert.True(session.IsEditor);
        Assert.Equal(EditorEmail, session.Email);
    }

    [Fact]
    public async Task Me_reports_a_signed_in_non_editor_as_signed_in_but_not_an_editor()
    {
        // This is the case the page needs in order to say "you are logged in, but not a scorekeeper"
        // rather than looping them back through a login that would change nothing.
        SignInAs(NonEditorEmail);

        var session = ValueOf(await _controller.Me());

        Assert.True(session.SignedIn);
        Assert.False(session.IsEditor);
        Assert.Equal(NonEditorEmail, session.Email);
    }

    [Fact]
    public async Task Me_treats_a_garbled_token_as_signed_out()
    {
        _controller.ControllerContext.HttpContext!.Request.Headers.Authorization = "Bearer nonsense";

        var session = ValueOf(await _controller.Me());

        Assert.False(session.SignedIn);
        Assert.False(session.IsEditor);
    }

    // ---- handoff ----

    [Fact]
    public async Task An_editor_token_can_be_exchanged_for_a_session()
    {
        var issued = await _controller.IssueHandoff(
            new IssueHandoffRequest { Token = _tokenService.GenerateToken(EditorEmail) });
        var code = ValueOf(issued).Code;

        var exchanged = await _controller.ExchangeHandoff(new ExchangeHandoffRequest { Code = code });
        var session = ValueOf(exchanged);

        Assert.True(session.SignedIn);
        Assert.True(session.IsEditor);
        Assert.Equal(EditorEmail, session.Email);
    }

    [Fact]
    public async Task Exchanging_sets_the_session_cookie_on_this_origin()
    {
        var issued = await _controller.IssueHandoff(
            new IssueHandoffRequest { Token = _tokenService.GenerateToken(EditorEmail) });

        await _controller.ExchangeHandoff(new ExchangeHandoffRequest { Code = ValueOf(issued).Code });

        var setCookie = _controller.ControllerContext.HttpContext!.Response.Headers.SetCookie.ToString();
        Assert.Contains(HeftyMesterskapetCallerResolver.CookieName, setCookie);
        Assert.Contains("httponly", setCookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task A_handoff_code_cannot_be_replayed()
    {
        var issued = await _controller.IssueHandoff(
            new IssueHandoffRequest { Token = _tokenService.GenerateToken(EditorEmail) });
        var code = ValueOf(issued).Code;

        await _controller.ExchangeHandoff(new ExchangeHandoffRequest { Code = code });
        var replay = await _controller.ExchangeHandoff(new ExchangeHandoffRequest { Code = code });

        Assert.Equal(401, StatusOf(replay.Result!));
    }

    [Fact]
    public async Task An_unknown_handoff_code_is_rejected()
    {
        var result = await _controller.ExchangeHandoff(new ExchangeHandoffRequest { Code = "made-up" });

        Assert.Equal(401, StatusOf(result.Result!));
    }

    [Fact]
    public async Task A_non_editor_is_not_issued_a_handoff_code()
    {
        var result = await _controller.IssueHandoff(
            new IssueHandoffRequest { Token = _tokenService.GenerateToken(NonEditorEmail) });

        Assert.Equal(403, StatusOf(result.Result!));
    }

    [Fact]
    public async Task An_invalid_token_is_not_issued_a_handoff_code()
    {
        // Otherwise the endpoint would mint a handoff for any string a caller invented.
        var result = await _controller.IssueHandoff(new IssueHandoffRequest { Token = "not.a.jwt" });

        Assert.Equal(401, StatusOf(result.Result!));
    }

    [Fact]
    public async Task A_missing_token_is_rejected()
    {
        var result = await _controller.IssueHandoff(new IssueHandoffRequest { Token = null });

        Assert.Equal(400, StatusOf(result.Result!));
    }

    [Fact]
    public void Logging_out_clears_the_session_cookie()
    {
        var result = _controller.Logout();

        Assert.Equal(204, StatusOf(result));
        var setCookie = _controller.ControllerContext.HttpContext!.Response.Headers.SetCookie.ToString();
        Assert.Contains(HeftyMesterskapetCallerResolver.CookieName, setCookie);
    }

    private sealed class FakeWebHostEnvironment : IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Production";
        public string ApplicationName { get; set; } = "RecipeApi.Tests";
        public string WebRootPath { get; set; } = string.Empty;
        public Microsoft.Extensions.FileProviders.IFileProvider WebRootFileProvider { get; set; } =
            new Microsoft.Extensions.FileProviders.NullFileProvider();
        public string ContentRootPath { get; set; } = string.Empty;
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } =
            new Microsoft.Extensions.FileProviders.NullFileProvider();
    }
}
