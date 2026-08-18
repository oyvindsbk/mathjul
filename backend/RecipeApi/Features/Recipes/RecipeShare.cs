using System.ComponentModel.DataAnnotations;

namespace RecipeApi.Features.Recipes;

public class RecipeShare
{
    public int Id { get; set; }

    public int RecipeId { get; set; }
    public Recipe Recipe { get; set; } = null!;

    [StringLength(64)]
    public string Token { get; set; } = string.Empty;

    [StringLength(200)]
    public string CreatedByEmail { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? RevokedAt { get; set; }

    /// <summary>Always null today; present so expiry can be switched on later without a migration.</summary>
    public DateTime? ExpiresAt { get; set; }

    public DateTime? LastAccessedAt { get; set; }
}
