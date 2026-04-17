using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Infrastructure;
using System.Text.Json;

namespace RecipeApi.Features.Auth;

public record GoogleTokenRequest(string IdToken);

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly ITokenService _tokenService;
    private readonly ILogger<AuthController> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly RecipeDbContext _db;

    public AuthController(ITokenService tokenService, ILogger<AuthController> logger, IHttpClientFactory httpClientFactory, RecipeDbContext db)
    {
        _tokenService = tokenService;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _db = db;
    }

    /// <summary>
    /// Returns a real signed JWT for dev@example.com. Only available in LocalDevelopment / Development environments.
    /// </summary>
    [HttpPost("dev-token")]
    public IActionResult DevToken([FromServices] IHostEnvironment env)
    {
        var isLocalDev = env.IsDevelopment() || env.IsEnvironment("LocalDevelopment");
        if (!isLocalDev)
            return NotFound();

        const string devEmail = "dev@example.com";
        var token = _tokenService.GenerateToken(devEmail);
        return Ok(new { token, email = devEmail });
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        // Clear the auth token cookie
        Response.Cookies.Delete("auth_token");
        return Ok(new { message = "Logged out successfully" });
    }

    /// <summary>
    /// Upserts a user row based on the email in the JWT. Call this after every login.
    /// </summary>
    [HttpPost("ensure-user")]
    public async Task<IActionResult> EnsureUser()
    {
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
                    ?? User.FindFirst("email")?.Value;

        if (string.IsNullOrEmpty(email))
            return Unauthorized(new { error = "No email claim in token" });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user is null)
        {
            user = new User
            {
                Email = email,
                DisplayName = email.Split('@')[0],
                CreatedAt = DateTime.UtcNow
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();
            _logger.LogInformation("Created user record for {Email}", email);
        }

        return Ok(new { id = user.Id, email = user.Email, displayName = user.DisplayName, name = user.Name, nickname = user.Nickname });
    }

    /// <summary>
    /// Verifies a Google id_token (obtained via OAuth 2.0 code exchange) and returns a JWT.
    /// </summary>
    [HttpPost("google-token")]
    public async Task<IActionResult> GetTokenFromGoogleIdToken([FromBody] GoogleTokenRequest request)
    {
        if (string.IsNullOrEmpty(request.IdToken))
            return BadRequest(new { error = "id_token is required" });

        try
        {
            // Verify id_token and extract email via Google's tokeninfo endpoint
            var httpClient = _httpClientFactory.CreateClient();
            var tokenInfoUrl = $"https://oauth2.googleapis.com/tokeninfo?id_token={Uri.EscapeDataString(request.IdToken)}";
            var googleResponse = await httpClient.GetAsync(tokenInfoUrl);

            if (!googleResponse.IsSuccessStatusCode)
            {
                _logger.LogWarning("Google id_token verification failed with status {Status}", googleResponse.StatusCode);
                return Unauthorized(new { error = "Invalid Google id_token" });
            }

            var json = await googleResponse.Content.ReadAsStringAsync();
            var tokenInfo = JsonDocument.Parse(json);

            // Require verified email
            if (tokenInfo.RootElement.TryGetProperty("email_verified", out var verified) &&
                verified.GetString() != "true")
            {
                return Unauthorized(new { error = "Google email address is not verified" });
            }

            string? email = null;
            if (tokenInfo.RootElement.TryGetProperty("email", out var emailProp))
                email = emailProp.GetString();

            if (string.IsNullOrEmpty(email))
            {
                _logger.LogWarning("Could not extract email from Google tokeninfo response");
                return BadRequest(new { error = "Could not extract email from Google token" });
            }

            var token = _tokenService.GenerateToken(email);

            Response.Cookies.Append("auth_token", token, new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Lax,
                Expires = DateTimeOffset.UtcNow.AddDays(1)
            });

            _logger.LogInformation("Generated token via Google OAuth for {Email}", email);

            return Ok(new { token, email, expiresIn = 86400 });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to verify Google id_token");
            return StatusCode(500, new { error = "Failed to verify Google token" });
        }
    }
}
