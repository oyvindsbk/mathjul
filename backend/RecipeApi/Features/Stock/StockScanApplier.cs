namespace RecipeApi.Features.Stock;

public static class ScanApplyModes
{
    /// <summary>Add new items and update amounts; never delete.</summary>
    public const string Add = "legg-til";

    /// <summary>As <see cref="Add"/>, and also delete what is at the location but missing from the draft.</summary>
    public const string Replace = "erstatt";

    public static bool IsValid(string? mode) => mode is Add or Replace;
}

public record ScanApplyResult(List<StockItem> Added, List<StockItem> Updated, List<StockItem> Removed);

/// <summary>
/// Decides what saving a reviewed draft does to the stock at one location. Pure: it
/// mutates the passed-in entities and reports what to add or remove; the caller persists.
/// </summary>
public static class StockScanApplier
{
    public static ScanApplyResult Apply(
        int groupId,
        string location,
        string mode,
        IReadOnlyList<DraftItem> draft,
        IReadOnlyList<StockItem> existingAtLocation,
        IReadOnlyCollection<int> keepIds,
        string email,
        DateTime now)
    {
        var added = new List<StockItem>();
        var updated = new List<StockItem>();
        var seen = new HashSet<StockItem>();

        foreach (var row in CollapseDuplicates(draft))
        {
            var normalized = IngredientMatcher.Normalize(row.Name);
            var unitKey = StockFields.UnitKey(row.Unit);

            var match = existingAtLocation.FirstOrDefault(s =>
                    !seen.Contains(s) && s.NormalizedName == normalized
                    && (s.IsStaple || StockFields.UnitKey(s.Unit) == unitKey))
                // A scan often cannot tell the unit. "melk" without one still means the melk we already have.
                ?? (unitKey.Length == 0
                    ? existingAtLocation.FirstOrDefault(s => !seen.Contains(s) && s.NormalizedName == normalized)
                    : null);

            if (match == null)
            {
                added.Add(new StockItem
                {
                    GroupId = groupId,
                    Name = row.Name,
                    NormalizedName = normalized,
                    Quantity = row.Quantity,
                    Unit = StockFields.CleanUnit(row.Unit),
                    Location = location,
                    UpdatedByEmail = email,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                continue;
            }

            seen.Add(match);

            // The photo shows what is there now, so its count replaces ours rather than adding to it.
            // Without a unit on either side of the comparison the amounts are not comparable, so leave them.
            var comparable = StockFields.UnitKey(match.Unit) == unitKey;
            if (row.Quantity != null && !match.IsStaple && comparable && match.Quantity != row.Quantity)
            {
                match.Quantity = row.Quantity;
                match.UpdatedByEmail = email;
                match.UpdatedAt = now;
                updated.Add(match);
            }
        }

        var removed = mode != ScanApplyModes.Replace
            ? []
            : existingAtLocation
                // Staples are assumed to be always at home, so a photo that does not show the salt never deletes it.
                .Where(s => !seen.Contains(s) && !s.IsStaple && !keepIds.Contains(s.Id))
                .ToList();

        return new ScanApplyResult(added, updated, removed);
    }

    /// <summary>
    /// Two rows for the same thing in one draft (e.g. eggs seen on two shelves) become one
    /// row with the amounts added together.
    /// </summary>
    private static List<DraftItem> CollapseDuplicates(IReadOnlyList<DraftItem> draft)
    {
        var result = new List<DraftItem>();
        var index = new Dictionary<(string Name, string Unit), DraftItem>();

        foreach (var row in draft)
        {
            var key = (IngredientMatcher.Normalize(row.Name), StockFields.UnitKey(row.Unit));
            if (key.Item1.Length == 0) continue;

            if (index.TryGetValue(key, out var first))
            {
                first.Quantity = StockFields.AddQuantities(first.Quantity, row.Quantity);
                continue;
            }

            var copy = new DraftItem { Name = row.Name.Trim(), Quantity = row.Quantity, Unit = row.Unit };
            index[key] = copy;
            result.Add(copy);
        }
        return result;
    }
}
