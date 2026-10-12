namespace RecipeApi.Features.Stock;

/// <summary>
/// One row of a not-yet-saved stock list, produced by a photo scan or a correction and
/// edited on the review screen. Lives only in the browser until the user saves.
/// </summary>
public class DraftItem
{
    public string Name { get; set; } = string.Empty;
    public decimal? Quantity { get; set; }
    public string? Unit { get; set; }
}

public static class DraftItems
{
    /// <summary>Upper bound on a draft's size, for scans, corrections and saves alike.</summary>
    public const int MaxItems = 100;

    /// <summary>
    /// Lenient clean-up for model output: trims, truncates and drops what cannot be saved,
    /// so one odd row never fails a whole scan. Null when the name is blank.
    /// </summary>
    public static DraftItem? TryClean(string? name, decimal? quantity, string? unit)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        if (trimmed.Length > StockFields.MaxNameLength) trimmed = trimmed[..StockFields.MaxNameLength].TrimEnd();

        var cleanUnit = StockFields.CleanUnit(unit);
        if (cleanUnit?.Length > StockFields.MaxUnitLength) cleanUnit = cleanUnit[..StockFields.MaxUnitLength];

        return new DraftItem
        {
            Name = trimmed,
            Quantity = quantity is >= 0 and <= StockFields.MaxQuantity ? quantity : null,
            Unit = cleanUnit,
        };
    }

    /// <summary>Strict check for input from the client. Null when valid, else a Norwegian message.</summary>
    public static string? Validate(IReadOnlyList<DraftItem>? items)
    {
        if (items == null || items.Count == 0) return "Utkastet er tomt";
        if (items.Count > MaxItems) return $"Maks {MaxItems} varer om gangen";

        foreach (var item in items)
        {
            var error = StockFields.Validate(item.Name, item.Quantity, item.Unit);
            if (error != null) return error;
        }
        return null;
    }
}
