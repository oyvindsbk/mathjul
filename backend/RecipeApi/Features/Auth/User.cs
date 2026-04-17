using System.ComponentModel.DataAnnotations;

namespace RecipeApi.Features.Auth;

public class User
{
    public int Id { get; set; }

    [Required]
    [StringLength(200)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string DisplayName { get; set; } = string.Empty;

    [StringLength(100)]
    public string? Name { get; set; }

    [StringLength(50)]
    public string? Nickname { get; set; }

    public DateTime CreatedAt { get; set; }
}
