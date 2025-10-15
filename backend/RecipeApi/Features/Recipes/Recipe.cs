using System.ComponentModel.DataAnnotations;

namespace RecipeApi.Features.Recipes;

public class Recipe
{
    public int Id { get; set; }
    
    [Required]
    [StringLength(200)]
    public string Title { get; set; } = string.Empty;
    
    [StringLength(1000)]
    public string Description { get; set; } = string.Empty;
    
    [StringLength(50)]
    public string CookTime { get; set; } = string.Empty;
    
    [StringLength(20)]
    public string Difficulty { get; set; } = string.Empty;
    
    public string ImageUrl { get; set; } = string.Empty;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}