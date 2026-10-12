using System.Text.Json;
using OpenAI.Chat;

namespace RecipeApi.Features.Stock;

public interface IStockScanProcessor
{
    Task<StockScanResult> ScanAsync(
        IReadOnlyList<IFormFile> images,
        string location,
        CancellationToken cancellationToken = default);
}

public class StockScanResult
{
    public bool IsSuccess { get; init; }
    public string? ErrorMessage { get; init; }
    public List<DraftItem> Items { get; init; } = [];

    public static StockScanResult Failure(string message) => new() { IsSuccess = false, ErrorMessage = message };
    public static StockScanResult Success(List<DraftItem> items) => new() { IsSuccess = true, Items = items };
}

public class DisabledStockScanProcessor : IStockScanProcessor
{
    public Task<StockScanResult> ScanAsync(
        IReadOnlyList<IFormFile> images, string location, CancellationToken cancellationToken = default) =>
        Task.FromResult(StockScanResult.Failure("Bildeskanning er ikke konfigurert i dette miljøet"));
}

/// <summary>Turns the model's JSON into draft rows. Pure, so the failure modes are testable.</summary>
public static class StockScanParser
{
    /// <summary>
    /// Response schema for strict structured output. Strict mode requires every property
    /// to be listed as required, so "optional" values are expressed as nullable.
    /// </summary>
    public const string JsonSchema = """
        {
          "type": "object",
          "properties": {
            "items": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "quantity": { "type": ["number", "null"] },
                  "unit": { "type": ["string", "null"] }
                },
                "required": ["name", "quantity", "unit"],
                "additionalProperties": false
              }
            }
          },
          "required": ["items"],
          "additionalProperties": false
        }
        """;

    public static bool TryParse(string? content, out List<DraftItem> items)
    {
        items = [];
        if (string.IsNullOrWhiteSpace(content)) return false;

        try
        {
            using var doc = JsonDocument.Parse(content);
            if (doc.RootElement.ValueKind != JsonValueKind.Object
                || !doc.RootElement.TryGetProperty("items", out var array)
                || array.ValueKind != JsonValueKind.Array)
                return false;

            foreach (var element in array.EnumerateArray())
            {
                if (element.ValueKind != JsonValueKind.Object) continue;

                var cleaned = DraftItems.TryClean(
                    ReadString(element, "name"), ReadQuantity(element), ReadString(element, "unit"));
                if (cleaned != null) items.Add(cleaned);
                if (items.Count == DraftItems.MaxItems) break;
            }
            return true;
        }
        catch (JsonException)
        {
            items = [];
            return false;
        }
    }

    private static string? ReadString(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static decimal? ReadQuantity(JsonElement element) =>
        element.TryGetProperty("quantity", out var value)
        && value.ValueKind == JsonValueKind.Number
        && value.TryGetDecimal(out var quantity)
            ? quantity
            : null;
}

public class StockScanProcessor : IStockScanProcessor
{
    private readonly ChatClient _chatClient;
    private readonly ILogger<StockScanProcessor> _logger;

    public StockScanProcessor(IConfiguration configuration, ILogger<StockScanProcessor> logger)
    {
        _chatClient = StockChatClientFactory.Create(configuration, "AiFoundry:StockScanModelName");
        _logger = logger;
    }

    public async Task<StockScanResult> ScanAsync(
        IReadOnlyList<IFormFile> images, string location, CancellationToken cancellationToken = default)
    {
        var validationError = StockImages.Validate(images);
        if (validationError != null) return StockScanResult.Failure(validationError);

        try
        {
            var userParts = new List<ChatMessageContentPart>
            {
                ChatMessageContentPart.CreateTextPart(
                    $"Dette er {(images.Count == 1 ? "et bilde" : "bilder")} av {LocationPhrase(location)}. " +
                    "List opp all maten du kan se.")
            };

            foreach (var image in images)
            {
                var bytes = await StockImages.PrepareAsync(image, cancellationToken);
                if (bytes == null) return StockScanResult.Failure($"Kunne ikke lese bildet '{image.FileName}'");
                userParts.Add(ChatMessageContentPart.CreateImagePart(BinaryData.FromBytes(bytes), "image/jpeg"));
            }

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(BuildSystemPrompt()),
                new UserChatMessage(userParts.ToArray()),
            };

            var options = new ChatCompletionOptions
            {
                ResponseFormat = ChatResponseFormat.CreateJsonSchemaFormat(
                    "stock_scan", BinaryData.FromString(StockScanParser.JsonSchema), jsonSchemaIsStrict: true),
            };

            var response = await _chatClient.CompleteChatAsync(messages, options, cancellationToken);

            if (response.Value.FinishReason == ChatFinishReason.Length)
                return StockScanResult.Failure("Svaret ble avkortet — prøv med færre bilder");
            if (response.Value.Content.Count == 0)
                return StockScanResult.Failure("Modellen ga ikke noe svar. Prøv igjen.");

            if (!StockScanParser.TryParse(response.Value.Content[0].Text, out var items))
            {
                _logger.LogWarning("Stock scan returned unparsable content");
                return StockScanResult.Failure("Kunne ikke lese AI-svaret. Prøv igjen.");
            }

            _logger.LogInformation("Stock scan found {Count} items in {Images} images", items.Count, images.Count);
            return items.Count == 0
                ? StockScanResult.Failure("Fant ingen matvarer i bildene")
                : StockScanResult.Success(items);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Stock scan failed");
            return StockScanResult.Failure("Feil ved bildeanalyse. Prøv igjen.");
        }
    }

    public static string LocationPhrase(string location) => location switch
    {
        StockLocations.Fridge => "kjøleskapet",
        StockLocations.Freezer => "fryseren",
        StockLocations.Pantry => "skapet",
        _ => "matlageret",
    };

    private static string BuildSystemPrompt() => """
        Du hjelper en norsk husstand med å registrere hvilken mat de har hjemme, ut fra bilder.

        Regler:
        - List bare mat og drikke du faktisk kan se. Ikke gjett på det som er skjult.
        - Skriv navnet på norsk, i entall og med små bokstaver, som en vanlig ingrediens
          («melk», «smør», «paprika»). Ikke ta med merkenavn.
        - Samme vare skal bare stå én gang. Slå sammen like varer og tell dem.
        - quantity: antallet du ser, eller mengden hvis den står på emballasjen. Bruk null hvis du er usikker.
        - unit: «stk» for ting som telles. For mengde på emballasje bruk «g», «kg», «dl» eller «l».
          Bruk null hvis du er usikker.
        - Ikke ta med ting som ikke er mat (rengjøringsmidler, redskaper, bokser uten synlig innhold).
        - Hvis du ikke ser noen mat, returner en tom liste.
        """;
}
