using Azure.Extensions.AspNetCore.Configuration.Secrets;
using Scalar.AspNetCore;
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using RecipeApi.Features.Auth;
using RecipeApi.Features.Recipes;
using RecipeApi.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

bool IsLocalDev(IHostEnvironment? env = null) =>
    (env ?? builder.Environment).IsDevelopment() || (env ?? builder.Environment).IsEnvironment("LocalDevelopment");

// Ensure user secrets are loaded in all local environments (not just "Development")
if (IsLocalDev())
{
    builder.Configuration.AddUserSecrets<Program>();
}

// Add service defaults for Aspire telemetry and health checks (available in Debug builds)
#if DEBUG
builder.AddServiceDefaults();
#endif

// Load secrets from Azure Key Vault (production only).
// Key Vault secret names use '--' as a separator, which maps to ':' in configuration.
// Example: 'ConnectionStrings--RecipeDb' -> ConnectionStrings:RecipeDb
if (!IsLocalDev())
{
    var keyVaultUri = builder.Configuration["KeyVault:VaultUri"];
    Console.WriteLine($"[KV] KeyVault:VaultUri = '{keyVaultUri}'");
    if (!string.IsNullOrEmpty(keyVaultUri))
    {
        Console.WriteLine("[KV] Calling AddAzureKeyVault...");
        builder.Configuration.AddAzureKeyVault(
            new Uri(keyVaultUri),
            new DefaultAzureCredential());
        Console.WriteLine("[KV] AddAzureKeyVault completed.");
    }
    else
    {
        Console.WriteLine("[KV] KeyVault__VaultUri is empty, skipping Key Vault.");
    }
}

// Configure database context
// When running via Aspire (Debug), the connection string is injected automatically via AddSqlServerDbContext
// When running standalone/Docker (Release), it reads from appsettings.json or environment variables
#if DEBUG
var hasAspireConnection = !string.IsNullOrEmpty(builder.Configuration.GetConnectionString("recipedb"));

if (hasAspireConnection)
{
    // Running via Aspire - use the injected connection string
    builder.AddSqlServerDbContext<RecipeDbContext>("recipedb");
}
else
{
    // Debug fallback - read from configuration
    var connectionString = builder.Configuration.GetConnectionString("RecipeDb") 
        ?? throw new InvalidOperationException("Connection string 'RecipeDb' not found in appsettings.json");
    
    builder.Services.AddDbContext<RecipeDbContext>(options =>
        options.UseSqlServer(connectionString));
}
#else
// Release build - connection string from config/Key Vault
var connectionString = builder.Configuration.GetConnectionString("RecipeDb");
Console.WriteLine($"[KV] ConnectionStrings:RecipeDb = '{(string.IsNullOrEmpty(connectionString) ? "(empty)" : "(set)")}' ");
if (string.IsNullOrEmpty(connectionString))
    throw new InvalidOperationException(
        "Connection string 'RecipeDb' not found. Ensure Key Vault secret 'ConnectionStrings--RecipeDb' exists.");

if (IsLocalDev())
{
    // Release build running locally (e.g. via Aspire) - plain SQL auth
    builder.Services.AddDbContext<RecipeDbContext>(options =>
        options.UseSqlServer(connectionString));
}
else
{
    // Production - uses managed identity authentication (no passwords)
    builder.Services.AddDbContext<RecipeDbContext>(options =>
        options.UseSqlServer(connectionString)
               .AddInterceptors(new AzureAdTokenInterceptor()));
}
#endif

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddHttpClient(); // Needed for Google OAuth token verification
builder.Services.AddHealthChecks();

// Register AI recipe processors: enabled when AiFoundry config is present, disabled otherwise.
var aiEndpoint = builder.Configuration["AiFoundry:Endpoint"];
var aiApiKey = builder.Configuration["AiFoundry:ApiKey"];
var imageEndpoint = builder.Configuration["AiFoundry:ImageEndpoint"];
var imageApiKey = builder.Configuration["AiFoundry:ImageApiKey"] ?? aiApiKey;

if (!string.IsNullOrEmpty(imageEndpoint) && !string.IsNullOrEmpty(imageApiKey))
{
    builder.Services.AddScoped<IRecipeImageProcessor, RecipeImageProcessor>();
    builder.Services.AddScoped<RecipeApi.Features.Matkasse.IMatkasseImageProcessor, RecipeApi.Features.Matkasse.MatkasseImageProcessor>();
}
else
{
    builder.Services.AddScoped<IRecipeImageProcessor, DisabledRecipeImageProcessor>();
    builder.Services.AddScoped<RecipeApi.Features.Matkasse.IMatkasseImageProcessor, RecipeApi.Features.Matkasse.DisabledMatkasseImageProcessor>();
}

if (!string.IsNullOrEmpty(aiEndpoint) && !string.IsNullOrEmpty(aiApiKey))
    builder.Services.AddScoped<IRecipeUrlProcessor, RecipeUrlProcessor>();
else
    builder.Services.AddScoped<IRecipeUrlProcessor, DisabledRecipeUrlProcessor>();

var prdEndpoint = builder.Configuration["AiFoundry:ImageEndpoint"] ?? aiEndpoint;
var prdApiKey = builder.Configuration["AiFoundry:ImageApiKey"] ?? aiApiKey;
if (!string.IsNullOrEmpty(prdEndpoint) && !string.IsNullOrEmpty(prdApiKey))
    builder.Services.AddScoped<RecipeApi.Features.FeaturePlanner.IPrdGenerationService, RecipeApi.Features.FeaturePlanner.PrdGenerationService>();
else
    builder.Services.AddScoped<RecipeApi.Features.FeaturePlanner.IPrdGenerationService, RecipeApi.Features.FeaturePlanner.DisabledPrdGenerationService>();
builder.Services.AddSingleton<ITokenService, TokenService>();
builder.Services.AddSingleton<IAdminService, AdminService>();

// Register Blob Storage service
var blobOptions = new BlobStorageOptions
{
    AccountName = builder.Configuration["BlobStorage:AccountName"] ?? string.Empty,
    ContainerName = builder.Configuration["BlobStorage:ContainerName"] ?? "recipe-images",
    ConnectionString = builder.Configuration["BlobStorage:ConnectionString"]
};
builder.Services.AddSingleton(blobOptions);
builder.Services.AddSingleton<IBlobStorageService, AzureBlobStorageService>();

// Configure Key Vault client for email whitelist (cached, refreshable reads)
if (!IsLocalDev())
{
    var keyVaultUri = builder.Configuration["KeyVault:VaultUri"];
    if (!string.IsNullOrEmpty(keyVaultUri))
    {
        builder.Services.AddSingleton(new SecretClient(new Uri(keyVaultUri), new DefaultAzureCredential()));
    }
}

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            if (IsLocalDev())
            {
                policy.SetIsOriginAllowed(origin => 
                    {
                        var uri = new Uri(origin);
                        return uri.Host == "localhost" || uri.Host == "127.0.0.1";
                    })
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            }
            else
            {
                var allowedOrigins = builder.Configuration
                    .GetSection("Cors:AllowedOrigins")
                    .Get<string[]>();
                
                if (allowedOrigins == null || allowedOrigins.Length == 0)
                {
                    throw new InvalidOperationException(
                        "CORS configuration is required in production. " +
                        "Set Cors:AllowedOrigins in appsettings.Production.json or via environment variables.");
                }
                
                policy.WithOrigins(allowedOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            }
        });
});

var app = builder.Build();

// Global exception handler — always returns JSON so clients can parse the response
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new
        {
            success = false,
            errorMessage = "An unexpected server error occurred."
        });
    });
});

// IMPORTANT: CORS must come before authentication/authorization middleware
// to handle preflight OPTIONS requests correctly
app.UseCors("AllowFrontend");

// Serve wwwroot before the whitelist middleware -- the 9-kamp app at /9-kamp.html is public
app.UseStaticFiles();

// Add email whitelist middleware after CORS
app.UseMiddleware<EmailWhitelistMiddleware>();

app.MapHealthChecks("/health");
app.MapControllers();

// OpenAPI + Scalar — registered after middleware so auth applies correctly
app.MapOpenApi();
app.MapScalarApiReference(options =>
{
    options.Title = "Recipe API";
    options.WithDefaultHttpClient(ScalarTarget.JavaScript, ScalarClient.Fetch);
    options.Authentication = new ScalarAuthenticationOptions
    {
        PreferredSecurityScheme = "Bearer"
    };
});

// Ensure database is created with retry logic for container startup
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<RecipeDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    
    var retryCount = 0;
    var maxRetries = 10;
    var delay = TimeSpan.FromSeconds(2);
    
    while (retryCount < maxRetries)
    {
        try
        {
            logger.LogInformation("Attempting to connect to database (attempt {Count}/{Max})...", retryCount + 1, maxRetries);
            
            if (IsLocalDev(app.Environment))
            {
                logger.LogInformation("Development mode: Dropping and recreating database...");
                await context.Database.EnsureDeletedAsync();
            }

            await context.Database.MigrateAsync();
            
            logger.LogInformation("Database connection successful!");
            break;
        }
        catch (Exception ex) when (retryCount < maxRetries - 1)
        {
            retryCount++;
            logger.LogWarning(ex, "Database connection failed. Retrying in {Delay} seconds...", delay.TotalSeconds);
            await Task.Delay(delay);
        }
    }
}

app.Run();
