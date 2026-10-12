namespace RecipeApi.Features.Stock;

/// <summary>
/// Folds a new item into an existing list so repeated adds sum up instead of piling up
/// duplicate rows. Pure: works on the in-memory list, the caller persists the result.
/// </summary>
public static class ItemMerger
{
    /// <summary>
    /// Merges <paramref name="incoming"/> into the open shopping-list items when one has the
    /// same normalised name and unit; otherwise appends it. Returns the item that now holds
    /// the amount — the matched existing item, or <paramref name="incoming"/> itself.
    /// </summary>
    public static ShoppingListItem MergeIntoShoppingList(List<ShoppingListItem> items, ShoppingListItem incoming)
    {
        var unitKey = StockFields.UnitKey(incoming.Unit);
        var existing = items.FirstOrDefault(i =>
            i.Status == ShoppingListStatuses.Open
            && i.NormalizedName == incoming.NormalizedName
            && StockFields.UnitKey(i.Unit) == unitKey);

        if (existing == null)
        {
            items.Add(incoming);
            return incoming;
        }

        existing.Quantity = StockFields.AddQuantities(existing.Quantity, incoming.Quantity);
        existing.Note ??= incoming.Note;
        return existing;
    }

    /// <summary>
    /// Merges <paramref name="incoming"/> into stock items at the same location with the
    /// same normalised name and unit, summing quantities (used for groceries just bought).
    /// A matching staple is left alone: staples carry no quantity.
    /// </summary>
    public static StockItem MergeIntoStock(List<StockItem> items, StockItem incoming)
    {
        var unitKey = StockFields.UnitKey(incoming.Unit);
        var existing = items.FirstOrDefault(i =>
            i.Location == incoming.Location
            && i.NormalizedName == incoming.NormalizedName
            && (i.IsStaple || StockFields.UnitKey(i.Unit) == unitKey));

        if (existing == null)
        {
            items.Add(incoming);
            return incoming;
        }

        if (!existing.IsStaple)
            existing.Quantity = StockFields.AddQuantities(existing.Quantity, incoming.Quantity);
        existing.UpdatedAt = incoming.UpdatedAt;
        existing.UpdatedByEmail = incoming.UpdatedByEmail;
        return existing;
    }
}
