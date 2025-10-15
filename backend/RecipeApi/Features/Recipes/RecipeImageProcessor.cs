using Azure.AI.OpenAI;
using OpenAI.Chat;
using System.ClientModel;
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
    private static readonly string[] AllowedContentTypes = { "image/jpeg", "image/jpg", "image/png", "image/webp" };

    public RecipeImageProcessor(IConfiguration configuration, ILogger<RecipeImageProcessor> logger)
    {
        var azureEndpoint = configuration["AzureOpenAI:Endpoint"] 
            ?? throw new InvalidOperationException("Azure OpenAI endpoint is not configured");
        var apiKey = configuration["AzureOpenAI:ApiKey"] 
            ?? throw new InvalidOperationException("Azure OpenAI API key is not configured");
        var deploymentName = configuration["AzureOpenAI:DeploymentName"] 
            ?? throw new InvalidOperationException("Azure OpenAI deployment name is not configured");
        
        var client = new AzureOpenAIClient(new Uri(azureEndpoint), new ApiKeyCredential(apiKey));
        _chatClient = client.GetChatClient(deploymentName);
        _logger = logger;
    }

    public async Task<RecipeExtractionResult> ExtractRecipeFromImageAsync(
        IFormFile imageFile, 
        CancellationToken cancellationToken = default)
    {
        // Validate file
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
            // Convert image to BinaryData
            byte[] imageBytes;
            using (var memoryStream = new MemoryStream())
            {
                await imageFile.CopyToAsync(memoryStream, cancellationToken);
                imageBytes = memoryStream.ToArray();
            }

            // Call OpenAI Vision API
            _logger.LogInformation("Extracting recipe from image using OpenAI Vision API. Image size: {Size} bytes", imageBytes.Length);

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(@"You are a recipe extraction expert. Analyze the provided recipe image and extract all information into a structured JSON format.

Extract the following fields:
- title: The recipe name
- description: A brief description or subtitle if available
- ingredients: Array of ingredient strings (e.g., ""2 cups flour"", ""1 tsp salt"")
- instructions: Array of instruction steps as separate strings
- prepTime: Preparation time in minutes (extract from text like ""Prep: 15 min"")
- cookTime: Cooking time in minutes (extract from text like ""Cook: 30 min"")
- servings: Number of servings (extract from text like ""Serves 4"")

If any field is not clearly visible or mentioned in the image, use null for that field.

Respond with ONLY valid JSON in this exact format:
{
  ""title"": ""Recipe Name"",
  ""description"": ""Brief description"",
  ""ingredients"": [""ingredient 1"", ""ingredient 2""],
  ""instructions"": [""step 1"", ""step 2""],
  ""prepTime"": 15,
  ""cookTime"": 30,
  ""servings"": 4
}"),
                new UserChatMessage(
                    ChatMessageContentPart.CreateTextPart("Please extract the recipe information from this image:"),
                    ChatMessageContentPart.CreateImagePart(BinaryData.FromBytes(imageBytes), imageFile.ContentType)
                )
            };

            var chatCompletion = await _chatClient.CompleteChatAsync(
                messages,
                new ChatCompletionOptions
                {
                    Temperature = 0.2f, // Low temperature for more consistent extraction
                    MaxOutputTokenCount = 2000
                },
                cancellationToken
            );

            var responseContent = chatCompletion.Value.Content[0].Text;
            _logger.LogInformation("Received response from OpenAI: {Response}", responseContent);

            // Parse the JSON response
            var extractedRecipe = JsonSerializer.Deserialize<ExtractedRecipeDto>(
                responseContent, 
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
            );

            if (extractedRecipe == null || string.IsNullOrWhiteSpace(extractedRecipe.Title))
            {
                return RecipeExtractionResult.Failure("Failed to extract recipe information from image");
            }

            return RecipeExtractionResult.Success(extractedRecipe);
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
