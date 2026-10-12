using System.Text.RegularExpressions;

namespace RecipeApi.Features.Stock;

public enum IngredientMatchStatus
{
    /// <summary>Exact name match, or the matching stock item is a staple.</summary>
    Have,

    /// <summary>Partial name match; the user has to judge it.</summary>
    Maybe,

    Missing,
}

public static class IngredientMatchStatusExtensions
{
    /// <summary>The wire value: "har" | "kanskje" | "mangler".</summary>
    public static string ToApiString(this IngredientMatchStatus status) => status switch
    {
        IngredientMatchStatus.Have => "har",
        IngredientMatchStatus.Maybe => "kanskje",
        _ => "mangler",
    };
}

public readonly record struct IngredientMatch(IngredientMatchStatus Status, StockItem? Item);

/// <summary>
/// Deterministic name matching between recipe ingredients and stock. Quantities are
/// deliberately not compared: stk/g/dl/pakke cannot be converted reliably, so a match
/// only says "something with this name is at home".
/// </summary>
public static partial class IngredientMatcher
{
    /// <summary>
    /// Shortest name that may match as a prefix/suffix of a compound word, so "ris" does
    /// not match "kapris" while "melk" still matches "lettmelk".
    /// </summary>
    private const int MinCompoundLength = 4;

    private static readonly HashSet<string> PreparationWords = new(StringComparer.Ordinal)
    {
        "fersk", "frossen", "hakket", "revet", "kokt", "finhakket",
    };

    [GeneratedRegex(@"\([^)]*\)")]
    private static partial Regex ParenthesisRegex();

    [GeneratedRegex(@"[^\p{L}\p{N}\s]")]
    private static partial Regex PunctuationRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();

    /// <summary>
    /// Lower-cases, drops parenthesised text and anything after the first comma, strips
    /// punctuation, and removes a leading preparation word ("revet ost" → "ost").
    /// </summary>
    public static string Normalize(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return string.Empty;

        var text = ParenthesisRegex().Replace(name.ToLowerInvariant(), " ");
        var comma = text.IndexOf(',');
        if (comma >= 0) text = text[..comma];

        text = PunctuationRegex().Replace(text, " ");
        text = WhitespaceRegex().Replace(text, " ").Trim();

        var words = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (words.Length > 1 && PreparationWords.Contains(words[0]))
            words = words[1..];

        return string.Join(' ', words);
    }

    /// <summary>
    /// Finds the best stock match for an ingredient: exact name first, then partial. A
    /// staple item counts as <see cref="IngredientMatchStatus.Have"/> on a partial match
    /// too, since staples are assumed to be always available.
    /// </summary>
    public static IngredientMatch Match(string ingredient, IReadOnlyList<StockItem> stock)
    {
        var target = Normalize(ingredient);
        if (target.Length == 0 || stock.Count == 0)
            return new IngredientMatch(IngredientMatchStatus.Missing, null);

        StockItem? partial = null;
        StockItem? partialStaple = null;

        foreach (var item in stock)
        {
            var name = StockName(item);
            if (name.Length == 0) continue;

            if (name == target)
                return new IngredientMatch(IngredientMatchStatus.Have, item);

            if (!IsPartialMatch(target, name)) continue;

            if (item.IsStaple) partialStaple ??= item;
            else partial ??= item;
        }

        if (partialStaple != null)
            return new IngredientMatch(IngredientMatchStatus.Have, partialStaple);
        if (partial != null)
            return new IngredientMatch(IngredientMatchStatus.Maybe, partial);

        return new IngredientMatch(IngredientMatchStatus.Missing, null);
    }

    private static string StockName(StockItem item) =>
        item.NormalizedName.Length > 0 ? item.NormalizedName : Normalize(item.Name);

    private static bool IsPartialMatch(string a, string b)
    {
        var (shorter, longer) = a.Length <= b.Length ? (a, b) : (b, a);
        var shortWords = shorter.Split(' ');
        var longWords = longer.Split(' ');

        // "paprika" in "rød paprika": every word of the shorter name is a whole word of the longer.
        if (shortWords.All(w => longWords.Contains(w)))
            return true;

        // "melk" in "lettmelk": a single-word name that starts or ends a word in the longer one.
        if (shortWords.Length == 1 && shorter.Length >= MinCompoundLength)
            return longWords.Any(w => w != shorter
                && (w.StartsWith(shorter, StringComparison.Ordinal)
                    || w.EndsWith(shorter, StringComparison.Ordinal)));

        return false;
    }
}
