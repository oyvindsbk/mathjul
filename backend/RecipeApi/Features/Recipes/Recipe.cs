using System.ComponentModel.DataAnnotations;

namespace RecipeApi.Features.Recipes;

public class Category
{
    public int Id { get; set; }

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [StringLength(50)]
    public string Group { get; set; } = string.Empty;

    public List<Recipe> Recipes { get; set; } = new();
}

public class StructuredIngredient
{
    public decimal? Quantity { get; set; }
    public string? Unit { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class InstructionStep
{
    public string Text { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
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

    // Legacy: newline-separated instructions string — kept nullable for rollback safety, replaced by InstructionSteps
    public string? Instructions { get; set; }

    public List<InstructionStep> InstructionSteps { get; set; } = new();
    
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

    public List<Category> Categories { get; set; } = new();
}