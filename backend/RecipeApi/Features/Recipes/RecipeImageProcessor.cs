using Azure;
using Azure.AI.Inference;
using System.Text.Json;

namespace RecipeApi.Features.Recipes;

public interface IRecipeImageProcessor
{
    Task<RecipeExtractionResult> ExtractRecipeFromImageAsync(IFormFile imageFile, CancellationToken cancellationToken = default);
}

public class RecipeImageProcessor : IRecipeImageProcessor
{
    private readonly ChatCompletionsClient _chatClient;
    private readonly string _modelName;
    private readonly ILogger<RecipeImageProcessor> _logger;
    private const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10MB
    private static readonly string[] AllowedContentTypes = { "image/jpeg", "image/jpg", "image/png", "image/webp" };

    public RecipeImageProcessor(IConfiguration configuration, ILogger<RecipeImageProcessor> logger)
    {
        var endpoint = configuration["AiFoundry:Endpoint"]
            ?? throw new InvalidOperationException("A required configuration value is missing: AiFoundry:Endpoint");
        var apiKey = configuration["AiFoundry:ApiKey"]
            ?? throw new InvalidOperationException("A required configuration value is missing: AiFoundry:ApiKey");
        _modelName = configuration["AiFoundry:ModelName"]
            ?? throw new InvalidOperationException("A required configuration value is missing: AiFoundry:ModelName");

        _chatClient = new ChatCompletionsClient(
            new Uri(endpoint),
            new AzureKeyCredential(apiKey));
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

            _logger.LogInformation("Extracting recipe from image. Image size: {Size} bytes", imageBytes.Length);

            var base64 = Convert.ToBase64String(imageBytes);
            var dataUri = new Uri($"data:{imageFile.ContentType};base64,{base64}");

            var options = new ChatCompletionsOptions
            {
                Model = _modelName,
                Temperature = 0.2f,
                MaxTokens = 2000,
                Messages =
                {
                    new ChatRequestSystemMessage(RecipeExtractionPrompt.SystemPrompt),
                    new ChatRequestUserMessage(new ChatMessageContentItem[]
                    {
                        new ChatMessageTextContentItem("Please extract the recipe information from this image:"),
                        new ChatMessageImageContentItem(dataUri)
                    })
                }
            };

            var response = await _chatClient.CompleteAsync(options, cancellationToken);

            return RecipeExtractionPrompt.ParseResponse(response.Value, _logger);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error extracting recipe from image");
            return RecipeExtractionResult.Failure($"Error processing image: {ex.Message}");
        }
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

    internal static RecipeExtractionResult ParseResponse(ChatCompletions chatCompletions, ILogger logger)
    {
        var responseContent = chatCompletions.Content;
        if (string.IsNullOrWhiteSpace(responseContent))
        {
            logger.LogError("AI response content text was null or empty.");
            return RecipeExtractionResult.Failure("AI response content text was null or empty.");
        }

        logger.LogInformation("Received response from AI: {Response}", responseContent);

        // Strip markdown code fences if present
        var json = responseContent.Trim();
        if (json.StartsWith("```"))
        {
            var firstNewline = json.IndexOf('\n');
            var lastFence = json.LastIndexOf("```");
            if (firstNewline >= 0 && lastFence > firstNewline)
                json = json[(firstNewline + 1)..lastFence].Trim();
        }

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
}
