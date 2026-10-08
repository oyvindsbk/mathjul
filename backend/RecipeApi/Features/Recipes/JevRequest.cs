using System.Text;
using System.Text.Json.Serialization;

namespace RecipeApi.Features.Recipes;

/// <summary>
/// Request body for POST /v1/systemone.
/// </summary>
public sealed class JevRequest
{
    /// <summary>The text Jev evaluates every question against -- here, the recipe.</summary>
    [JsonPropertyName("state")]
    public string State { get; set; } = string.Empty;

    [JsonPropertyName("model")]
    public string Model { get; set; } = string.Empty;

    /// <summary>Question key -> question. Jev evaluates each one in parallel and isolation.</summary>
    [JsonPropertyName("questions")]
    public Dictionary<string, JevQuestion> Questions { get; set; } = new();
}

/// <summary>
/// A single Choice question: pick one of <see cref="Criteria"/>, or nothing.
/// </summary>
public sealed class JevQuestion
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = "choice";

    [JsonPropertyName("instructions")]
    public string Instructions { get; set; } = string.Empty;

    /// <summary>
    /// Criterion key -> description. A map, not a list, which is why category ids are
    /// encoded into the key: see <see cref="JevRequestBuilder.CriterionKey"/>.
    /// </summary>
    [JsonPropertyName("criteria")]
    public Dictionary<string, string> Criteria { get; set; } = new();
}

/// <summary>
/// Turns a flat list of category rows into Jev questions -- one Choice per category group.
/// Pure and side-effect free, so the grouping and key rules are testable without a network.
/// </summary>
public static class JevRequestBuilder
{
    /// <summary>Prefix marking a criterion key as an encoded category id.</summary>
    private const string CategoryKeyPrefix = "cat_";

    /// <summary>
    /// Prefix for question keys. Guarantees the key starts with an ASCII letter even when the
    /// group name begins with a digit or a character that sanitizes away.
    /// </summary>
    private const string GroupKeyPrefix = "gruppe_";

    /// <summary>
    /// Builds one Choice question per category group.
    /// </summary>
    /// <remarks>
    /// Groups with fewer than two options are skipped: a Choice over a single criterion can
    /// only come back as that criterion, which would be a suggestion the model never actually
    /// made. Better to leave the box unticked than to invent agreement.
    /// </remarks>
    /// <returns>
    /// The questions, keyed by a sanitized group key. Empty when no group qualifies, which
    /// callers treat as "nothing to ask" rather than an error.
    /// </returns>
    public static Dictionary<string, JevQuestion> BuildQuestions(
        IReadOnlyList<CategoryOption> categories)
    {
        var questions = new Dictionary<string, JevQuestion>(StringComparer.Ordinal);
        if (categories.Count == 0)
        {
            return questions;
        }

        var groups = categories
            .Where(c => !string.IsNullOrWhiteSpace(c.Group) && !string.IsNullOrWhiteSpace(c.Name))
            .GroupBy(c => c.Group, StringComparer.Ordinal);

        foreach (var group in groups)
        {
            // Two rows sharing an id would silently collapse in the criteria map and make the
            // answer ambiguous, so keep the first and drop repeats.
            var options = group
                .GroupBy(c => c.Id)
                .Select(g => g.First())
                .ToList();

            if (options.Count < 2)
            {
                continue;
            }

            var key = UniqueKey(questions, GroupKeyPrefix + Sanitize(group.Key));

            questions[key] = new JevQuestion
            {
                Type = "choice",
                Instructions = BuildInstructions(group.Key),
                Criteria = options.ToDictionary(
                    o => CriterionKey(o.Id),
                    CriterionDescription,
                    StringComparer.Ordinal)
            };
        }

        return questions;
    }

    /// <summary>
    /// The text Jev weighs a criterion by. Usually the category name, which is self-explanatory;
    /// Tilbehør needs spelling out or sauces get classified as the meal they are served with.
    /// </summary>
    private static string CriterionDescription(CategoryOption option) =>
        option.Id == RecipeCategories.TilbehorId
            ? RecipeCategories.TilbehorClassifierDescription
            : option.Name;

    /// <summary>Encodes a category id as a criterion key. Inverse of <see cref="TryParseCategoryId"/>.</summary>
    public static string CriterionKey(int id) => CategoryKeyPrefix + id.ToString(System.Globalization.CultureInfo.InvariantCulture);

    /// <summary>
    /// Decodes a criterion key back to a category id. Returns false for anything that did not
    /// come out of <see cref="CriterionKey"/>, so a surprising answer is ignored rather than
    /// mapped to the wrong category.
    /// </summary>
    public static bool TryParseCategoryId(string? criterionKey, out int id)
    {
        id = 0;
        if (criterionKey is null || !criterionKey.StartsWith(CategoryKeyPrefix, StringComparison.Ordinal))
        {
            return false;
        }

        return int.TryParse(
            criterionKey.AsSpan(CategoryKeyPrefix.Length),
            System.Globalization.NumberStyles.Integer,
            System.Globalization.CultureInfo.InvariantCulture,
            out id);
    }

    /// <summary>
    /// The question text for a group. The group name is the only thing that distinguishes one
    /// question from another, so it is asked in Norwegian to match the recipe text.
    /// </summary>
    private static string BuildInstructions(string group) =>
        $"Hvilken {group.ToLowerInvariant()} passer best for denne oppskriften?";

    /// <summary>
    /// Reduces a group name to a safe identifier: lowercase ASCII letters, digits and
    /// underscores. Norwegian letters are transliterated rather than stripped so that, say,
    /// "Måltidstype" stays readable in logs and request bodies.
    /// </summary>
    private static string Sanitize(string value)
    {
        var builder = new StringBuilder(value.Length);

        foreach (var c in value.ToLowerInvariant())
        {
            switch (c)
            {
                case 'æ':
                    builder.Append("ae");
                    break;
                case 'ø':
                    builder.Append('o');
                    break;
                case 'å':
                    builder.Append("aa");
                    break;
                default:
                    if (c is >= 'a' and <= 'z' or >= '0' and <= '9')
                    {
                        builder.Append(c);
                    }
                    else
                    {
                        builder.Append('_');
                    }

                    break;
            }
        }

        return builder.ToString();
    }

    /// <summary>
    /// Ensures a key is unused. Sanitizing is lossy, so two distinct group names can reduce to
    /// the same key; a numeric suffix keeps both questions instead of one overwriting the other.
    /// </summary>
    private static string UniqueKey(Dictionary<string, JevQuestion> existing, string candidate)
    {
        if (!existing.ContainsKey(candidate))
        {
            return candidate;
        }

        for (var suffix = 2; ; suffix++)
        {
            var key = $"{candidate}_{suffix}";
            if (!existing.ContainsKey(key))
            {
                return key;
            }
        }
    }
}
