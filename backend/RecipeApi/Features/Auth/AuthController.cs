using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace RecipeApi.Features.Auth;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly ITokenService _tokenService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(ITokenService tokenService, ILogger<AuthController> logger)
    {
        _tokenService = tokenService;
        _logger = logger;
    }

    [HttpPost("token")]
    public IActionResult GetToken()
    {
        // Get user email from Static Web Apps authentication header
        var principalHeader = Request.Headers["X-MS-CLIENT-PRINCIPAL"].FirstOrDefault();
        
        if (string.IsNullOrEmpty(principalHeader))
        {
            _logger.LogWarning("No X-MS-CLIENT-PRINCIPAL header found in token request");
            return Unauthorized(new { error = "Authentication required" });
        }

        try
        {
            var decodedBytes = Convert.FromBase64String(principalHeader);
            var decodedJson = System.Text.Encoding.UTF8.GetString(decodedBytes);
            var principal = JsonDocument.Parse(decodedJson);
            
            string? email = null;

            // Try to get email from claims
            if (principal.RootElement.TryGetProperty("claims", out var claims))
            {
                foreach (var claim in claims.EnumerateArray())
                {
                    if (claim.TryGetProperty("typ", out var type) && 
                        (type.GetString() == "emails" || type.GetString() == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"))
                    {
                        if (claim.TryGetProperty("val", out var value))
                        {
                            email = value.GetString();
                            break;
                        }
                    }
                }
            }

            // Fallback: try userId field
            if (string.IsNullOrEmpty(email) && principal.RootElement.TryGetProperty("userId", out var userId))
            {
                var userIdValue = userId.GetString();
                if (!string.IsNullOrEmpty(userIdValue) && userIdValue.Contains("@"))
                {
                    email = userIdValue;
                }
            }

            if (string.IsNullOrEmpty(email))
            {
                _logger.LogWarning("Could not extract email from X-MS-CLIENT-PRINCIPAL");
                return BadRequest(new { error = "Could not extract email from authentication principal" });
            }

            // Note: Email whitelist validation will be done by the EmailWhitelistMiddleware
            // when this endpoint is called, so if we get here, the user is already approved

            // Generate JWT token
            var token = _tokenService.GenerateToken(email);

            _logger.LogInformation("Generated token for user {Email}", email);

            return Ok(new
            {
                token,
                email,
                expiresIn = 86400 // 24 hours in seconds
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate token");
            return StatusCode(500, new { error = "Failed to generate token" });
        }
    }
}
