using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Infrastructure;

namespace RecipeApi.Features.Stock;

/// <summary>
/// Shared plumbing for the stock and shopping-list controllers, which all live under
/// <c>api/groups/{groupId}/…</c> and are open to group members only.
/// </summary>
public abstract class GroupScopedController : ControllerBase
{
    protected readonly RecipeDbContext Db;

    protected GroupScopedController(RecipeDbContext db)
    {
        Db = db;
    }

    protected string? GetCallerEmail() =>
        User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
        ?? User.FindFirst("email")?.Value;

    protected Task<bool> IsGroupMemberAsync(int groupId, string email) =>
        Db.GroupMembers.AnyAsync(m => m.GroupId == groupId && m.User.Email == email);

    protected ObjectResult NotMember() =>
        StatusCode(403, new { error = "Du er ikke medlem av denne gruppen" });
}
