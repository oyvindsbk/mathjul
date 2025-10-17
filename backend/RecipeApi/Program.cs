using Microsoft.EntityFrameworkCore;
using RecipeApi.Infrastructure;
using RecipeApi.Features.Recipes;
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;

var builder = WebApplication.CreateBuilder(args);

// Configure database context based on build configuration
#if DEBUG
// Use Aspire service defaults in development
builder.AddServiceDefaults();
builder.AddSqlServerDbContext<RecipeDbContext>("recipedb");
#else
// Production: Configure SQL Server directly
var connectionString = builder.Configuration.GetConnectionString("RecipeDb")
    ?? throw new InvalidOperationException("Connection string 'RecipeDb' not found.");

builder.Services.AddDbContext<RecipeDbContext>(options =>
    options.UseSqlServer(connectionString));
#endif

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Register RecipeImageProcessor service
builder.Services.AddScoped<IRecipeImageProcessor, RecipeImageProcessor>();

// Configure Key Vault client for email whitelist
SecretClient? secretClient = null;
if (!builder.Environment.IsDevelopment())
{
    var keyVaultUri = builder.Configuration["KeyVault__VaultUri"];
    if (!string.IsNullOrEmpty(keyVaultUri))
    {
        secretClient = new SecretClient(new Uri(keyVaultUri), new DefaultAzureCredential());
        builder.Services.AddSingleton(secretClient);
    }
}

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            if (builder.Environment.IsDevelopment())
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

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Only use HTTPS redirection in production
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Add email whitelist middleware before CORS
app.UseMiddleware<EmailWhitelistMiddleware>();

app.UseCors("AllowFrontend");
app.MapControllers();

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
            
            // In development, drop and recreate the database to apply schema changes
            if (app.Environment.IsDevelopment())
            {
                logger.LogInformation("Development mode: Dropping and recreating database...");
                await context.Database.EnsureDeletedAsync();
                await context.Database.EnsureCreatedAsync();
                logger.LogInformation("Database recreated successfully!");
            }
            else
            {
                // In production, only create if it doesn't exist
                await context.Database.EnsureCreatedAsync();
            }
            
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
