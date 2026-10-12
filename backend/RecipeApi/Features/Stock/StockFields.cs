namespace RecipeApi.Features.Stock;

/// <summary>Cleaning and checks shared by every endpoint that accepts a name/quantity/unit.</summary>
public static class StockFields
{
    public const int MaxNameLength = 100;
    public const int MaxUnitLength = 20;
    public const int MaxNoteLength = 200;

    /// <summary>Largest value the decimal(10,3) columns can hold.</summary>
    public const decimal MaxQuantity = 9_999_999m;

    public static string? CleanUnit(string? unit)
    {
        var trimmed = unit?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    /// <summary>Case-insensitive unit key for deciding whether two rows are "the same unit".</summary>
    public static string UnitKey(string? unit) => CleanUnit(unit)?.ToLowerInvariant() ?? string.Empty;

    /// <summary>Null when valid, otherwise a Norwegian error message.</summary>
    public static string? Validate(string? name, decimal? quantity, string? unit)
    {
        var trimmedName = name?.Trim();
        if (string.IsNullOrEmpty(trimmedName)) return "Navn kan ikke være tomt";
        if (trimmedName.Length > MaxNameLength) return $"Navn kan ha maks {MaxNameLength} tegn";
        if (quantity is < 0) return "Mengde kan ikke være negativ";
        if (quantity > MaxQuantity) return "Mengden er for stor";
        if (CleanUnit(unit)?.Length > MaxUnitLength) return $"Enhet kan ha maks {MaxUnitLength} tegn";
        return null;
    }

    /// <summary>
    /// Adds two optional quantities. A missing amount means "unknown", so it never wipes
    /// out a known one: null + 2 = 2, null + null = null.
    /// </summary>
    public static decimal? AddQuantities(decimal? a, decimal? b)
    {
        if (a == null) return b;
        if (b == null) return a;
        // Capped so two valid amounts can never overflow the database column.
        return Math.Min(Math.Round(a.Value + b.Value, 3), MaxQuantity);
    }
}
