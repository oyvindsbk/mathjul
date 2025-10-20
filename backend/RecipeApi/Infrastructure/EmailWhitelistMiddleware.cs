using Azure.Security.KeyVault.Secrets;
using System.Security.Claims;
using System.Text.Json;
using RecipeApi.Features.Auth;

namespace RecipeApi.Infrastructure;

public class EmailWhitelistMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<EmailWhitelistMiddleware> _logger;
    private readonly SecretClient? _secretClient;
    private readonly IConfiguration _configuration;
    private readonly ITokenService _tokenService;
    private List<string> _approvedEmails = new();
    private DateTime _lastRefresh = DateTime.MinValue;
    private readonly TimeSpan _cacheExpiration = TimeSpan.FromMinutes(5);
    private readonly SemaphoreSlim _refreshLock = new(1, 1);

    public EmailWhitelistMiddleware(
        RequestDelegate next, 
        ILogger<EmailWhitelistMiddleware> logger,
        IConfiguration configuration,
        ITokenService tokenService,
        SecretClient? secretClient = null)
    {
        _next = next;
        _logger = logger;
        _configuration = configuration;
        _tokenService = tokenService;
        _secretClient = secretClient;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Skip authentication for OPTIONS requests (CORS preflight)
        if (context.Request.Method == "OPTIONS")
        {
            await _next(context);
            return;
        }

        // Check if in development mode without auth requirement
        var isDevelopment = _configuration["ASPNETCORE_ENVIRONMENT"] == "Development" &&
                           _configuration.GetValue<bool>("AllowUnauthenticated");

        // Skip authentication for health checks and auth endpoints only
        var path = context.Request.Path.Value?.ToLower() ?? "";
        if (path.StartsWith("/health") || 
            path.StartsWith("/.auth") ||
            path == "/api/auth/token") // Allow token endpoint for login
        {
            await _next(context);
            return;
        }

        // In development with AllowUnauthenticated, skip auth
        if (isDevelopment)
        {
            _logger.LogInformation("Development mode: skipping authentication for {Path}", path);
            await _next(context);
            return;
        }

        // Get user email from either JWT token or Static Web Apps authentication
        var email = GetUserEmailFromToken(context) ?? GetUserEmailFromStaticWebApps(context);

        if (string.IsNullOrEmpty(email))
        {
            _logger.LogWarning("Unauthenticated access attempt to {Path}", path);
            context.Response.StatusCode = 401;
            await context.Response.WriteAsJsonAsync(new 
            { 
                error = "Authentication required",
                message = "Please log in to access this resource."
            });
            return;
        }

        // Refresh whitelist if needed
        await RefreshWhitelistIfNeeded();

        // Check if email is approved
        if (!_approvedEmails.Contains(email.ToLower()))
        {
            _logger.LogWarning("Unauthorized access attempt by {Email} to {Path}", email, path);
            context.Response.StatusCode = 403;
            await context.Response.WriteAsJsonAsync(new 
            { 
                error = "Access denied",
                message = "Your account is not authorized to access this application. Please contact an administrator.",
                email = email
            });
            return;
        }

        _logger.LogInformation("Authorized access by {Email} to {Path}", email, path);
        await _next(context);
    }

    private string? GetUserEmailFromToken(HttpContext context)
    {
        // Check for JWT Bearer token in Authorization header
        var authHeader = context.Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var token = authHeader.Substring("Bearer ".Length).Trim();
        var principal = _tokenService.ValidateToken(token);
        
        if (principal == null)
        {
            return null;
        }

        // Extract email from claims
        var emailClaim = principal.Claims.FirstOrDefault(c => 
            c.Type == ClaimTypes.Email || 
            c.Type == "emails");

        return emailClaim?.Value;
    }

    private string? GetUserEmailFromStaticWebApps(HttpContext context)
    {
        // Static Web Apps passes user info in X-MS-CLIENT-PRINCIPAL header
        var principalHeader = context.Request.Headers["X-MS-CLIENT-PRINCIPAL"].FirstOrDefault();
        
        if (!string.IsNullOrEmpty(principalHeader))
        {
            try
            {
                var decodedBytes = Convert.FromBase64String(principalHeader);
                var decodedJson = System.Text.Encoding.UTF8.GetString(decodedBytes);
                var principal = JsonDocument.Parse(decodedJson);
                
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
                                return value.GetString();
                            }
                        }
                    }
                }

                // Fallback: try userId field which might be the email
                if (principal.RootElement.TryGetProperty("userId", out var userId))
                {
                    var userIdValue = userId.GetString();
                    if (!string.IsNullOrEmpty(userIdValue) && userIdValue.Contains("@"))
                    {
                        return userIdValue;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to parse X-MS-CLIENT-PRINCIPAL header");
            }
        }

        // Fallback for local development - check standard claims
        var emailClaim = context.User.Claims.FirstOrDefault(c => 
            c.Type == ClaimTypes.Email || 
            c.Type == "emails" ||
            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress");

        return emailClaim?.Value;
    }

    private async Task RefreshWhitelistIfNeeded()
    {
        if (DateTime.UtcNow - _lastRefresh < _cacheExpiration)
        {
            return; // Cache is still valid
        }

        await _refreshLock.WaitAsync();
        try
        {
            // Double-check after acquiring lock
            if (DateTime.UtcNow - _lastRefresh < _cacheExpiration)
            {
                return;
            }

            if (_secretClient != null)
            {
                try
                {
                    _logger.LogInformation("Refreshing email whitelist from Key Vault");
                    var secret = await _secretClient.GetSecretAsync("approved-users");
                    var emailsJson = secret.Value.Value;
                    
                    // Parse JSON array of emails
                    var emails = JsonSerializer.Deserialize<List<string>>(emailsJson);
                    if (emails != null)
                    {
                        _approvedEmails = emails.Select(e => e.ToLower()).ToList();
                        _lastRefresh = DateTime.UtcNow;
                        _logger.LogInformation("Loaded {Count} approved emails from Key Vault", _approvedEmails.Count);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to load email whitelist from Key Vault");
                    // Continue with cached list if available
                }
            }
            else
            {
                // Fallback: Load from configuration (for local development)
                var emailsFromConfig = _configuration.GetSection("ApprovedEmails").Get<List<string>>();
                if (emailsFromConfig != null && emailsFromConfig.Any())
                {
                    _approvedEmails = emailsFromConfig.Select(e => e.ToLower()).ToList();
                    _lastRefresh = DateTime.UtcNow;
                    _logger.LogInformation("Loaded {Count} approved emails from configuration", _approvedEmails.Count);
                }
            }
        }
        finally
        {
            _refreshLock.Release();
        }
    }
}
