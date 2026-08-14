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
    private readonly IHostEnvironment _hostEnvironment;
    private List<string> _approvedEmails = new();
    private DateTime _lastRefresh = DateTime.MinValue;
    private readonly TimeSpan _cacheExpiration = TimeSpan.FromMinutes(5);
    private readonly SemaphoreSlim _refreshLock = new(1, 1);

    public EmailWhitelistMiddleware(
        RequestDelegate next,
        ILogger<EmailWhitelistMiddleware> logger,
        IConfiguration configuration,
        ITokenService tokenService,
        IHostEnvironment hostEnvironment,
        SecretClient? secretClient = null)
    {
        _next = next;
        _logger = logger;
        _configuration = configuration;
        _tokenService = tokenService;
        _hostEnvironment = hostEnvironment;
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

        // Check if in development mode — skip auth unless explicitly disabled
        var isLocalDev = _hostEnvironment.IsDevelopment() || _hostEnvironment.IsEnvironment("LocalDevelopment");
        var isDevelopment = isLocalDev && _configuration.GetValue("AllowUnauthenticated", defaultValue: true);

        // Skip authentication for health checks and auth endpoints only
        var path = context.Request.Path.Value?.ToLower() ?? "";
        if (path.StartsWith("/health") ||
            path.StartsWith("/api/public/") ||   // Deliberately public APIs (Heftymesterskapet). Trailing slash keeps the prefix tight.
            path == "/api/auth/google-token" ||  // Google OAuth callback
            path == "/api/auth/dev-token")        // Dev fake login
        {
            await _next(context);
            return;
        }

        // Protect Scalar / OpenAPI docs with a dedicated API key
        if (path.StartsWith("/scalar") || path.StartsWith("/openapi"))
        {
            var docsApiKey = _configuration["Scalar:ApiKey"];
            if (!string.IsNullOrWhiteSpace(docsApiKey))
            {
                var providedKey =
                    context.Request.Query["api-key"].FirstOrDefault() ??
                    context.Request.Headers.Authorization.FirstOrDefault()
                        ?.Replace("Bearer ", "", StringComparison.OrdinalIgnoreCase);

                if (providedKey != docsApiKey)
                {
                    context.Response.StatusCode = 401;
                    await context.Response.WriteAsJsonAsync(new
                    {
                        error = "Unauthorized",
                        message = "A valid api-key is required to access the API documentation."
                    });
                    return;
                }
            }
            await _next(context);
            return;
        }

        // In development with AllowUnauthenticated, skip auth but still populate User if a valid token is present
        if (isDevelopment)
        {
            _logger.LogInformation("Development mode (AllowUnauthenticated=true): skipping authentication for {Path}", path);
            var devPrincipal = GetPrincipalFromToken(context);
            if (devPrincipal != null)
                context.User = devPrincipal;
            await _next(context);
            return;
        }

        // Get and validate JWT token once
        var principal = GetPrincipalFromToken(context);
        var email = GetEmailFromPrincipal(principal);

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

        // Populate HttpContext.User so controllers can read claims via User.FindFirst(...)
        context.User = principal!;

        _logger.LogInformation("Authorized access by {Email} to {Path}", email, path);
        await _next(context);
    }

    private ClaimsPrincipal? GetPrincipalFromToken(HttpContext context)
    {
        var authHeader = context.Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return null;

        var token = authHeader.Substring("Bearer ".Length).Trim();
        return _tokenService.ValidateToken(token);
    }

    private static string? GetEmailFromPrincipal(ClaimsPrincipal? principal) =>
        principal?.Claims.FirstOrDefault(c =>
            c.Type == ClaimTypes.Email ||
            c.Type == "emails")?.Value;

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
