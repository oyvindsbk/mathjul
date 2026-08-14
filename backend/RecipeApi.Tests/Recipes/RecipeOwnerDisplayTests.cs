using Microsoft.AspNetCore.Mvc;
using RecipeApi.Features.Auth;
using RecipeApi.Features.Recipes;
using Xunit;

namespace RecipeApi.Tests.Recipes;

/// <summary>
/// Recipes reference their owner by email with no foreign key to Users, so the owner's
/// name and profile id are resolved after projection. These cover that both a matched
/// and an unmatched owner produce something sensible.
/// </summary>
public class RecipeOwnerDisplayTests
{
    private static User SeedUser(RecipeTestContext ctx, string email, string? nickname = null, string? name = null)
    {
        var user = new User
        {
            Email = email,
            DisplayName = "Seeded Display",
            Nickname = nickname,
            Name = name,
            CreatedAt = DateTime.UtcNow
        };

        ctx.Db.Users.Add(user);
        ctx.Db.SaveChanges();
        return user;
    }

    private static async Task<RecipeDto> GetRecipeFromListAsync(RecipeTestContext ctx, int recipeId)
    {
        var controller = ctx.CreateController();
        var result = await controller.GetAllRecipes();
        var recipes = result.Value
            ?? Assert.IsType<List<RecipeDto>>(Assert.IsType<OkObjectResult>(result.Result).Value);

        return Assert.Single(recipes, r => r.Id == recipeId);
    }

    [Fact]
    public async Task ListEndpoint_ResolvesOwnerNameAndUserId()
    {
        using var ctx = new RecipeTestContext();
        var user = SeedUser(ctx, RecipeTestContext.OwnerEmail, nickname: "Kokken");
        var recipe = ctx.SeedRecipe("Med eier");

        var dto = await GetRecipeFromListAsync(ctx, recipe.Id);

        Assert.Equal("Kokken", dto.OwnerDisplayName);
        Assert.Equal(user.Id, dto.OwnerUserId);
    }

    [Fact]
    public async Task OwnerWithoutUsersRow_FallsBackToEmailAndHasNoProfileLink()
    {
        using var ctx = new RecipeTestContext();
        // No Users row seeded — mirrors seed recipes and removed accounts.
        var recipe = ctx.SeedRecipe("Foreldreløs");

        var dto = await GetRecipeFromListAsync(ctx, recipe.Id);

        // Shown by local part, not the full address, and with no profile to link to.
        Assert.Equal("owner", dto.OwnerDisplayName);
        Assert.DoesNotContain("@", dto.OwnerDisplayName!);
        Assert.Null(dto.OwnerUserId);
    }

    [Fact]
    public async Task RecipeWithoutOwner_LeavesBothFieldsNull()
    {
        using var ctx = new RecipeTestContext();
        var recipe = ctx.SeedRecipe("Ingen eier", ownerEmail: null);

        var dto = await GetRecipeFromListAsync(ctx, recipe.Id);

        Assert.Null(dto.OwnerDisplayName);
        Assert.Null(dto.OwnerUserId);
    }

    [Fact]
    public async Task DetailEndpoint_ResolvesOwnerTheSameWay()
    {
        using var ctx = new RecipeTestContext();
        var user = SeedUser(ctx, RecipeTestContext.OwnerEmail, name: "Ola Nordmann");
        var recipe = ctx.SeedRecipe("Detaljvisning");

        var controller = ctx.CreateController();
        var result = await controller.GetRecipeById(recipe.Id);
        var detail = Assert.IsType<RecipeDetailDto>(Assert.IsType<OkObjectResult>(result.Result).Value);

        Assert.Equal("Ola Nordmann", detail.OwnerDisplayName);
        Assert.Equal(user.Id, detail.OwnerUserId);
    }
}
