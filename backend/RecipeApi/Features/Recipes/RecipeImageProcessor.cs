using Azure;
using Azure.AI.OpenAI;
using OpenAI.Chat;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using System.Text.Json;

namespace RecipeApi.Features.Recipes;

public interface IRecipeImageProcessor
{
    Task<RecipeExtractionResult> ExtractRecipeFromImageAsync(IFormFile imageFile, string? categoryListJson = null, CancellationToken cancellationToken = default);
    Task<byte[]?> TryExtractDishPhotoAsync(byte[] imageBytes, CancellationToken cancellationToken = default);
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
        string? categoryListJson = null,
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

            var systemPrompt = RecipeExtractionPrompt.BuildSystemPrompt(categoryListJson);
            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(systemPrompt),
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

    public async Task<byte[]?> TryExtractDishPhotoAsync(byte[] imageBytes, CancellationToken cancellationToken = default)
    {
        try
        {
            var imageData = BinaryData.FromBytes(imageBytes);
            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(DishPhotoPrompt.SystemPrompt),
                new UserChatMessage(
                    ChatMessageContentPart.CreateTextPart("Analyze this image for a dish photo:"),
                    ChatMessageContentPart.CreateImagePart(imageData, "image/jpeg"))
            };

            var options = new ChatCompletionOptions { Temperature = 0.1f, MaxOutputTokenCount = 256 };
            var response = await _chatClient.CompleteChatAsync(messages, options, cancellationToken);
            var content = response.Value.Content[0].Text.Trim();

            _logger.LogInformation("Dish photo detection response: {Response}", content);

            var result = DishPhotoPrompt.ParseResponse(content);
            if (result == null)
            {
                _logger.LogInformation("No dish photo detected in image");
                return null;
            }

            if (result.FullFrame)
                return imageBytes;

            // Crop to bounding box
            using var image = SixLabors.ImageSharp.Image.Load(imageBytes);
            var cropX = (int)(result.X * image.Width);
            var cropY = (int)(result.Y * image.Height);
            var cropW = (int)(result.Width * image.Width);
            var cropH = (int)(result.Height * image.Height);
            cropX = Math.Max(0, Math.Min(cropX, image.Width - 1));
            cropY = Math.Max(0, Math.Min(cropY, image.Height - 1));
            cropW = Math.Max(1, Math.Min(cropW, image.Width - cropX));
            cropH = Math.Max(1, Math.Min(cropH, image.Height - cropY));

            image.Mutate(ctx => ctx.Crop(new SixLabors.ImageSharp.Rectangle(cropX, cropY, cropW, cropH)));
            using var output = new MemoryStream();
            image.SaveAsJpeg(output, new SixLabors.ImageSharp.Formats.Jpeg.JpegEncoder { Quality = 85 });
            return output.ToArray();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Dish photo extraction failed, skipping");
            return null;
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
    public List<StructuredIngredient> Ingredients { get; set; } = new();
    public List<string> Instructions { get; set; } = new();
    public int? PrepTime { get; set; }
    public int? CookTime { get; set; }
    public int? Servings { get; set; }
    public string? Difficulty { get; set; }
    public List<int> SuggestedCategoryIds { get; set; } = new();
}

internal static class RecipeExtractionPrompt
{
    private const string BaseSystemPrompt = @"You are a recipe extraction expert. Analyze the provided recipe content and extract all information into a structured JSON format.

Extract the following fields:
- title: The recipe name
- description: A brief description or subtitle if available
- ingredients: Array of ingredient objects, each with:
  - quantity: numeric amount (e.g., 2, 0.5) or null if not specified (e.g., ""salt to taste"")
  - unit: measurement unit (e.g., ""cups"", ""tsp"", ""g"", ""dl"", ""stk"") or null if unitless (e.g., ""2 eggs"")
  - name: the ingredient name (e.g., ""flour"", ""salt"", ""eggs"")
- instructions: Array of instruction steps as separate strings
- prepTime: Preparation time in minutes. Extract from explicit text (e.g., ""Prep: 15 min""). If not stated, estimate from the instructions (e.g., chopping, marinating steps).
- cookTime: Cooking time in minutes. Extract from explicit text (e.g., ""Cook: 30 min"", ""bake for 45 minutes""). If not stated, estimate from the instructions (e.g., simmering, baking, frying steps).
- servings: Number of servings/portions (extract from text like ""Serves 4"", ""4 porsjoner"")
- difficulty: Estimate the difficulty as exactly one of: ""Enkel"", ""Middels"", or ""Avansert"".
  Use these guidelines:
  - ""Enkel"": few ingredients (under 8), straightforward steps, common techniques (boiling, mixing, frying)
  - ""Middels"": moderate ingredient count, some technique required (e.g., making a sauce, folding, timing multiple components)
  - ""Avansert"": many ingredients or steps, advanced techniques (e.g., tempering chocolate, making pastry dough, precise temperatures, long fermentation)
  If the recipe content is ambiguous, prefer ""Middels"".

Convert fractions to decimals (e.g., 1/2 = 0.5, 1/4 = 0.25).
If prepTime or cookTime cannot be extracted or estimated, use null.";

    internal static string BuildSystemPrompt(string? categoryListJson)
    {
        if (string.IsNullOrWhiteSpace(categoryListJson))
        {
            return BaseSystemPrompt + @"

Respond with ONLY valid JSON in this exact format:
{
  ""title"": ""Recipe Name"",
  ""description"": ""Brief description"",
  ""ingredients"": [
    {""quantity"": 2, ""unit"": ""cups"", ""name"": ""flour""},
    {""quantity"": 1, ""unit"": ""tsp"", ""name"": ""salt""},
    {""quantity"": null, ""unit"": null, ""name"": ""fresh herbs to taste""}
  ],
  ""instructions"": [""step 1"", ""step 2""],
  ""prepTime"": 15,
  ""cookTime"": 30,
  ""servings"": 4,
  ""difficulty"": ""Middels"",
  ""suggestedCategoryIds"": []
}";
        }

        return BaseSystemPrompt + $@"

You also have access to a predefined list of categories. Based on the recipe, suggest which category IDs fit best.
Only suggest IDs from the list below. Include 1-5 most relevant categories. If none fit, use an empty array.

Available categories:
{categoryListJson}

Respond with ONLY valid JSON in this exact format:
{{
  ""title"": ""Recipe Name"",
  ""description"": ""Brief description"",
  ""ingredients"": [
    {{""quantity"": 2, ""unit"": ""cups"", ""name"": ""flour""}},
    {{""quantity"": 1, ""unit"": ""tsp"", ""name"": ""salt""}},
    {{""quantity"": null, ""unit"": null, ""name"": ""fresh herbs to taste""}}
  ],
  ""instructions"": [""step 1"", ""step 2""],
  ""prepTime"": 15,
  ""cookTime"": 30,
  ""servings"": 4,
  ""difficulty"": ""Middels"",
  ""suggestedCategoryIds"": [1, 3]
}}";
    }

    /// <summary>
    /// If the AI returns ingredients as plain strings instead of objects, convert them.
    /// </summary>
    internal static string NormalizeIngredients(string json, ILogger logger)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (!root.TryGetProperty("ingredients", out var ingredients) &&
                !root.TryGetProperty("Ingredients", out ingredients))
                return json;

            if (ingredients.ValueKind != JsonValueKind.Array || ingredients.GetArrayLength() == 0)
                return json;

            // Check if first element is a string (legacy format)
            var first = ingredients[0];
            if (first.ValueKind != JsonValueKind.String)
                return json; // Already structured objects

            logger.LogInformation("Converting plain string ingredients to structured format");

            var structured = new List<StructuredIngredient>();
            foreach (var item in ingredients.EnumerateArray())
            {
                structured.Add(new StructuredIngredient { Name = item.GetString() ?? string.Empty });
            }

            // Rebuild JSON with structured ingredients
            using var ms = new MemoryStream();
            using var writer = new Utf8JsonWriter(ms);
            writer.WriteStartObject();
            foreach (var prop in root.EnumerateObject())
            {
                if (prop.Name.Equals("ingredients", StringComparison.OrdinalIgnoreCase))
                {
                    writer.WritePropertyName(prop.Name);
                    JsonSerializer.Serialize(writer, structured);
                }
                else
                {
                    prop.WriteTo(writer);
                }
            }
            writer.WriteEndObject();
            writer.Flush();

            return System.Text.Encoding.UTF8.GetString(ms.ToArray());
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to normalize ingredients, proceeding with original JSON");
            return json;
        }
    }

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
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            // Pre-process: if ingredients contains plain strings, convert to structured objects
            json = NormalizeIngredients(json, logger);

            var extractedRecipe = JsonSerializer.Deserialize<ExtractedRecipeDto>(json, options);

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

internal record DishPhotoResult(bool FullFrame, float X, float Y, float Width, float Height);

internal static class DishPhotoPrompt
{
    internal const string SystemPrompt = @"You are a food photo analyzer. Determine whether the image contains a dish photo.

Respond with ONLY valid JSON in one of these two formats:

If the image clearly shows food/a dish that fills most of the frame:
{""dish"": true, ""fullFrame"": true}

If the image clearly shows food/a dish in a specific region:
{""dish"": true, ""fullFrame"": false, ""x"": 0.1, ""y"": 0.05, ""width"": 0.8, ""height"": 0.9}
(x, y, width, height are normalized 0-1 fractions of image dimensions)

If the image does NOT clearly show food (e.g. it's a recipe card, text, or ambiguous):
{""dish"": false}

Be conservative: only return dish=true when you are confident.";

    internal static DishPhotoResult? ParseResponse(string content)
    {
        try
        {
            var json = content.Trim();
            if (json.StartsWith("```"))
            {
                var firstNewline = json.IndexOf('\n');
                var lastFence = json.LastIndexOf("```");
                if (firstNewline >= 0 && lastFence > firstNewline)
                    json = json[(firstNewline + 1)..lastFence].Trim();
            }

            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (!root.TryGetProperty("dish", out var dishProp) || !dishProp.GetBoolean())
                return null;

            if (root.TryGetProperty("fullFrame", out var ff) && ff.GetBoolean())
                return new DishPhotoResult(true, 0, 0, 1, 1);

            var x = root.TryGetProperty("x", out var xp) ? xp.GetSingle() : 0f;
            var y = root.TryGetProperty("y", out var yp) ? yp.GetSingle() : 0f;
            var w = root.TryGetProperty("width", out var wp) ? wp.GetSingle() : 1f;
            var h = root.TryGetProperty("height", out var hp) ? hp.GetSingle() : 1f;
            return new DishPhotoResult(false, x, y, w, h);
        }
        catch
        {
            return null;
        }
    }
}
