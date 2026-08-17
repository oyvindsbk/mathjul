using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Features.Auth;
using RecipeApi.Features.Groups;
using RecipeApi.Features.MealPlans;
using RecipeApi.Features.Recipes;
using RecipeApi.Infrastructure;
using Xunit;

namespace RecipeApi.Tests.MealPlans;

/// <summary>
/// PATCH widened from a date-only move to a general partial update, so the entry-kind
/// invariant that CreateMealPlan enforces up front (exactly one of RecipeId /
/// MatkasseRecipeId / CustomTitle) now has to hold on the update path too. These tests
/// pin that: a recipe entry must not be able to acquire a CustomTitle after the fact,
/// and a custom card must not be able to lose one.
/// </summary>
public sealed class MealPlanPatchTests : IDisposable
{
    private const string MemberEmail = "member@example.com";
    private const string OutsiderEmail = "outsider@example.com";

    private static readonly DateOnly OriginalDate = new(2026, 8, 17);
    private static readonly DateOnly NewDate = new(2026, 8, 19);

    private readonly RecipeDbContext _db;
    private readonly int _groupId;

    public MealPlanPatchTests()
    {
        var options = new DbContextOptionsBuilder<RecipeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new RecipeDbContext(options);
        _db.Database.EnsureCreated();

        var member = new User { Email = MemberEmail, DisplayName = "Member" };
        var outsider = new User { Email = OutsiderEmail, DisplayName = "Outsider" };
        _db.Users.AddRange(member, outsider);
        _db.SaveChanges();

        var group = new Group { Name = "Husholdning", OwnerId = member.Id };
        _db.Groups.Add(group);
        _db.SaveChanges();

        _db.GroupMembers.Add(new GroupMember { GroupId = group.Id, UserId = member.Id });
        _db.SaveChanges();

        _groupId = group.Id;
    }

    private MealPlansController CreateController(string? email = MemberEmail)
    {
        var identity = email == null
            ? new ClaimsIdentity()
            : new ClaimsIdentity([new Claim(ClaimTypes.Email, email)], "Test");

        return new MealPlansController(_db)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
            }
        };
    }

    private MealPlan SeedCustomEntry(string title = "Rester", string? note = "fra søndag")
    {
        var entry = new MealPlan
        {
            GroupId = _groupId,
            Date = OriginalDate,
            CustomTitle = title,
            CustomNote = note,
            CreatedByEmail = MemberEmail
        };
        _db.MealPlans.Add(entry);
        _db.SaveChanges();
        return entry;
    }

    private MealPlan SeedRecipeEntry()
    {
        var recipe = new Recipe { Title = "Laks med potet", OwnerEmail = MemberEmail, Visibility = "Public" };
        _db.Recipes.Add(recipe);
        _db.SaveChanges();

        var entry = new MealPlan
        {
            GroupId = _groupId,
            Date = OriginalDate,
            RecipeId = recipe.Id,
            CreatedByEmail = MemberEmail
        };
        _db.MealPlans.Add(entry);
        _db.SaveChanges();
        return entry;
    }

    private MealPlan Reload(int entryId) =>
        _db.MealPlans.AsNoTracking().Single(p => p.Id == entryId);

    [Fact]
    public async Task DateOnlyMoveStillWorks()
    {
        var entry = SeedRecipeEntry();

        var result = await CreateController().MoveMealPlan(
            _groupId, entry.Id, new MoveMealPlanRequest { Date = "2026-08-19" });

        Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(NewDate, Reload(entry.Id).Date);
    }

    [Fact]
    public async Task NoteOnlyUpdateLeavesTheDateAlone()
    {
        var entry = SeedCustomEntry();

        var result = await CreateController().MoveMealPlan(
            _groupId, entry.Id, new MoveMealPlanRequest { CustomNote = "endret" });

        Assert.IsType<OkObjectResult>(result.Result);

        var reloaded = Reload(entry.Id);
        Assert.Equal("endret", reloaded.CustomNote);
        Assert.Equal(OriginalDate, reloaded.Date);
        Assert.Equal("Rester", reloaded.CustomTitle);
    }

    [Fact]
    public async Task BlankNoteIsStoredAsNull()
    {
        var entry = SeedCustomEntry();

        await CreateController().MoveMealPlan(
            _groupId, entry.Id, new MoveMealPlanRequest { CustomNote = "   " });

        Assert.Null(Reload(entry.Id).CustomNote);
    }

    [Fact]
    public async Task NoteUpdateOnRecipeEntryIsRejected()
    {
        var entry = SeedRecipeEntry();

        var result = await CreateController().MoveMealPlan(
            _groupId, entry.Id, new MoveMealPlanRequest { CustomNote = "smuglet inn" });

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Null(Reload(entry.Id).CustomNote);
    }

    [Fact]
    public async Task TitleUpdateOnRecipeEntryIsRejected()
    {
        var entry = SeedRecipeEntry();

        var result = await CreateController().MoveMealPlan(
            _groupId, entry.Id, new MoveMealPlanRequest { CustomTitle = "Rester" });

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Null(Reload(entry.Id).CustomTitle);
    }

    [Fact]
    public async Task BlankTitleOnCustomEntryIsRejected()
    {
        var entry = SeedCustomEntry();

        var result = await CreateController().MoveMealPlan(
            _groupId, entry.Id, new MoveMealPlanRequest { CustomTitle = "   " });

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal("Rester", Reload(entry.Id).CustomTitle);
    }

    [Fact]
    public async Task MalformedDateIsRejected()
    {
        var entry = SeedCustomEntry();

        var result = await CreateController().MoveMealPlan(
            _groupId, entry.Id, new MoveMealPlanRequest { Date = "17.08.2026" });

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(OriginalDate, Reload(entry.Id).Date);
    }

    [Fact]
    public async Task DateAndNoteUpdateTogether()
    {
        var entry = SeedCustomEntry();

        await CreateController().MoveMealPlan(_groupId, entry.Id, new MoveMealPlanRequest
        {
            Date = "2026-08-19",
            CustomTitle = "Pizzakveld",
            CustomNote = "hjemmelaget"
        });

        var reloaded = Reload(entry.Id);
        Assert.Equal(NewDate, reloaded.Date);
        Assert.Equal("Pizzakveld", reloaded.CustomTitle);
        Assert.Equal("hjemmelaget", reloaded.CustomNote);
    }

    [Fact]
    public async Task NonMemberIsForbidden()
    {
        var entry = SeedCustomEntry();

        var result = await CreateController(OutsiderEmail).MoveMealPlan(
            _groupId, entry.Id, new MoveMealPlanRequest { CustomNote = "endret" });

        Assert.Equal(403, Assert.IsType<ObjectResult>(result.Result).StatusCode);
        Assert.Equal("fra søndag", Reload(entry.Id).CustomNote);
    }

    [Fact]
    public async Task AnonymousCallerIsUnauthorized()
    {
        var entry = SeedCustomEntry();

        var result = await CreateController(email: null).MoveMealPlan(
            _groupId, entry.Id, new MoveMealPlanRequest { CustomNote = "endret" });

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    public void Dispose() => _db.Dispose();
}
