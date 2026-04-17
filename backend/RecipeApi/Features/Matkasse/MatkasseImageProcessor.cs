using Azure;
using Azure.AI.OpenAI;
using OpenAI.Chat;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using System.Text.Json;

namespace RecipeApi.Features.Matkasse;

public interface IMatkasseImageProcessor
{
    Task<MatkasseExtractionResult> ExtractOppskrifterAsync(
        IReadOnlyList<IFormFile> imageFiles,
        string leverandor,
        CancellationToken cancellationToken = default);
}

public class MatkasseExtractionResult
{
    public bool IsSuccess { get; init; }
    public string? ErrorMessage { get; init; }
    public List<ExtractedMatkasseOppskrift> Oppskrifter { get; init; } = [];

    public static MatkasseExtractionResult Failure(string message) =>
        new() { IsSuccess = false, ErrorMessage = message };

    public static MatkasseExtractionResult Success(List<ExtractedMatkasseOppskrift> oppskrifter) =>
        new() { IsSuccess = true, Oppskrifter = oppskrifter };
}

public class ExtractedMatkasseOppskrift
{
    public string Tittel { get; set; } = string.Empty;
    public string? Beskrivelse { get; set; }
}

public class MatkasseImageProcessor : IMatkasseImageProcessor
{
    private readonly ChatClient _chatClient;
    private readonly ILogger<MatkasseImageProcessor> _logger;
    private const long MaxFileSizeBytes = 10 * 1024 * 1024;
    private const int MaxImageDimension = 2048;
    private static readonly string[] AllowedContentTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    public MatkasseImageProcessor(IConfiguration configuration, ILogger<MatkasseImageProcessor> logger)
    {
        var endpoint = configuration["AiFoundry:ImageEndpoint"]
            ?? configuration["AiFoundry:Endpoint"]
            ?? throw new InvalidOperationException("Missing config: AiFoundry:ImageEndpoint or AiFoundry:Endpoint");
        var apiKey = configuration["AiFoundry:ImageApiKey"]
            ?? configuration["AiFoundry:ApiKey"]
            ?? throw new InvalidOperationException("Missing config: AiFoundry:ImageApiKey or AiFoundry:ApiKey");
        var deploymentName = configuration["AiFoundry:ImageModelName"] ?? "gpt-4o-mini";

        var azureClient = new AzureOpenAIClient(new Uri(endpoint), new AzureKeyCredential(apiKey));
        _chatClient = azureClient.GetChatClient(deploymentName);
        _logger = logger;
    }

    public async Task<MatkasseExtractionResult> ExtractOppskrifterAsync(
        IReadOnlyList<IFormFile> imageFiles,
        string leverandor,
        CancellationToken cancellationToken = default)
    {
        if (imageFiles.Count == 0)
            return MatkasseExtractionResult.Failure("Ingen bilder ble lastet opp");

        foreach (var file in imageFiles)
        {
            if (file.Length == 0)
                return MatkasseExtractionResult.Failure("Ett eller flere bilder er tomme");
            if (file.Length > MaxFileSizeBytes)
                return MatkasseExtractionResult.Failure($"Bildet '{file.FileName}' er for stort (maks 10 MB)");
            if (!AllowedContentTypes.Contains(file.ContentType.ToLowerInvariant()))
                return MatkasseExtractionResult.Failure($"Ugyldig filtype for '{file.FileName}'");
        }

        try
        {
            var imageParts = new List<ChatMessageContentPart>();
            foreach (var file in imageFiles)
            {
                byte[] bytes;
                using (var ms = new MemoryStream())
                {
                    await file.CopyToAsync(ms, cancellationToken);
                    bytes = ms.ToArray();
                }
                bytes = ResizeIfNeeded(bytes);
                imageParts.Add(ChatMessageContentPart.CreateImagePart(BinaryData.FromBytes(bytes), "image/jpeg"));
            }

            var systemPrompt = BuildSystemPrompt(leverandor);
            var userParts = new List<ChatMessageContentPart>
            {
                ChatMessageContentPart.CreateTextPart(
                    $"These images show the weekly menu from a Norwegian meal kit service ({leverandor}). " +
                    "Extract ALL recipes visible across all images and return them as a JSON array.")
            };
            userParts.AddRange(imageParts);

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(systemPrompt),
                new UserChatMessage(userParts.ToArray())
            };

            var options = new ChatCompletionOptions { Temperature = 0.1f, MaxOutputTokenCount = 8192 };
            var response = await _chatClient.CompleteChatAsync(messages, options, cancellationToken);

            if (response.Value.FinishReason == ChatFinishReason.Length)
                return MatkasseExtractionResult.Failure("Svaret ble avkortet — prøv med færre bilder");

            var content = response.Value.Content[0].Text;
            _logger.LogInformation("Matkasse AI response length: {Length}", content.Length);

            return ParseResponse(content);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Feil ved AI-ekstraksjon av matkasse");
            return MatkasseExtractionResult.Failure($"Feil ved bildeanalyse: {ex.Message}");
        }
    }

    private static string BuildSystemPrompt(string leverandor) => $$"""
        You are a recipe extraction assistant for the Norwegian meal kit service "{{leverandor}}".

        From the provided images, extract ALL recipe/dish names you can identify.
        Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):

        {
          "oppskrifter": [
            {
              "tittel": "Recipe name in Norwegian",
              "beskrivelse": "1-2 sentence description of the dish in Norwegian"
            }
          ]
        }

        Rules:
        - Return between 1 and 6 recipes
        - Titles must be in Norwegian
        - If you cannot identify any recipes, return { "oppskrifter": [] }
        - Do not include any text outside the JSON object
        """;

    private MatkasseExtractionResult ParseResponse(string content)
    {
        var json = content.Trim();
        if (json.StartsWith("```"))
        {
            var start = json.IndexOf('{');
            var end = json.LastIndexOf('}');
            if (start >= 0 && end > start)
                json = json[start..(end + 1)];
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (!root.TryGetProperty("oppskrifter", out var oppskrifterEl))
                return MatkasseExtractionResult.Failure("AI returnerte uventet format");

            var oppskrifter = new List<ExtractedMatkasseOppskrift>();
            foreach (var el in oppskrifterEl.EnumerateArray())
            {
                oppskrifter.Add(new ExtractedMatkasseOppskrift
                {
                    Tittel = el.TryGetProperty("tittel", out var t) ? t.GetString() ?? "" : "",
                    Beskrivelse = el.TryGetProperty("beskrivelse", out var b) ? b.GetString() : null,
                });
            }

            if (oppskrifter.Count == 0)
                return MatkasseExtractionResult.Failure("Fant ingen oppskrifter i bildene");

            return MatkasseExtractionResult.Success(oppskrifter);
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Failed to parse matkasse AI response: {Content}", content);
            return MatkasseExtractionResult.Failure("Kunne ikke lese AI-svaret. Prøv igjen.");
        }
    }

    private static byte[] ResizeIfNeeded(byte[] imageBytes)
    {
        try
        {
            using var img = SixLabors.ImageSharp.Image.Load(imageBytes);
            if (img.Width <= MaxImageDimension && img.Height <= MaxImageDimension)
                return imageBytes;

            var ratio = Math.Min((float)MaxImageDimension / img.Width, (float)MaxImageDimension / img.Height);
            img.Mutate(x => x.Resize((int)(img.Width * ratio), (int)(img.Height * ratio)));

            using var ms = new MemoryStream();
            img.SaveAsJpeg(ms);
            return ms.ToArray();
        }
        catch
        {
            return imageBytes;
        }
    }
}
