using System.ComponentModel.DataAnnotations;
using RecipeApi.Features.Groups;

namespace RecipeApi.Features.Stock;

public static class StockLocations
{
    public const string Fridge = "kjoleskap";
    public const string Freezer = "fryser";
    public const string Pantry = "skap";
    public const string Other = "annet";

    public static readonly IReadOnlyList<string> All = [Fridge, Freezer, Pantry, Other];

    public static bool IsValid(string? value) => value != null && All.Contains(value);
}

/// <summary>One kind of food the group has at home.</summary>
public class StockItem
{
    public int Id { get; set; }

    public int GroupId { get; set; }
    public Group Group { get; set; } = null!;

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Name as normalised by <c>IngredientMatcher.Normalize</c>; what ingredients are
    /// matched against. Always set server-side, never taken from the client.
    /// </summary>
    [Required]
    [StringLength(100)]
    public string NormalizedName { get; set; } = string.Empty;

    public decimal? Quantity { get; set; }

    [StringLength(20)]
    public string? Unit { get; set; }

    /// <summary>One of <see cref="StockLocations.All"/>.</summary>
    [Required]
    [StringLength(20)]
    public string Location { get; set; } = StockLocations.Fridge;

    public DateOnly? BestBefore { get; set; }

    /// <summary>
    /// Salt, oil, pepper and the like: always counted as available and never tracked by
    /// quantity.
    /// </summary>
    public bool IsStaple { get; set; }

    [StringLength(200)]
    public string? UpdatedByEmail { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
