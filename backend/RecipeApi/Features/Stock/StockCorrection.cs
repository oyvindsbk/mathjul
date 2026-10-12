using System.Globalization;
using System.Text.Json;

namespace RecipeApi.Features.Stock;

public static class CorrectionOps
{
    public const string Add = "add";
    public const string Remove = "remove";
    public const string Update = "update";
}

/// <summary>
/// One edit the model proposes. <see cref="Index"/> is the 1-based row number shown to the
/// model in the draft. An update changes only the fields that are non-null.
/// </summary>
public class CorrectionChange
{
    public string Op { get; set; } = string.Empty;
    public int? Index { get; set; }
    public string? Name { get; set; }
    public decimal? Quantity { get; set; }
    public string? Unit { get; set; }
}

public record CorrectionResult(List<DraftItem> Items, List<string> Applied, List<string> Rejected);

/// <summary>
/// Applies the model's proposed edits to a draft. Every change is checked on its own, so
/// one bad change is reported and skipped while the good ones still go through; the model
/// can never make the draft invalid, whatever the instruction said. Pure.
/// </summary>
public static class StockCorrectionApplier
{
    public static CorrectionResult Apply(IReadOnlyList<DraftItem> draft, IReadOnlyList<CorrectionChange> changes)
    {
        var rows = draft.Select(d => new DraftItem { Name = d.Name, Quantity = d.Quantity, Unit = d.Unit }).ToList();
        var touched = new HashSet<int>();
        var removed = new HashSet<int>();
        var added = new List<DraftItem>();
        var applied = new List<string>();
        var rejected = new List<string>();

        foreach (var change in changes)
        {
            switch (change.Op)
            {
                case CorrectionOps.Add:
                {
                    var error = StockFields.Validate(change.Name, change.Quantity, change.Unit);
                    if (error == null && rows.Count - removed.Count + added.Count >= DraftItems.MaxItems)
                        error = $"Utkastet er fullt (maks {DraftItems.MaxItems} varer)";
                    if (error != null)
                    {
                        rejected.Add($"Kunne ikke legge til «{change.Name?.Trim()}»: {error}");
                        break;
                    }

                    var row = DraftItems.TryClean(change.Name, change.Quantity, change.Unit)!;
                    added.Add(row);
                    applied.Add($"La til «{row.Name}»{Describe(row)}");
                    break;
                }

                case CorrectionOps.Remove:
                case CorrectionOps.Update:
                {
                    var error = ValidateRowChange(change, rows.Count, touched);
                    if (error != null)
                    {
                        rejected.Add($"Kunne ikke {(change.Op == CorrectionOps.Remove ? "fjerne" : "endre")} rad {change.Index}: {error}");
                        break;
                    }

                    var i = change.Index!.Value - 1;
                    touched.Add(i);

                    if (change.Op == CorrectionOps.Remove)
                    {
                        removed.Add(i);
                        applied.Add($"Fjernet «{rows[i].Name}»");
                        break;
                    }

                    if (change.Name != null) rows[i].Name = change.Name.Trim();
                    if (change.Quantity != null) rows[i].Quantity = change.Quantity;
                    if (change.Unit != null) rows[i].Unit = StockFields.CleanUnit(change.Unit);
                    applied.Add($"Endret «{rows[i].Name}»{Describe(rows[i])}");
                    break;
                }

                default:
                    rejected.Add($"Ukjent endring «{change.Op}»");
                    break;
            }
        }

        var items = rows.Where((_, i) => !removed.Contains(i)).Concat(added).ToList();
        return new CorrectionResult(items, applied, rejected);
    }

    /// <summary>Null when the change can be applied to an existing row.</summary>
    private static string? ValidateRowChange(CorrectionChange change, int rowCount, HashSet<int> touched)
    {
        if (change.Index is not { } index || index < 1 || index > rowCount)
            return "raden finnes ikke";
        if (touched.Contains(index - 1))
            return "raden er allerede endret av en annen endring";

        if (change.Op == CorrectionOps.Update)
        {
            if (change.Name == null && change.Quantity == null && change.Unit == null)
                return "ingenting å endre";
            if (change.Name != null || change.Quantity != null || change.Unit != null)
            {
                // Validate only what is being changed; the untouched fields were valid already.
                var error = StockFields.Validate(change.Name ?? "x", change.Quantity, change.Unit);
                if (error != null) return error;
            }
        }
        return null;
    }

    private static string Describe(DraftItem row)
    {
        var parts = new List<string>();
        if (row.Quantity != null) parts.Add(row.Quantity.Value.ToString("0.###", CultureInfo.InvariantCulture));
        if (!string.IsNullOrEmpty(row.Unit)) parts.Add(row.Unit);
        return parts.Count == 0 ? string.Empty : $" ({string.Join(' ', parts)})";
    }
}

/// <summary>Prompt text and response parsing for the correction call.</summary>
public static class StockCorrectionParser
{
    public const string JsonSchema = """
        {
          "type": "object",
          "properties": {
            "changes": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "op": { "type": "string", "enum": ["add", "remove", "update"] },
                  "index": { "type": ["integer", "null"] },
                  "name": { "type": ["string", "null"] },
                  "quantity": { "type": ["number", "null"] },
                  "unit": { "type": ["string", "null"] }
                },
                "required": ["op", "index", "name", "quantity", "unit"],
                "additionalProperties": false
              }
            }
          },
          "required": ["changes"],
          "additionalProperties": false
        }
        """;

    /// <summary>The draft as the model sees it: one numbered line per row.</summary>
    public static string FormatDraft(IReadOnlyList<DraftItem> draft)
    {
        if (draft.Count == 0) return "(tom liste)";

        return string.Join('\n', draft.Select((row, i) =>
        {
            var amount = new List<string>();
            if (row.Quantity != null) amount.Add(row.Quantity.Value.ToString("0.###", CultureInfo.InvariantCulture));
            if (!string.IsNullOrEmpty(row.Unit)) amount.Add(row.Unit);
            return amount.Count == 0 ? $"{i + 1}. {row.Name}" : $"{i + 1}. {row.Name} — {string.Join(' ', amount)}";
        }));
    }

    public static bool TryParse(string? content, out List<CorrectionChange> changes)
    {
        changes = [];
        if (string.IsNullOrWhiteSpace(content)) return false;

        try
        {
            using var doc = JsonDocument.Parse(content);
            if (doc.RootElement.ValueKind != JsonValueKind.Object
                || !doc.RootElement.TryGetProperty("changes", out var array)
                || array.ValueKind != JsonValueKind.Array)
                return false;

            foreach (var element in array.EnumerateArray())
            {
                if (element.ValueKind != JsonValueKind.Object) continue;

                changes.Add(new CorrectionChange
                {
                    Op = ReadString(element, "op") ?? string.Empty,
                    Index = element.TryGetProperty("index", out var index)
                            && index.ValueKind == JsonValueKind.Number && index.TryGetInt32(out var i) ? i : null,
                    Name = ReadString(element, "name"),
                    Quantity = element.TryGetProperty("quantity", out var quantity)
                               && quantity.ValueKind == JsonValueKind.Number && quantity.TryGetDecimal(out var q) ? q : null,
                    Unit = ReadString(element, "unit"),
                });
            }
            return true;
        }
        catch (JsonException)
        {
            changes = [];
            return false;
        }
    }

    private static string? ReadString(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
}
