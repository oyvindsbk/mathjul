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
    /// <summary>
    /// Stable identity, so an instruction step's mention keeps pointing at this
    /// ingredient across renames and reordering. Assigned server-side; null on
    /// rows written before mentions existed, backfilled by
    /// <see cref="RecipeIngredientIds.EnsureIds"/>.
    /// </summary>
    public string? Id { get; set; }
    public decimal? Quantity { get; set; }
    public string? Unit { get; set; }
    public string Name { get; set; } = string.Empty;
}

/// <summary>
/// An ingredient referenced from inside an instruction step, so the step renders
/// the ingredient's scaled amount and follows later edits to it.
/// </summary>
public class IngredientMention
{
    /// <summary>Matches <see cref="StructuredIngredient.Id"/>.</summary>
    public string IngredientId { get; set; } = string.Empty;

    /// <summary>
    /// The ingredient's name at authoring time. Rendered as plain text when the
    /// ingredient has since been deleted, so the sentence still reads.
    /// </summary>
    public string FallbackName { get; set; } = string.Empty;

    /// <summary>"full" (amount + unit + name) or "name" (name only).</summary>
    public string Display { get; set; } = "full";
}

public class InstructionStep
{
    /// <summary>
    /// Step text, carrying opaque <c>@[n]</c> tokens that index into
    /// <see cref="Mentions"/>. Tokens with no matching mention are rendered
    /// literally rather than treated as an error.
    /// </summary>
    public string Text { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public List<IngredientMention> Mentions { get; set; } = new();
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
    
    public double? Servings { get; set; }

    [StringLength(20)]
    public string QuantityType { get; set; } = "porsjoner";

    [StringLength(100)]
    public string? CustomUnit { get; set; }

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

    /// <summary>Side dishes attached to this recipe (this recipe is the main dish).</summary>
    public List<RecipeSideDish> SideDishes { get; set; } = new();

    /// <summary>Main dishes this recipe is attached to as a side dish (reverse lookup).</summary>
    public List<RecipeSideDish> UsedAsSideDishIn { get; set; } = new();
}

public class RecipeGroup
{
    public int RecipeId { get; set; }
    public Recipe Recipe { get; set; } = null!;

    public int GroupId { get; set; }
    public Group Group { get; set; } = null!;
}

/// <summary>
/// One-way link: a main dish has an ordered list of side dishes (Tilbehør recipes).
/// Edited only from the main dish; the side dish surfaces the reverse direction read-only.
/// </summary>
public class RecipeSideDish
{
    public int RecipeId { get; set; }
    public Recipe Recipe { get; set; } = null!;

    public int SideDishRecipeId { get; set; }
    public Recipe SideDishRecipe { get; set; } = null!;

    public int SortOrder { get; set; }
}

public class RecipeLike
{
    public int RecipeId { get; set; }
    public Recipe Recipe { get; set; } = null!;

    [System.ComponentModel.DataAnnotations.StringLength(200)]
    public string UserEmail { get; set; } = string.Empty;

    public DateTime LikedAt { get; set; } = DateTime.UtcNow;
}