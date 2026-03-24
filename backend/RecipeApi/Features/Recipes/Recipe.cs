using System.ComponentModel.DataAnnotations;

namespace RecipeApi.Features.Recipes;

public class StructuredIngredient
{
    public decimal? Quantity { get; set; }
    public string? Unit { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class Recipe
{
    public int Id { get; set; }

    [Required]
    [StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [StringLength(1000)]
    public string Description { get; set; } = string.Empty;

    public List<StructuredIngredient> Ingredients { get; set; } = new();

    // Store instructions as newline-separated string
    public string Instructions { get; set; } = string.Empty;
    
    public int? PrepTime { get; set; } // in minutes
    
    [StringLength(50)]
    public string CookTime { get; set; } = string.Empty;
    
    public int? CookTimeMinutes { get; set; } // in minutes
    
    public int? Servings { get; set; }
    
    [StringLength(20)]
    public string Difficulty { get; set; } = string.Empty;
    
    public string ImageUrl { get; set; } = string.Empty;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}