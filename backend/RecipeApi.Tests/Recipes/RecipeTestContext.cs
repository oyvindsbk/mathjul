using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RecipeApi.Features.Auth;
using RecipeApi.Features.Recipes;
using RecipeApi.Infrastructure;

namespace RecipeApi.Tests.Recipes;

/// <summary>
/// Builds an isolated in-memory database and a RecipesController wired to it.
///
/// Note: the InMemory provider enforces neither foreign keys nor unique indexes, so it
/// cannot verify the Cascade/Restrict behaviour of RecipeSideDishes. That is covered by
/// the migration applying against SQL Server. These tests target the validation logic.
/// </summary>
public sealed class RecipeTestContext : IDisposable
{
    public const string OwnerEmail = "owner@example.com";

    public RecipeDbContext Db { get; }

    /// <summary>The URL processor mock handed to the last created controller.</summary>
    public Mock<IRecipeUrlProcessor> UrlProcessor { get; } = new();

    public RecipeTestContext()
    {
        var options = new DbContextOptionsBuilder<RecipeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        Db = new RecipeDbContext(options);
        Db.Database.EnsureCreated();
    }

    /// <summary>Creates a controller acting as <paramref name="email"/> (defaults to the recipe owner).</summary>
    public RecipesController CreateController(string? email = OwnerEmail, bool isAdmin = false)
    {
        var adminService = new Mock<IAdminService>();
        adminService.Setup(a => a.IsAdmin(It.IsAny<string>())).Returns(isAdmin);

        var blobStorage = new Mock<IBlobStorageService>();
        blobStorage
            .Setup(b => b.DeleteByPrefixAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var controller = new RecipesController(
            Db,
            new Mock<IRecipeImageProcessor>().Object,
            UrlProcessor.Object,
            blobStorage.Object,
            adminService.Object,
            new ConfigurationBuilder().Build(),
            NullLogger<RecipesController>.Instance);

        var identity = email == null
            ? new ClaimsIdentity()
            : new ClaimsIdentity([new Claim(ClaimTypes.Email, email)], "Test");

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };

        return controller;
    }

    /// <summary>
    /// Returns the Tilbehør category. EnsureCreated applies the HasData seed on the
    /// InMemory provider, so the row already exists; this only resolves it.
    /// </summary>
    public Category SeedTilbehorCategory() => GetCategory(RecipeCategories.TilbehorId);

    /// <summary>Resolves a seeded category, or creates it if the seed did not cover it.</summary>
    public Category SeedCategory(int id, string name, string group)
    {
        var existing = Db.Categories.Find(id);
        if (existing != null)
            return existing;

        var category = new Category { Id = id, Name = name, Group = group };
        Db.Categories.Add(category);
        Db.SaveChanges();
        return category;
    }

    private Category GetCategory(int id) =>
        Db.Categories.Find(id)
        ?? throw new InvalidOperationException($"Category {id} is missing from the seed.");

    /// <summary>Seeds a recipe, optionally marked as Tilbehør.</summary>
    public Recipe SeedRecipe(string title, bool isTilbehor = false, string? ownerEmail = OwnerEmail)
    {
        var recipe = new Recipe
        {
            Title = title,
            OwnerEmail = ownerEmail,
            Visibility = "Public"
        };

        if (isTilbehor)
        {
            var tilbehor = Db.Categories.Find(RecipeCategories.TilbehorId)
                ?? throw new InvalidOperationException("Call SeedTilbehorCategory() first.");
            recipe.Categories.Add(tilbehor);
        }

        Db.Recipes.Add(recipe);
        Db.SaveChanges();
        return recipe;
    }

    /// <summary>Seeds a recipe carrying the given categories.</summary>
    public Recipe SeedRecipeWithCategories(string title, params Category[] categories)
    {
        var recipe = new Recipe
        {
            Title = title,
            OwnerEmail = OwnerEmail,
            Visibility = "Public"
        };

        foreach (var category in categories)
            recipe.Categories.Add(category);

        Db.Recipes.Add(recipe);
        Db.SaveChanges();
        return recipe;
    }

    /// <summary>Reads the persisted side-dish links for a recipe, in SortOrder.</summary>
    public List<RecipeSideDish> GetSideDishLinks(int recipeId) =>
        Db.RecipeSideDishes
            .AsNoTracking()
            .Where(sd => sd.RecipeId == recipeId)
            .OrderBy(sd => sd.SortOrder)
            .ToList();

    public void Dispose() => Db.Dispose();
}
