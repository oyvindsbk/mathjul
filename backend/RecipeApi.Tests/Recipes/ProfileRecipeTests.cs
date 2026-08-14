using Microsoft.AspNetCore.Mvc;
using RecipeApi.Features.Auth;
using RecipeApi.Features.Recipes;
using Xunit;

namespace RecipeApi.Tests.Recipes;

/// <summary>
/// Covers the two profile endpoints: /api/recipes/mine (the caller's own recipes,
/// regardless of visibility) and /api/recipes/by-user/{id} (someone else's recipes,
/// narrowed to what the *caller* may see).
/// </summary>
public class ProfileRecipeTests
{
    private const string OtherEmail = "other@example.com";

    private static User SeedUser(RecipeTestContext ctx, string email, string? nickname = null)
    {
        var user = new User
        {
            Email = email,
            DisplayName = email,
            Nickname = nickname,
            CreatedAt = DateTime.UtcNow
        };

        ctx.Db.Users.Add(user);
        ctx.Db.SaveChanges();
        return user;
    }

    private static Recipe SeedRecipe(
        RecipeTestContext ctx, string title, string ownerEmail, string visibility = "Public")
    {
        var recipe = new Recipe
        {
            Title = title,
            OwnerEmail = ownerEmail,
            Visibility = visibility
        };

        ctx.Db.Recipes.Add(recipe);
        ctx.Db.SaveChanges();
        return recipe;
    }

    private static List<RecipeDto> Unwrap(ActionResult<List<RecipeDto>> result) =>
        result.Value
        ?? Assert.IsType<List<RecipeDto>>(Assert.IsType<OkObjectResult>(result.Result).Value);

    // ── /api/recipes/mine ──────────────────────────────────────────────────

    [Fact]
    public async Task Mine_ReturnsOnlyCallersOwnRecipes()
    {
        using var ctx = new RecipeTestContext();
        SeedRecipe(ctx, "Min", RecipeTestContext.OwnerEmail);
        SeedRecipe(ctx, "Andres", OtherEmail);

        var result = await ctx.CreateController().GetMyRecipes();

        var titles = Unwrap(result).Select(r => r.Title).ToList();
        Assert.Equal(["Min"], titles);
    }

    [Fact]
    public async Task Mine_IncludesOwnPrivateRecipes()
    {
        using var ctx = new RecipeTestContext();
        SeedRecipe(ctx, "Hemmelig", RecipeTestContext.OwnerEmail, visibility: "Private");

        var result = await ctx.CreateController().GetMyRecipes();

        Assert.Contains("Hemmelig", Unwrap(result).Select(r => r.Title));
    }

    [Fact]
    public async Task Mine_WithoutAuthentication_IsUnauthorized()
    {
        using var ctx = new RecipeTestContext();

        var result = await ctx.CreateController(email: null).GetMyRecipes();

        Assert.IsType<UnauthorizedObjectResult>(result.Result);
    }

    [Fact]
    public async Task Mine_OrdersNewestFirst()
    {
        using var ctx = new RecipeTestContext();
        var older = SeedRecipe(ctx, "Eldre", RecipeTestContext.OwnerEmail);
        var newer = SeedRecipe(ctx, "Nyere", RecipeTestContext.OwnerEmail);

        older.CreatedAt = DateTime.UtcNow.AddDays(-5);
        newer.CreatedAt = DateTime.UtcNow;
        ctx.Db.SaveChanges();

        var result = await ctx.CreateController().GetMyRecipes();

        var titles = Unwrap(result).Select(r => r.Title).ToList();
        Assert.Equal(["Nyere", "Eldre"], titles);
    }

    // ── /api/recipes/by-user/{id} ──────────────────────────────────────────

    [Fact]
    public async Task ByUser_ReturnsThatUsersPublicRecipes()
    {
        using var ctx = new RecipeTestContext();
        var other = SeedUser(ctx, OtherEmail, nickname: "Kokken");
        SeedRecipe(ctx, "Andres offentlige", OtherEmail);
        SeedRecipe(ctx, "Min egen", RecipeTestContext.OwnerEmail);

        var result = await ctx.CreateController().GetRecipesByUser(other.Id);

        var titles = Unwrap(result).Select(r => r.Title).ToList();
        Assert.Equal(["Andres offentlige"], titles);
    }

    /// <summary>
    /// The core access rule: asking for another user's recipes must not expose the
    /// ones they marked Private.
    /// </summary>
    [Fact]
    public async Task ByUser_HidesOtherUsersPrivateRecipes()
    {
        using var ctx = new RecipeTestContext();
        var other = SeedUser(ctx, OtherEmail);
        SeedRecipe(ctx, "Andres offentlige", OtherEmail);
        SeedRecipe(ctx, "Andres hemmelige", OtherEmail, visibility: "Private");

        var result = await ctx.CreateController().GetRecipesByUser(other.Id);

        var titles = Unwrap(result).Select(r => r.Title).ToList();
        Assert.Equal(["Andres offentlige"], titles);
        Assert.DoesNotContain("Andres hemmelige", titles);
    }

    [Fact]
    public async Task ByUser_HidesGroupRecipesTheCallerDoesNotShare()
    {
        using var ctx = new RecipeTestContext();
        var other = SeedUser(ctx, OtherEmail);
        SeedRecipe(ctx, "Gruppeoppskrift", OtherEmail, visibility: "Group");

        var result = await ctx.CreateController().GetRecipesByUser(other.Id);

        // The caller is in no group, so a Group-visible recipe must not surface.
        Assert.Empty(Unwrap(result));
    }

    [Fact]
    public async Task ByUser_ViewingYourself_StillShowsYourPrivateRecipes()
    {
        using var ctx = new RecipeTestContext();
        var me = SeedUser(ctx, RecipeTestContext.OwnerEmail);
        SeedRecipe(ctx, "Min hemmelige", RecipeTestContext.OwnerEmail, visibility: "Private");

        var result = await ctx.CreateController().GetRecipesByUser(me.Id);

        Assert.Contains("Min hemmelige", Unwrap(result).Select(r => r.Title));
    }

    [Fact]
    public async Task ByUser_UnknownUserId_IsNotFound()
    {
        using var ctx = new RecipeTestContext();

        var result = await ctx.CreateController().GetRecipesByUser(9999);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task ByUser_WithoutAuthentication_IsUnauthorized()
    {
        using var ctx = new RecipeTestContext();
        var other = SeedUser(ctx, OtherEmail);

        var result = await ctx.CreateController(email: null).GetRecipesByUser(other.Id);

        Assert.IsType<UnauthorizedObjectResult>(result.Result);
    }

    [Fact]
    public async Task ByUser_LikeFlagReflectsTheCallerNotTheOwner()
    {
        using var ctx = new RecipeTestContext();
        var other = SeedUser(ctx, OtherEmail);
        var recipe = SeedRecipe(ctx, "Andres offentlige", OtherEmail);

        // The profile owner liked their own recipe; the caller did not.
        ctx.Db.RecipeLikes.Add(new RecipeLike { RecipeId = recipe.Id, UserEmail = OtherEmail });
        ctx.Db.SaveChanges();

        var result = await ctx.CreateController().GetRecipesByUser(other.Id);

        var dto = Assert.Single(Unwrap(result));
        Assert.False(dto.IsLikedByMe);
    }
}
