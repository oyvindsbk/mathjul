using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;
using NotesApi.Features.Auth;
using NotesApi.Infrastructure;

namespace NotesApi.Tests;

public class NotesApiFactory : WebApplicationFactory<Program>
{
    public const string Secret = "test-notes-secret-key-at-least-32-bytes-long";
    public const string AllowedEmail = "me@example.com";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:NotesDb", "Server=unused;Database=unused");
        builder.UseSetting("Jwt:SecretKey", Secret);
        builder.UseSetting("Notes:AllowedEmails", $"{AllowedEmail}, other@example.com");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<NotesDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<NotesDbContext>>();
            var name = Guid.NewGuid().ToString();
            services.AddDbContext<NotesDbContext>(o => o.UseInMemoryDatabase(name));
        });
    }

    public static string Token(string email, string issuer = JwtOptions.DefaultIssuer, string audience = JwtOptions.DefaultAudience)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Secret));
        var token = new JwtSecurityToken(issuer, audience,
            [new Claim(ClaimTypes.Email, email)],
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public class AuthTests(NotesApiFactory factory) : IClassFixture<NotesApiFactory>
{
    private async Task<HttpStatusCode> GetContexts(string? token)
    {
        var client = factory.CreateClient();
        if (token is not null)
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return (await client.GetAsync("/api/contexts")).StatusCode;
    }

    [Fact]
    public async Task Health_is_public() =>
        Assert.Equal(HttpStatusCode.OK, (await factory.CreateClient().GetAsync("/health")).StatusCode);

    [Fact]
    public async Task Anonymous_requests_are_rejected() =>
        Assert.Equal(HttpStatusCode.Unauthorized, await GetContexts(null));

    [Fact]
    public async Task An_allowlisted_email_gets_in() =>
        Assert.Equal(HttpStatusCode.OK, await GetContexts(NotesApiFactory.Token(NotesApiFactory.AllowedEmail)));

    [Fact]
    public async Task Allowlist_match_ignores_case() =>
        Assert.Equal(HttpStatusCode.OK, await GetContexts(NotesApiFactory.Token("ME@Example.com")));

    [Fact]
    public async Task A_valid_token_for_another_email_is_forbidden() =>
        Assert.Equal(HttpStatusCode.Forbidden, await GetContexts(NotesApiFactory.Token("stranger@example.com")));

    [Fact]
    public async Task A_recipe_app_token_is_rejected_even_with_the_same_secret() =>
        Assert.Equal(HttpStatusCode.Unauthorized,
            await GetContexts(NotesApiFactory.Token(NotesApiFactory.AllowedEmail, issuer: "RecipeApi", audience: "RecipeFrontend")));

    [Fact]
    public async Task Dev_token_does_not_exist_outside_development()
    {
        var response = await factory.CreateClient().PostAsync("/api/auth/dev-token", null);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Tokens_from_the_token_service_are_accepted()
    {
        var tokens = factory.Services.GetRequiredService<ITokenService>();
        Assert.Equal(HttpStatusCode.OK, await GetContexts(tokens.GenerateToken(NotesApiFactory.AllowedEmail)));
    }

    [Fact]
    public async Task Moving_to_another_context_without_an_index_appends_over_http()
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", NotesApiFactory.Token(NotesApiFactory.AllowedEmail));
        var json = new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web)
        {
            Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() },
        };
        var context = await (await client.PostAsJsonAsync("/api/contexts", new { name = "Flytt" }))
            .Content.ReadFromJsonAsync<Features.Contexts.ContextDto>(json);
        var item = await (await client.PostAsJsonAsync("/api/days/2026-01-05/items", new { kind = "Todo", text = "x", contextId = (int?)null }))
            .Content.ReadFromJsonAsync<Features.Days.ItemDto>(json);

        var response = await client.PostAsJsonAsync($"/api/items/{item!.Id}/move", new { contextId = context!.Id });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(context.Id, (await response.Content.ReadFromJsonAsync<Features.Days.ItemDto>(json))!.ContextId);
    }

    [Fact]
    public async Task Api_errors_come_back_as_json_with_their_status()
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", NotesApiFactory.Token(NotesApiFactory.AllowedEmail));

        var response = await client.PatchAsJsonAsync("/api/items/999", new { text = "x" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Contains("Item not found", await response.Content.ReadAsStringAsync());
    }
}
