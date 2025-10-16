using Microsoft.EntityFrameworkCore;
using RecipeApi.Infrastructure;
using RecipeApi.Features.Recipes;

var builder = WebApplication.CreateBuilder(args);

// Add Aspire service defaults and SQL Server integration
builder.AddServiceDefaults();
builder.AddSqlServerDbContext<RecipeDbContext>("recipedb");

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Register RecipeImageProcessor service
builder.Services.AddScoped<IRecipeImageProcessor, RecipeImageProcessor>();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            if (builder.Environment.IsDevelopment())
            {
                // In development, allow any localhost origin (for Aspire proxying and direct access)
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
                // In production, restrict to specific origins
                policy.WithOrigins("https://your-production-domain.com")
                    .AllowAnyHeader()
                    .AllowAnyMethod();
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
