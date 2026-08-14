using System.Security.Claims;
using RecipeApi.Features.Auth;

namespace RecipeApi.Features.HeftyMesterskapet;

/// <summary>
/// Who is calling the Heftymesterskapet endpoints, and may they edit.
///
/// The Heftymesterskapet paths bypass <see cref="Infrastructure.EmailWhitelistMiddleware"/> (their
/// authorization uses a different list), so nothing upstream populates HttpContext.User for them.
/// Identity is therefore resolved here, from the token on the request.
/// </summary>
public sealed record HeftyMesterskapetCaller(string? Email, bool IsEditor)
{
    public static readonly HeftyMesterskapetCaller Anonymous = new(null, false);

    public bool IsSignedIn => !string.IsNullOrEmpty(Email);
}

public interface IHeftyMesterskapetCallerResolver
{
    Task<HeftyMesterskapetCaller> ResolveAsync(HttpContext context);
}

public sealed class HeftyMesterskapetCallerResolver : IHeftyMesterskapetCallerResolver
{
    /// <summary>
    /// Cookie set on this origin by the handoff exchange. The page is served from the backend, so a
    /// cookie is same-origin for it; the Bearer header is still accepted for direct API callers.
    /// </summary>
    public const string CookieName = "heftymesterskapet_token";

    private readonly ITokenService _tokenService;
    private readonly IHeftyMesterskapetEditorService _editorService;

    public HeftyMesterskapetCallerResolver(
        ITokenService tokenService,
        IHeftyMesterskapetEditorService editorService)
    {
        _tokenService = tokenService;
        _editorService = editorService;
    }

    public async Task<HeftyMesterskapetCaller> ResolveAsync(HttpContext context)
    {
        var token = ReadToken(context);
        if (string.IsNullOrEmpty(token))
        {
            return HeftyMesterskapetCaller.Anonymous;
        }

        var principal = _tokenService.ValidateToken(token);
        var email = GetEmail(principal);
        if (string.IsNullOrEmpty(email))
        {
            return HeftyMesterskapetCaller.Anonymous;
        }

        return new HeftyMesterskapetCaller(email, await _editorService.IsEditorAsync(email));
    }

    private static string? ReadToken(HttpContext context)
    {
        var authHeader = context.Request.Headers.Authorization.FirstOrDefault();
        if (!string.IsNullOrEmpty(authHeader) &&
            authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return authHeader["Bearer ".Length..].Trim();
        }

        return context.Request.Cookies[CookieName];
    }

    private static string? GetEmail(ClaimsPrincipal? principal) =>
        principal?.Claims.FirstOrDefault(c =>
            c.Type == ClaimTypes.Email ||
            c.Type == "emails")?.Value;
}
