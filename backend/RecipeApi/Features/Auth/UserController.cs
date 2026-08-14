using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Features.Recipes;
using RecipeApi.Infrastructure;

namespace RecipeApi.Features.Auth;

public record UpdateUserRequest(string? Name, string? Nickname);

/// <summary>
/// Public view of a user. Deliberately carries no email — this is readable by any
/// authenticated user, and profile pages should not expose addresses.
/// </summary>
public record UserProfileDto(int Id, string DisplayName, int RecipeCount);

[ApiController]
[Route("api/user")]
public class UserController : ControllerBase
{
    private readonly RecipeDbContext _db;
    private readonly IAdminService _adminService;

    public UserController(RecipeDbContext db, IAdminService adminService)
    {
        _db = db;
        _adminService = adminService;
    }

    /// <summary>
    /// Public profile for <paramref name="id"/>: display name and how many of that
    /// user's recipes the caller can see.
    ///
    /// The count runs through the same visibility rules as the recipe list, so it
    /// cannot be used to infer how many private recipes someone has.
    /// </summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<UserProfileDto>> GetUserProfile(int id)
    {
        var callerEmail = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
                          ?? User.FindFirst("email")?.Value;

        if (string.IsNullOrEmpty(callerEmail))
            return Unauthorized(new { error = "Authentication required" });

        var user = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user is null)
            return NotFound(new { error = "User not found" });

        var recipeCount = await _db.Recipes
            .Where(r => r.OwnerEmail == user.Email)
            .VisibleTo(callerEmail, _adminService.IsAdmin(callerEmail))
            .CountAsync();

        return Ok(new UserProfileDto(user.Id, UserDisplayName.Resolve(user), recipeCount));
    }

    /// <summary>
    /// Updates the authenticated user's name and nickname.
    /// </summary>
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserRequest request)
    {
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
                    ?? User.FindFirst("email")?.Value;

        if (string.IsNullOrEmpty(email))
            return Unauthorized(new { error = "No email claim in token" });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user is null)
            return NotFound(new { error = "User not found" });

        if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
            return Forbid();

        user.Name = request.Name;
        user.Nickname = request.Nickname;
        await _db.SaveChangesAsync();

        return Ok(new { id = user.Id, email = user.Email, displayName = user.DisplayName, name = user.Name, nickname = user.Nickname });
    }
}
