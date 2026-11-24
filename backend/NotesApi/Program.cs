using System.Security.Claims;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using NotesApi.Features.Auth;
using NotesApi.Features.Days;
using NotesApi.Features.Import;
using NotesApi.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

#if DEBUG
builder.AddServiceDefaults();
#endif

// Database: the recipe app's database, notes schema. Aspire injects "recipedb" locally;
// production sets ConnectionStrings__NotesDb (no credentials -- managed identity).
var connectionString = builder.Configuration.GetConnectionString("recipedb")
    ?? builder.Configuration.GetConnectionString("NotesDb")
    ?? throw new InvalidOperationException("No connection string: set ConnectionStrings:NotesDb.");

builder.Services.AddDbContext<NotesDbContext>(options =>
{
    options.UseSqlServer(connectionString, NotesDbContextOptions.Configure);
    if (!builder.Environment.IsDevelopment())
        options.AddInterceptors(new AzureAdTokenInterceptor());
});
#if DEBUG
if (builder.Configuration.GetConnectionString("recipedb") is not null)
    builder.EnrichSqlServerDbContext<NotesDbContext>();
#endif

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<LocalClock>();
builder.Services.AddScoped<DayService>();
builder.Services.AddScoped<ImportService>();

// Auth: our own JWTs (issuer NotesApi, audience NotesFrontend), and every endpoint
// requires an allowlisted email unless it opts out with [AllowAnonymous].
builder.Services.Configure<NotesAuthOptions>(builder.Configuration.GetSection(NotesAuthOptions.SectionName));
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.AddSingleton<ITokenService, TokenService>();
builder.Services.AddHttpClient(AuthController.GoogleHttpClient);

var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = TokenService.ValidationParameters(jwtOptions);
    });

builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .RequireAssertion(context =>
        {
            var http = context.Resource as HttpContext;
            var allow = http?.RequestServices.GetRequiredService<IOptionsMonitor<NotesAuthOptions>>().CurrentValue;
            var email = context.User.FindFirstValue(ClaimTypes.Email);
            return allow?.IsAllowed(email) == true;
        })
        .Build();
});

builder.Services.AddControllers(o => o.Filters.Add<NotesExceptionFilter>())
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddHealthChecks();

var app = builder.Build();

app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
{
    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
    await context.Response.WriteAsJsonAsync(new { error = "An unexpected server error occurred." });
}));

app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health").AllowAnonymous();
app.MapControllers();

// Production schema changes run in CI with an admin connection; the app's own identity can
// only read and write rows. Locally, RecipeApi drops the whole database on every start, so
// the notes schema is recreated here (Aspire starts NotesApi after RecipeApi).
if (app.Environment.IsDevelopment())
{
    await DevDatabase.MigrateAndSeedAsync(app.Services);
}

app.Run();

public partial class Program;
