using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using RecipeApi.Features.Auth;
using RecipeApi.Features.Recipes;
using RecipeApi.Infrastructure;
using Xunit;

namespace RecipeApi.Tests.Auth;

/// <summary>
/// Covers GET /api/user/{id}: the public profile behind /profil/[userId]. It must
/// resolve a display name, count only recipes the caller may see, and never carry
/// an email address.
/// </summary>
public class UserProfileTests : IDisposable
{
    private const string CallerEmail = "caller@example.com";
    private const string OwnerEmail = "owner@example.com";

    private readonly RecipeDbContext _db;

    public UserProfileTests()
    {
        var options = new DbContextOptionsBuilder<RecipeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new RecipeDbContext(options);
        _db.Database.EnsureCreated();
    }

    private UserController CreateController(string? email = CallerEmail, bool isAdmin = false)
    {
        var adminService = new Mock<IAdminService>();
        adminService.Setup(a => a.IsAdmin(It.IsAny<string>())).Returns(isAdmin);

        var identity = email == null
            ? new ClaimsIdentity()
            : new ClaimsIdentity([new Claim(ClaimTypes.Email, email)], "Test");

        return new UserController(_db, adminService.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
            }
        };
    }

    private User SeedUser(string email, string? nickname = null, string? name = null)
    {
        var user = new User
        {
            Email = email,
            DisplayName = "Seeded Display",
            Nickname = nickname,
            Name = name,
            CreatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        _db.SaveChanges();
        return user;
    }

    private void SeedRecipe(string title, string ownerEmail, string visibility = "Public")
    {
        _db.Recipes.Add(new Recipe { Title = title, OwnerEmail = ownerEmail, Visibility = visibility });
        _db.SaveChanges();
    }

    private static UserProfileDto Unwrap(ActionResult<UserProfileDto> result) =>
        result.Value ?? Assert.IsType<UserProfileDto>(Assert.IsType<OkObjectResult>(result.Result).Value);

    [Fact]
    public async Task ReturnsResolvedDisplayName()
    {
        var user = SeedUser(OwnerEmail, nickname: "Kokken");

        var profile = Unwrap(await CreateController().GetUserProfile(user.Id));

        Assert.Equal("Kokken", profile.DisplayName);
        Assert.Equal(user.Id, profile.Id);
    }

    [Fact]
    public async Task UnknownUserId_IsNotFound()
    {
        var result = await CreateController().GetUserProfile(9999);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    [Fact]
    public async Task WithoutAuthentication_IsUnauthorized()
    {
        var user = SeedUser(OwnerEmail);

        var result = await CreateController(email: null).GetUserProfile(user.Id);

        Assert.IsType<UnauthorizedObjectResult>(result.Result);
    }

    [Fact]
    public async Task RecipeCount_ExcludesRecipesTheCallerCannotSee()
    {
        var user = SeedUser(OwnerEmail);
        SeedRecipe("Offentlig", OwnerEmail);
        SeedRecipe("Hemmelig", OwnerEmail, visibility: "Private");
        SeedRecipe("Gruppe", OwnerEmail, visibility: "Group");

        var profile = Unwrap(await CreateController().GetUserProfile(user.Id));

        // Only the public one — a stranger must not learn how many private recipes exist.
        Assert.Equal(1, profile.RecipeCount);
    }

    [Fact]
    public async Task RecipeCount_IncludesYourOwnPrivateRecipes()
    {
        var user = SeedUser(CallerEmail);
        SeedRecipe("Offentlig", CallerEmail);
        SeedRecipe("Hemmelig", CallerEmail, visibility: "Private");

        var profile = Unwrap(await CreateController().GetUserProfile(user.Id));

        Assert.Equal(2, profile.RecipeCount);
    }

    [Fact]
    public async Task RecipeCount_IgnoresOtherPeoplesRecipes()
    {
        var user = SeedUser(OwnerEmail);
        SeedRecipe("Eierens", OwnerEmail);
        SeedRecipe("En annens", "someone-else@example.com");

        var profile = Unwrap(await CreateController().GetUserProfile(user.Id));

        Assert.Equal(1, profile.RecipeCount);
    }

    [Fact]
    public async Task Response_CarriesNoEmailAddress()
    {
        var user = SeedUser(OwnerEmail, nickname: "Kokken");

        var profile = Unwrap(await CreateController().GetUserProfile(user.Id));
        var json = JsonSerializer.Serialize(profile);

        Assert.DoesNotContain(OwnerEmail, json);
        Assert.DoesNotContain("@", json);
    }

    [Fact]
    public async Task UserWithNoNameSet_FallsBackToLocalPartNotTheAddress()
    {
        var user = SeedUser(OwnerEmail);
        _db.Users.Find(user.Id)!.DisplayName = string.Empty;
        _db.SaveChanges();

        var profile = Unwrap(await CreateController().GetUserProfile(user.Id));

        // Even with nothing set, the endpoint must not hand out a usable address.
        Assert.Equal("owner", profile.DisplayName);
        Assert.DoesNotContain("@", profile.DisplayName);
    }

    public void Dispose() => _db.Dispose();
}
