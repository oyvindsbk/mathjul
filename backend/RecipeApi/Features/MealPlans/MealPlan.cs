using System.ComponentModel.DataAnnotations;
using RecipeApi.Features.Groups;
using RecipeApi.Features.Recipes;

namespace RecipeApi.Features.MealPlans;

public class MealPlan
{
    public int Id { get; set; }

    public int GroupId { get; set; }
    public Group Group { get; set; } = null!;

    public DateOnly Date { get; set; }

    public int RecipeId { get; set; }
    public Recipe Recipe { get; set; } = null!;

    [StringLength(200)]
    public string? CreatedByEmail { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
