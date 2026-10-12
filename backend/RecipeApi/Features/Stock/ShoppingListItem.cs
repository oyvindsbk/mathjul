using System.ComponentModel.DataAnnotations;
using RecipeApi.Features.Groups;

namespace RecipeApi.Features.Stock;

public static class ShoppingListSources
{
    public const string Manual = "manuell";
    public const string MealPlan = "ukeplan";

    public static readonly IReadOnlyList<string> All = [Manual, MealPlan];

    public static bool IsValid(string? value) => value != null && All.Contains(value);
}

/// <summary>
/// Kept as a string rather than a bool so a later Oda hand-off can add a state
/// (e.g. "i-kurv") without migrating existing rows.
/// </summary>
public static class ShoppingListStatuses
{
    public const string Open = "aapen";
    public const string Bought = "kjopt";

    public static readonly IReadOnlyList<string> All = [Open, Bought];

    public static bool IsValid(string? value) => value != null && All.Contains(value);
}

/// <summary>
/// One thing the group needs to buy. The stable hand-off point for a future Oda
/// integration.
/// </summary>
public class ShoppingListItem
{
    public int Id { get; set; }

    public int GroupId { get; set; }
    public Group Group { get; set; } = null!;

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>Set server-side; used to merge duplicates. See <see cref="StockItem.NormalizedName"/>.</summary>
    [Required]
    [StringLength(100)]
    public string NormalizedName { get; set; } = string.Empty;

    public decimal? Quantity { get; set; }

    [StringLength(20)]
    public string? Unit { get; set; }

    [StringLength(200)]
    public string? Note { get; set; }

    /// <summary>One of <see cref="ShoppingListSources.All"/>.</summary>
    [Required]
    [StringLength(20)]
    public string Source { get; set; } = ShoppingListSources.Manual;

    /// <summary>One of <see cref="ShoppingListStatuses.All"/>.</summary>
    [Required]
    [StringLength(20)]
    public string Status { get; set; } = ShoppingListStatuses.Open;

    [StringLength(200)]
    public string? CreatedByEmail { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? BoughtAt { get; set; }
}
