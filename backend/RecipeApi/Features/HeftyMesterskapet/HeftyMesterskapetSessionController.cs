using Microsoft.AspNetCore.Mvc;
using RecipeApi.Features.Auth;

namespace RecipeApi.Features.HeftyMesterskapet;

/// <summary>
/// Session endpoints for the scoring page: who am I, and getting the frontend's JWT onto this
/// origin after login.
///
/// Sits under /api/heftymesterskapet/ (exempt from EmailWhitelistMiddleware) and is intentionally
/// reachable without editor rights -- a non-editor has to be able to learn that they are a
/// non-editor, or the page cannot tell them why editing is unavailable.
/// </summary>
[ApiController]
[Route("api/heftymesterskapet")]
public class HeftyMesterskapetSessionController : ControllerBase
{
    private readonly IHeftyMesterskapetCallerResolver _callerResolver;
    private readonly IHeftyMesterskapetHandoffStore _handoffStore;
    private readonly IHeftyMesterskapetEditorService _editorService;
    private readonly ITokenService _tokenService;
    private readonly IWebHostEnvironment _environment;

    public HeftyMesterskapetSessionController(
        IHeftyMesterskapetCallerResolver callerResolver,
        IHeftyMesterskapetHandoffStore handoffStore,
        IHeftyMesterskapetEditorService editorService,
        ITokenService tokenService,
        IWebHostEnvironment environment)
    {
        _callerResolver = callerResolver;
        _handoffStore = handoffStore;
        _editorService = editorService;
        _tokenService = tokenService;
        _environment = environment;
    }

    // GET /api/heftymesterskapet/me
    [HttpGet("me")]
    public async Task<ActionResult<HeftyMesterskapetSessionDto>> Me()
    {
        var caller = await _callerResolver.ResolveAsync(HttpContext);

        return Ok(new HeftyMesterskapetSessionDto
        {
            SignedIn = caller.IsSignedIn,
            Email = caller.Email,
            IsEditor = caller.IsEditor
        });
    }

    /// <summary>
    /// Called by the frontend after a successful Google login, with the JWT it just obtained.
    /// Returns a single-use code the page exchanges below, so the JWT itself never rides in a
    /// redirect URL.
    ///
    /// The presented token is validated and must belong to an editor, so this cannot be used to
    /// mint a handoff for an arbitrary string.
    /// </summary>
    // POST /api/heftymesterskapet/handoff
    [HttpPost("handoff")]
    public async Task<ActionResult<HandoffIssuedDto>> IssueHandoff([FromBody] IssueHandoffRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return BadRequest(new { error = "Mangler token" });
        }

        var principal = _tokenService.ValidateToken(request.Token);
        var email = principal?.Claims.FirstOrDefault(c =>
            c.Type == System.Security.Claims.ClaimTypes.Email || c.Type == "emails")?.Value;

        if (string.IsNullOrEmpty(email))
        {
            return Unauthorized(new { error = "Ugyldig token" });
        }

        if (!await _editorService.IsEditorAsync(email))
        {
            // Not an editor: no code is issued, but the page still shows them the scoreboard
            // read-only and explains why editing is unavailable.
            return StatusCode(403, new { error = "Ikke redaktør" });
        }

        return Ok(new HandoffIssuedDto { Code = _handoffStore.Issue(request.Token) });
    }

    /// <summary>
    /// Exchanges a handoff code for the JWT and sets it as a cookie on this origin, so subsequent
    /// writes from the page authenticate without the token being kept in JavaScript.
    /// </summary>
    // POST /api/heftymesterskapet/handoff/exchange
    [HttpPost("handoff/exchange")]
    public async Task<ActionResult<HeftyMesterskapetSessionDto>> ExchangeHandoff(
        [FromBody] ExchangeHandoffRequest request)
    {
        var token = string.IsNullOrWhiteSpace(request.Code) ? null : _handoffStore.Redeem(request.Code);
        if (token == null)
        {
            return Unauthorized(new { error = "Innloggingen er utløpt — prøv på nytt" });
        }

        Response.Cookies.Append(HeftyMesterskapetCallerResolver.CookieName, token, new CookieOptions
        {
            HttpOnly = true,
            Secure = !_environment.IsDevelopment() && !_environment.IsEnvironment("LocalDevelopment"),
            SameSite = SameSiteMode.Lax,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.AddDays(1)
        });

        // Report on the freshly redeemed token: the cookie set above is not readable back off this
        // same request, so the resolver would see an anonymous caller here.
        var email = EmailFrom(token);
        return Ok(new HeftyMesterskapetSessionDto
        {
            SignedIn = email != null,
            Email = email,
            IsEditor = await _editorService.IsEditorAsync(email)
        });
    }

    // POST /api/heftymesterskapet/logout
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete(HeftyMesterskapetCallerResolver.CookieName, new CookieOptions
        {
            Path = "/"
        });
        return NoContent();
    }

    private string? EmailFrom(string token) =>
        _tokenService.ValidateToken(token)?.Claims.FirstOrDefault(c =>
            c.Type == System.Security.Claims.ClaimTypes.Email || c.Type == "emails")?.Value;
}

public class HeftyMesterskapetSessionDto
{
    public bool SignedIn { get; set; }
    public string? Email { get; set; }
    public bool IsEditor { get; set; }
}

public class IssueHandoffRequest
{
    public string? Token { get; set; }
}

public class HandoffIssuedDto
{
    public string Code { get; set; } = string.Empty;
}

public class ExchangeHandoffRequest
{
    public string? Code { get; set; }
}
