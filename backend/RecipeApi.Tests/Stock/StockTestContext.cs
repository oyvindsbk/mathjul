using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Features.Auth;
using RecipeApi.Features.Groups;
using RecipeApi.Infrastructure;

namespace RecipeApi.Tests.Stock;

/// <summary>
/// In-memory database with two groups: <see cref="GroupId"/> (the member belongs to it) and
/// <see cref="OtherGroupId"/> (the member does not). The outsider belongs to neither.
/// </summary>
public sealed class StockTestContext : IDisposable
{
    public const string MemberEmail = "member@example.com";
    public const string OutsiderEmail = "outsider@example.com";

    public RecipeDbContext Db { get; }
    public int GroupId { get; }
    public int OtherGroupId { get; }

    public StockTestContext()
    {
        var options = new DbContextOptionsBuilder<RecipeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        Db = new RecipeDbContext(options);
        Db.Database.EnsureCreated();

        var member = new User { Email = MemberEmail, DisplayName = "Member" };
        var outsider = new User { Email = OutsiderEmail, DisplayName = "Outsider" };
        Db.Users.AddRange(member, outsider);
        Db.SaveChanges();

        var group = new Group { Name = "Husholdning", OwnerId = member.Id };
        var other = new Group { Name = "Naboen", OwnerId = outsider.Id };
        Db.Groups.AddRange(group, other);
        Db.SaveChanges();

        Db.GroupMembers.Add(new GroupMember { GroupId = group.Id, UserId = member.Id });
        Db.SaveChanges();

        GroupId = group.Id;
        OtherGroupId = other.Id;
    }

    /// <summary>Gives a controller an authenticated caller (or an anonymous one for null).</summary>
    public static T WithCaller<T>(T controller, string? email = MemberEmail) where T : ControllerBase
    {
        var identity = email == null
            ? new ClaimsIdentity()
            : new ClaimsIdentity([new Claim(ClaimTypes.Email, email)], "Test");

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };
        return controller;
    }

    public void Dispose() => Db.Dispose();
}
