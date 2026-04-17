using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Infrastructure;

namespace RecipeApi.Features.Auth;

public record UpdateUserRequest(string? Name, string? Nickname);

[ApiController]
[Route("api/user")]
public class UserController : ControllerBase
{
    private readonly RecipeDbContext _db;

    public UserController(RecipeDbContext db)
    {
        _db = db;
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
