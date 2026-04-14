using System.ComponentModel.DataAnnotations;
using RecipeApi.Features.Groups;

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

public class IngredientSection
{
    public string Heading { get; set; } = string.Empty;
    public List<StructuredIngredient> Ingredients { get; set; } = new();
}

public class InstructionSection
{
    public string Heading { get; set; } = string.Empty;
    public List<InstructionStep> Steps { get; set; } = new();
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

    public List<InstructionStep> InstructionSteps { get; set; } = new();

    public List<IngredientSection> IngredientSections { get; set; } = new();

    public List<InstructionSection> InstructionSections { get; set; } = new();
    
    public int? PrepTime { get; set; } // in minutes
    
    [StringLength(50)]
    public string CookTime { get; set; } = string.Empty;
    
    public int? CookTimeMinutes { get; set; } // in minutes
    
    public int? Servings { get; set; }
    
    [StringLength(20)]
    public string Difficulty { get; set; } = string.Empty;
    
    public string? ImageUrl { get; set; }

    public string? SourceUrl { get; set; }

    public string? SourceImageUrl { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<Category> Categories { get; set; } = new();

    [StringLength(20)]
    public string Visibility { get; set; } = "Public";

    [StringLength(200)]
    public string? OwnerEmail { get; set; }

    public List<RecipeGroup> Groups { get; set; } = new();

    public List<string> Tips { get; set; } = new();
}

public class RecipeGroup
{
    public int RecipeId { get; set; }
    public Recipe Recipe { get; set; } = null!;

    public int GroupId { get; set; }
    public Group Group { get; set; } = null!;
}

public class RecipeLike
{
    public int RecipeId { get; set; }
    public Recipe Recipe { get; set; } = null!;

    [System.ComponentModel.DataAnnotations.StringLength(200)]
    public string UserEmail { get; set; } = string.Empty;

    public DateTime LikedAt { get; set; } = DateTime.UtcNow;
}