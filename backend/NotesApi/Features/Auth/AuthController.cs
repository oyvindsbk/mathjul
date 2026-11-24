using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace NotesApi.Features.Auth;

public record GoogleTokenRequest(string IdToken);

public record TokenResponse(string Token, string Email);

[ApiController]
[Route("api/auth")]
[AllowAnonymous]
public class AuthController(
    ITokenService tokens,
    IOptions<NotesAuthOptions> options,
    IHttpClientFactory httpClientFactory,
    IHostEnvironment env,
    ILogger<AuthController> logger) : ControllerBase
{
    public const string GoogleHttpClient = "google-tokeninfo";

    /// <summary>Signs in as the configured dev email. Local development only.</summary>
    [HttpPost("dev-token")]
    public ActionResult<TokenResponse> DevToken()
    {
        if (!env.IsDevelopment())
            return NotFound();

        var email = options.Value.DevEmail;
        if (!options.Value.IsAllowed(email))
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Dev email is not on the allowlist" });

        return new TokenResponse(tokens.GenerateToken(email), email);
    }

    /// <summary>
    /// Verifies a Google id_token and returns a notes JWT, but only for an allowlisted
    /// email. The token must be issued for this app's Google client id.
    /// </summary>
    [HttpPost("google-token")]
    public async Task<ActionResult<TokenResponse>> GoogleToken([FromBody] GoogleTokenRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.IdToken))
            return BadRequest(new { error = "idToken is required" });

        var clientId = options.Value.GoogleClientId;
        if (string.IsNullOrWhiteSpace(clientId))
        {
            logger.LogError("Notes:GoogleClientId is not configured");
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "Google sign-in is not configured" });
        }

        var http = httpClientFactory.CreateClient(GoogleHttpClient);
        using var response = await http.GetAsync(
            $"https://oauth2.googleapis.com/tokeninfo?id_token={Uri.EscapeDataString(request.IdToken)}", ct);
        if (!response.IsSuccessStatusCode)
            return Unauthorized(new { error = "Invalid Google id_token" });

        using var info = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var root = info.RootElement;
        string? Get(string name) => root.TryGetProperty(name, out var v) ? v.GetString() : null;

        if (Get("aud") != clientId)
            return Unauthorized(new { error = "Google id_token was issued for another client" });
        if (Get("email_verified") != "true")
            return Unauthorized(new { error = "Google email is not verified" });

        var email = Get("email");
        if (!options.Value.IsAllowed(email))
        {
            logger.LogWarning("Sign-in refused for {Email}: not on the notes allowlist", email);
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Not allowed" });
        }

        return new TokenResponse(tokens.GenerateToken(email!), email!);
    }
}
