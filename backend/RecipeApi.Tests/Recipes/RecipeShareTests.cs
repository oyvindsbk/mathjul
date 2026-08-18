using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using RecipeApi.Features.Recipes;
using Xunit;

namespace RecipeApi.Tests.Recipes;

/// <summary>
/// Covers the owner-facing share endpoints (GET/POST/DELETE .../share) on
/// <see cref="RecipesController"/> and the public read endpoint on
/// <see cref="PublicRecipesController"/>.
/// </summary>
public class RecipeShareTests
{
    private const string OtherEmail = "other@example.com";

    private static Recipe SeedRecipe(RecipeTestContext ctx, string visibility = "Public")
    {
        var recipe = new Recipe
        {
            Title = "Delt oppskrift",
            OwnerEmail = RecipeTestContext.OwnerEmail,
            Visibility = visibility
        };

        ctx.Db.Recipes.Add(recipe);
        ctx.Db.SaveChanges();
        return recipe;
    }

    private static ShareStatusDto UnwrapShare(ActionResult<ShareStatusDto> result) =>
        result.Value
        ?? Assert.IsType<ShareStatusDto>(Assert.IsType<OkObjectResult>(result.Result).Value);

    // ── Owner endpoints ─────────────────────────────────────────────────────

    [Fact]
    public async Task CreateShare_ReturnsAToken()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx);

        var result = await ctx.CreateController().CreateShare(recipe.Id);

        var dto = UnwrapShare(result);
        Assert.True(dto.IsShared);
        Assert.False(string.IsNullOrEmpty(dto.Token));
    }

    [Fact]
    public async Task CreateShare_CalledTwice_ReturnsTheSameToken()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx);
        var controller = ctx.CreateController();

        var first = UnwrapShare(await controller.CreateShare(recipe.Id));
        var second = UnwrapShare(await controller.CreateShare(recipe.Id));

        Assert.Equal(first.Token, second.Token);
    }

    [Fact]
    public async Task RevokeShare_ThenReShare_YieldsADifferentToken()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx);
        var controller = ctx.CreateController();

        var first = UnwrapShare(await controller.CreateShare(recipe.Id));
        await controller.RevokeShare(recipe.Id);
        var second = UnwrapShare(await controller.CreateShare(recipe.Id));

        Assert.NotEqual(first.Token, second.Token);
    }

    [Fact]
    public async Task NonOwner_GetsForbidden_OnGetShare()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx);

        var result = await ctx.CreateController(OtherEmail).GetShare(recipe.Id);

        var status = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(403, status.StatusCode);
    }

    [Fact]
    public async Task NonOwner_GetsForbidden_OnCreateShare()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx);

        var result = await ctx.CreateController(OtherEmail).CreateShare(recipe.Id);

        var status = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(403, status.StatusCode);
    }

    [Fact]
    public async Task NonOwner_GetsForbidden_OnRevokeShare()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx);

        var result = await ctx.CreateController(OtherEmail).RevokeShare(recipe.Id);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, status.StatusCode);
    }

    // ── Public endpoint ─────────────────────────────────────────────────────

    [Fact]
    public async Task RevokedToken_Returns404OnThePublicEndpoint()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx);
        var controller = ctx.CreateController();
        var share = UnwrapShare(await controller.CreateShare(recipe.Id));
        await controller.RevokeShare(recipe.Id);

        var result = await new PublicRecipesController(ctx.Db).GetSharedRecipe(share.Token!);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task PrivateRecipe_IsReadableThroughAnActiveToken()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx, visibility: "Private");
        var share = UnwrapShare(await ctx.CreateController().CreateShare(recipe.Id));

        var result = await new PublicRecipesController(ctx.Db).GetSharedRecipe(share.Token!);

        var dto = Assert.IsType<SharedRecipeDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(recipe.Title, dto.Title);
    }

    [Fact]
    public void SharedRecipeDto_HasNoEmailProperty()
    {
        var properties = typeof(SharedRecipeDto).GetProperties();

        Assert.DoesNotContain(properties, p => p.Name.Contains("Email", StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// A token that never existed has to be as dead as a revoked one -- same 404,
    /// so a caller cannot tell "revoked" from "never minted" by probing.
    /// </summary>
    [Theory]
    [InlineData("aldri-utstedt-token")]
    [InlineData("!!ikke-base64url!!")]
    [InlineData("")]
    public async Task UnknownOrMalformedToken_Returns404(string token)
    {
        using var ctx = new RecipeTestContext();
        SeedRecipe(ctx);

        var result = await new PublicRecipesController(ctx.Db).GetSharedRecipe(token);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    /// <summary>LastAccessedAt is throttled, so a burst of reads costs one write.</summary>
    [Fact]
    public async Task RepeatedPublicReads_UpdateLastAccessedAtOnlyOnce()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx);
        var share = UnwrapShare(await ctx.CreateController().CreateShare(recipe.Id));
        var publicController = new PublicRecipesController(ctx.Db);

        await publicController.GetSharedRecipe(share.Token!);
        var afterFirst = ctx.Db.RecipeShares.Single(s => s.Token == share.Token).LastAccessedAt;

        await publicController.GetSharedRecipe(share.Token!);
        var afterSecond = ctx.Db.RecipeShares.Single(s => s.Token == share.Token).LastAccessedAt;

        Assert.NotNull(afterFirst);
        Assert.Equal(afterFirst, afterSecond);
    }

    /// <summary>
    /// Two creates racing for the same recipe must settle on one shared token, not
    /// surface the filtered unique index's rejection as a 500. This is the ordinary
    /// case, not an exotic one: React StrictMode double-invokes effects in dev, and a
    /// double-click does the same in production.
    ///
    /// The InMemory provider enforces no unique indexes (see RecipeTestContext), so
    /// this cannot reproduce the actual DbUpdateException -- it pins the observable
    /// contract instead: whatever the interleaving, both callers get 200 and the same
    /// token, and only one active share exists afterwards.
    /// </summary>
    [Fact]
    public async Task ConcurrentCreates_YieldOneSharedToken()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx);

        var first = UnwrapShare(await ctx.CreateController().CreateShare(recipe.Id));
        var second = UnwrapShare(await ctx.CreateController().CreateShare(recipe.Id));

        Assert.Equal(first.Token, second.Token);
        Assert.Single(ctx.Db.RecipeShares.Where(s => s.RecipeId == recipe.Id && s.RevokedAt == null));
    }

    // ── Admin ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Admin_CanCreateAndRevokeSomeoneElsesShare()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx);
        var admin = ctx.CreateController(OtherEmail, isAdmin: true);

        var created = UnwrapShare(await admin.CreateShare(recipe.Id));
        Assert.True(created.IsShared);

        Assert.IsType<NoContentResult>(await admin.RevokeShare(recipe.Id));

        var afterRevoke = await new PublicRecipesController(ctx.Db).GetSharedRecipe(created.Token!);
        Assert.IsType<NotFoundObjectResult>(afterRevoke.Result);
    }

    [Fact]
    public async Task Admin_CanReadSomeoneElsesShareStatus()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx);
        var created = UnwrapShare(await ctx.CreateController().CreateShare(recipe.Id));

        var status = UnwrapShare(await ctx.CreateController(OtherEmail, isAdmin: true).GetShare(recipe.Id));

        Assert.True(status.IsShared);
        Assert.Equal(created.Token, status.Token);
    }

    // ── Share URL construction ──────────────────────────────────────────────
    //
    // The link is the whole feature: if it points at the API host, or at http://,
    // the recipient gets an auth error or a blocked upgrade instead of a recipe.

    private static IConfiguration ConfigWithBase(string? baseUrl) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Sharing:PublicBaseUrl"] = baseUrl
            })
            .Build();

    [Fact]
    public async Task ShareUrl_UsesConfiguredPublicBaseUrl_NotTheRequestHost()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx);

        var controller = ctx.CreateController(
            configuration: ConfigWithBase("https://mathjul.example.com"),
            configureRequest: req =>
            {
                // The API's own origin -- never where /delt/ is served from.
                req.Scheme = "http";
                req.Host = new HostString("recipe-api.internal");
            });

        var share = UnwrapShare(await controller.CreateShare(recipe.Id));

        Assert.Equal($"https://mathjul.example.com/delt/{share.Token}", share.ShareUrl);
    }

    [Fact]
    public async Task ShareUrl_FallsBackToForwardedProto_WhenTlsTerminatesAtTheProxy()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx);

        // No configured base: Container Apps ingress terminates TLS and forwards
        // over plain http, so Request.Scheme alone would emit an http:// link.
        var controller = ctx.CreateController(
            configuration: ConfigWithBase(null),
            configureRequest: req =>
            {
                req.Scheme = "http";
                req.Host = new HostString("app.example.com");
                req.Headers["X-Forwarded-Proto"] = "https";
            });

        var share = UnwrapShare(await controller.CreateShare(recipe.Id));

        Assert.StartsWith("https://app.example.com/delt/", share.ShareUrl);
    }

    [Fact]
    public async Task ShareUrl_TakesFirstForwardedProto_WhenProxiesChain()
    {
        using var ctx = new RecipeTestContext();
        var recipe = SeedRecipe(ctx);

        var controller = ctx.CreateController(
            configuration: ConfigWithBase(null),
            configureRequest: req =>
            {
                req.Scheme = "http";
                req.Host = new HostString("app.example.com");
                req.Headers["X-Forwarded-Proto"] = "https,http";
            });

        var share = UnwrapShare(await controller.CreateShare(recipe.Id));

        Assert.StartsWith("https://app.example.com/delt/", share.ShareUrl);
    }
}
