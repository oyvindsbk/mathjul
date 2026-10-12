using RecipeApi.Features.Recipes;

namespace RecipeApi.Features.Stock;

/// <summary>An ingredient plus where it came from: the main dish (null) or a named side dish.</summary>
public record IngredientSource(StructuredIngredient Ingredient, string? SideDishTitle = null);

/// <summary>One planned meal. <see cref="Ingredients"/> is empty for Matkasse and custom entries.</summary>
public record WeekEntryInput(
    int MealPlanId,
    DateOnly Date,
    string Title,
    bool HasIngredients,
    IReadOnlyList<IngredientSource> Ingredients);

public record SuggestionRecipe(int RecipeId, string Title, string? ImageUrl, IReadOnlyList<StructuredIngredient> Ingredients);

/// <summary>
/// Pure calculations behind the week coverage and the "what can we make" suggestions.
/// Nothing here touches the database, so the rules can be tested directly.
/// </summary>
public static class StockCoverage
{
    /// <summary>Items with a best-before date this close (or already past) rank their recipes higher.</summary>
    public const int ExpiringWithinDays = 3;

    /// <summary>The recipe's own ingredients: the flat list plus every section.</summary>
    public static List<StructuredIngredient> Flatten(Recipe recipe) =>
        [.. recipe.Ingredients, .. recipe.IngredientSections.SelectMany(s => s.Ingredients)];

    // ── Week coverage ──────────────────────────────────────────────────────

    public static WeekCoverageDto BuildWeek(IReadOnlyList<WeekEntryInput> entries, IReadOnlyList<StockItem> stock)
    {
        var entryDtos = new List<EntryCoverageDto>();
        // Keyed by normalised name so "Revet ost" and "ost" end up on one line.
        var missing = new Dictionary<string, MissingAccumulator>();

        foreach (var entry in entries.OrderBy(e => e.Date).ThenBy(e => e.MealPlanId))
        {
            var ingredients = new List<IngredientCoverageDto>();

            foreach (var source in entry.Ingredients)
            {
                var ingredient = source.Ingredient;
                var normalized = IngredientMatcher.Normalize(ingredient.Name);
                if (normalized.Length == 0) continue;

                var match = IngredientMatcher.Match(ingredient.Name, stock);
                ingredients.Add(new IngredientCoverageDto
                {
                    Name = ingredient.Name,
                    Quantity = ingredient.Quantity,
                    Unit = ingredient.Unit,
                    Status = match.Status.ToApiString(),
                    StockItemId = match.Item?.Id,
                    StockName = match.Item?.Name,
                    StockQuantity = match.Item?.Quantity,
                    StockUnit = match.Item?.Unit,
                    SideDishTitle = source.SideDishTitle,
                });

                if (match.Status == IngredientMatchStatus.Have) continue;

                if (!missing.TryGetValue(normalized, out var acc))
                    missing[normalized] = acc = new MissingAccumulator(ingredient.Name.Trim(), normalized, match.Status);
                acc.Add(ingredient, entry.Title);
            }

            entryDtos.Add(new EntryCoverageDto
            {
                MealPlanId = entry.MealPlanId,
                Date = entry.Date.ToString("yyyy-MM-dd"),
                Title = entry.Title,
                WithoutIngredients = !entry.HasIngredients,
                Ingredients = ingredients,
            });
        }

        return new WeekCoverageDto
        {
            Entries = entryDtos,
            Missing = missing.Values
                .OrderBy(m => m.Status == IngredientMatchStatus.Missing ? 0 : 1)
                .ThenBy(m => m.NormalizedName, StringComparer.CurrentCulture)
                .Select(m => m.ToDto())
                .ToList(),
        };
    }

    private sealed class MissingAccumulator(string name, string normalizedName, IngredientMatchStatus status)
    {
        public string NormalizedName { get; } = normalizedName;
        public IngredientMatchStatus Status { get; } = status;

        private readonly List<(string? Unit, decimal? Quantity)> _amounts = [];
        private readonly List<string> _recipes = [];

        public void Add(StructuredIngredient ingredient, string recipeTitle)
        {
            _amounts.Add((StockFields.CleanUnit(ingredient.Unit), ingredient.Quantity));
            if (!_recipes.Contains(recipeTitle)) _recipes.Add(recipeTitle);
        }

        public MissingIngredientDto ToDto() => new()
        {
            Name = name,
            NormalizedName = NormalizedName,
            Status = Status.ToApiString(),
            // Amounts are only added together when the unit is the same; otherwise each unit keeps its own line.
            Quantities = _amounts
                .GroupBy(a => StockFields.UnitKey(a.Unit))
                .Select(g => new QuantityDto
                {
                    Unit = g.First().Unit,
                    Quantity = g.Aggregate((decimal?)null, (sum, a) => StockFields.AddQuantities(sum, a.Quantity)),
                })
                .ToList(),
            Recipes = _recipes,
        };
    }

    // ── Suggestions ────────────────────────────────────────────────────────

    public static List<SuggestionDto> Rank(
        IReadOnlyList<SuggestionRecipe> recipes, IReadOnlyList<StockItem> stock, DateOnly today, int limit)
    {
        var expiringCutoff = today.AddDays(ExpiringWithinDays);
        var ranked = new List<(SuggestionDto Dto, int ExpiringCount)>();

        foreach (var recipe in recipes)
        {
            var considered = 0;
            var have = 0;
            var maybe = 0;
            var missing = new List<string>();
            var expiring = new List<string>();

            foreach (var ingredient in recipe.Ingredients)
            {
                if (IngredientMatcher.Normalize(ingredient.Name).Length == 0) continue;

                var match = IngredientMatcher.Match(ingredient.Name, stock);

                // Staples are always at home, so they neither help nor hurt the score.
                if (match.Status == IngredientMatchStatus.Have && match.Item!.IsStaple) continue;

                considered++;
                switch (match.Status)
                {
                    case IngredientMatchStatus.Have: have++; break;
                    case IngredientMatchStatus.Maybe: maybe++; break;
                    default: missing.Add(ingredient.Name.Trim()); break;
                }

                if (match.Item?.BestBefore is { } bestBefore && bestBefore <= expiringCutoff
                    && !expiring.Contains(match.Item.Name))
                    expiring.Add(match.Item.Name);
            }

            // Needs at least one real hit; a recipe made only of staples proves nothing.
            if (considered == 0 || have + maybe == 0) continue;

            ranked.Add((new SuggestionDto
            {
                RecipeId = recipe.RecipeId,
                Title = recipe.Title,
                ImageUrl = recipe.ImageUrl,
                Score = Math.Round((have + 0.5 * maybe) / considered, 2),
                HaveCount = have,
                MaybeCount = maybe,
                MissingCount = missing.Count,
                Missing = missing,
                UsesExpiring = expiring,
            }, expiring.Count));
        }

        return ranked
            .OrderByDescending(r => r.Dto.Score)
            .ThenByDescending(r => r.ExpiringCount)
            .ThenBy(r => r.Dto.Title, StringComparer.CurrentCultureIgnoreCase)
            .Take(limit)
            .Select(r => r.Dto)
            .ToList();
    }
}

public class WeekCoverageDto
{
    public List<EntryCoverageDto> Entries { get; set; } = new();
    public List<MissingIngredientDto> Missing { get; set; } = new();
}

public class EntryCoverageDto
{
    public int MealPlanId { get; set; }
    public string Date { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;

    /// <summary>Matkasse and custom entries carry no ingredient list; the UI says so.</summary>
    public bool WithoutIngredients { get; set; }

    public List<IngredientCoverageDto> Ingredients { get; set; } = new();
}

public class IngredientCoverageDto
{
    public string Name { get; set; } = string.Empty;
    public decimal? Quantity { get; set; }
    public string? Unit { get; set; }

    /// <summary>"har" | "kanskje" | "mangler"</summary>
    public string Status { get; set; } = string.Empty;

    public int? StockItemId { get; set; }
    public string? StockName { get; set; }
    public decimal? StockQuantity { get; set; }
    public string? StockUnit { get; set; }

    /// <summary>Set when the ingredient belongs to a side dish rather than the main dish.</summary>
    public string? SideDishTitle { get; set; }
}

public class MissingIngredientDto
{
    public string Name { get; set; } = string.Empty;
    public string NormalizedName { get; set; } = string.Empty;

    /// <summary>"mangler" | "kanskje"</summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>One entry per distinct unit; amounts in the same unit are summed.</summary>
    public List<QuantityDto> Quantities { get; set; } = new();

    public List<string> Recipes { get; set; } = new();
}

public class QuantityDto
{
    public decimal? Quantity { get; set; }
    public string? Unit { get; set; }
}

public class SuggestionDto
{
    public int RecipeId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }

    /// <summary>0–1: share of non-staple ingredients at home (a partial match counts half).</summary>
    public double Score { get; set; }

    public int HaveCount { get; set; }
    public int MaybeCount { get; set; }
    public int MissingCount { get; set; }
    public List<string> Missing { get; set; } = new();

    /// <summary>Names of stock items this recipe would use up that are about to expire.</summary>
    public List<string> UsesExpiring { get; set; } = new();
}
