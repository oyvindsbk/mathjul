using Azure;
using Azure.AI.OpenAI;
using OpenAI.Chat;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using System.Text.Json;

namespace RecipeApi.Features.Recipes;

public interface IRecipeImageProcessor
{
    Task<RecipeExtractionResult> ExtractRecipeFromImageAsync(IFormFile imageFile, CancellationToken cancellationToken = default);
}

public class RecipeImageProcessor : IRecipeImageProcessor
{
    private readonly ChatClient _chatClient;
    private readonly ILogger<RecipeImageProcessor> _logger;
    private const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10MB
    private const int MaxImageDimension = 2048;
    private static readonly string[] AllowedContentTypes = { "image/jpeg", "image/jpg", "image/png", "image/webp" };

    public RecipeImageProcessor(IConfiguration configuration, ILogger<RecipeImageProcessor> logger)
    {
        var endpoint = configuration["AiFoundry:ImageEndpoint"]
            ?? configuration["AiFoundry:Endpoint"]
            ?? throw new InvalidOperationException("A required configuration value is missing: AiFoundry:ImageEndpoint or AiFoundry:Endpoint");
        var apiKey = configuration["AiFoundry:ImageApiKey"]
            ?? configuration["AiFoundry:ApiKey"]
            ?? throw new InvalidOperationException("A required configuration value is missing: AiFoundry:ImageApiKey or AiFoundry:ApiKey");
        var deploymentName = configuration["AiFoundry:ImageModelName"] ?? "gpt-4o-mini";

        var azureClient = new AzureOpenAIClient(
            new Uri(endpoint),
            new AzureKeyCredential(apiKey));
        _chatClient = azureClient.GetChatClient(deploymentName);
        _logger = logger;
    }

    public async Task<RecipeExtractionResult> ExtractRecipeFromImageAsync(
        IFormFile imageFile,
        CancellationToken cancellationToken = default)
    {
        if (imageFile == null || imageFile.Length == 0)
        {
            return RecipeExtractionResult.Failure("No image file provided");
        }

        if (imageFile.Length > MaxFileSizeBytes)
        {
            return RecipeExtractionResult.Failure($"Image file size exceeds maximum allowed size of {MaxFileSizeBytes / 1024 / 1024}MB");
        }

        if (!AllowedContentTypes.Contains(imageFile.ContentType.ToLowerInvariant()))
        {
            return RecipeExtractionResult.Failure($"Invalid file type. Allowed types: {string.Join(", ", AllowedContentTypes)}");
        }

        try
        {
            byte[] imageBytes;
            using (var memoryStream = new MemoryStream())
            {
                await imageFile.CopyToAsync(memoryStream, cancellationToken);
                imageBytes = memoryStream.ToArray();
            }

            _logger.LogInformation("Extracting recipe from image. Original size: {Size} bytes", imageBytes.Length);

            imageBytes = ResizeImageIfNeeded(imageBytes);

            _logger.LogInformation("Image size after resize: {Size} bytes", imageBytes.Length);

            var imageData = BinaryData.FromBytes(imageBytes);

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(RecipeExtractionPrompt.SystemPrompt),
                new UserChatMessage(
                    ChatMessageContentPart.CreateTextPart("Please extract the recipe information from this image:"),
                    ChatMessageContentPart.CreateImagePart(imageData, "image/jpeg"))
            };

            var options = new ChatCompletionOptions
            {
                Temperature = 0.2f,
                MaxOutputTokenCount = 4096
            };

            var response = await _chatClient.CompleteChatAsync(messages, options, cancellationToken);

            var finishReason = response.Value.FinishReason;
            _logger.LogInformation("AI finish reason: {FinishReason}", finishReason);

            if (finishReason == ChatFinishReason.Length)
            {
                _logger.LogWarning("AI response was truncated due to token limit");
                return RecipeExtractionResult.Failure("The recipe was too complex to extract. Please try a simpler image.");
            }

            if (finishReason == ChatFinishReason.ContentFilter)
            {
                _logger.LogWarning("AI response was blocked by content filter");
                return RecipeExtractionResult.Failure("The image was blocked by the content filter. Please try a different image.");
            }

            var content = response.Value.Content[0].Text;
            return RecipeExtractionPrompt.ParseResponseContent(content, _logger);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error extracting recipe from image");
            return RecipeExtractionResult.Failure($"Error processing image: {ex.Message}");
        }
    }

    private byte[] ResizeImageIfNeeded(byte[] imageBytes)
    {
        using var image = Image.Load(imageBytes);

        if (image.Width <= MaxImageDimension && image.Height <= MaxImageDimension)
        {
            using var output = new MemoryStream();
            image.SaveAsJpeg(output, new SixLabors.ImageSharp.Formats.Jpeg.JpegEncoder { Quality = 85 });
            return output.ToArray();
        }

        _logger.LogInformation("Resizing image from {Width}x{Height} to fit within {Max}px",
            image.Width, image.Height, MaxImageDimension);

        image.Mutate(x => x.Resize(new ResizeOptions
        {
            Mode = ResizeMode.Max,
            Size = new Size(MaxImageDimension, MaxImageDimension)
        }));

        using var resizedOutput = new MemoryStream();
        image.SaveAsJpeg(resizedOutput, new SixLabors.ImageSharp.Formats.Jpeg.JpegEncoder { Quality = 85 });
        return resizedOutput.ToArray();
    }
}

public class RecipeExtractionResult
{
    public bool IsSuccess { get; init; }
    public string? ErrorMessage { get; init; }
    public ExtractedRecipeDto? Recipe { get; init; }

    public static RecipeExtractionResult Success(ExtractedRecipeDto recipe) =>
        new() { IsSuccess = true, Recipe = recipe };

    public static RecipeExtractionResult Failure(string errorMessage) =>
        new() { IsSuccess = false, ErrorMessage = errorMessage };
}

public class ExtractedRecipeDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<string> Ingredients { get; set; } = new();
    public List<string> Instructions { get; set; } = new();
    public int? PrepTime { get; set; }
    public int? CookTime { get; set; }
    public int? Servings { get; set; }
}

internal static class RecipeExtractionPrompt
{
    internal const string SystemPrompt = @"You are a recipe extraction expert. Analyze the provided recipe content and extract all information into a structured JSON format.

Extract the following fields:
- title: The recipe name
- description: A brief description or subtitle if available
- ingredients: Array of ingredient strings (e.g., ""2 cups flour"", ""1 tsp salt"")
- instructions: Array of instruction steps as separate strings
- prepTime: Preparation time in minutes (extract from text like ""Prep: 15 min"")
- cookTime: Cooking time in minutes (extract from text like ""Cook: 30 min"")
- servings: Number of servings (extract from text like ""Serves 4"")

If any field is not clearly visible or mentioned, use null for that field.

Respond with ONLY valid JSON in this exact format:
{
  ""title"": ""Recipe Name"",
  ""description"": ""Brief description"",
  ""ingredients"": [""ingredient 1"", ""ingredient 2""],
  ""instructions"": [""step 1"", ""step 2""],
  ""prepTime"": 15,
  ""cookTime"": 30,
  ""servings"": 4
}";

    internal static RecipeExtractionResult ParseResponse(Azure.AI.Inference.ChatCompletions chatCompletions, ILogger logger)
    {
        return ParseResponseContent(chatCompletions.Content, logger);
    }

    internal static RecipeExtractionResult ParseResponseContent(string? responseContent, ILogger logger)
    {
        if (string.IsNullOrWhiteSpace(responseContent))
        {
            logger.LogError("AI response content text was null or empty.");
            return RecipeExtractionResult.Failure("AI response content text was null or empty.");
        }

        logger.LogInformation("Received response from AI ({Length} chars): {Response}", responseContent.Length, responseContent);

        if (responseContent.Trim().Length < 20)
        {
            logger.LogError("AI response too short to be valid JSON: {Content}", responseContent);
            return RecipeExtractionResult.Failure("The AI returned an incomplete response. Please try again with a clearer image.");
        }

        // Strip markdown code fences if present
        var json = responseContent.Trim();
        if (json.StartsWith("```"))
        {
            var firstNewline = json.IndexOf('\n');
            var lastFence = json.LastIndexOf("```");
            if (firstNewline >= 0 && lastFence > firstNewline)
                json = json[(firstNewline + 1)..lastFence].Trim();
        }

        try
        {
            var extractedRecipe = JsonSerializer.Deserialize<ExtractedRecipeDto>(
                json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
            );

            if (extractedRecipe == null || string.IsNullOrWhiteSpace(extractedRecipe.Title))
            {
                return RecipeExtractionResult.Failure("Failed to extract recipe information");
            }

            return RecipeExtractionResult.Success(extractedRecipe);
        }
        catch (JsonException ex)
        {
            logger.LogError(ex, "Failed to parse AI response as JSON. Raw content: {Content}", json);
            return RecipeExtractionResult.Failure("Failed to parse the AI response. The AI did not return valid recipe data. Please try again.");
        }
    }
}
