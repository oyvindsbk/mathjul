using Microsoft.EntityFrameworkCore;
using RecipeApi.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Add Aspire service defaults and SQL Server integration
builder.AddServiceDefaults();
builder.AddSqlServerDbContext<RecipeDbContext>("recipedb");

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            policy.WithOrigins("http://localhost:3000") // Next.js dev server
                  .AllowAnyHeader()
                  .AllowAnyMethod();
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
            context.Database.EnsureCreated();
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
