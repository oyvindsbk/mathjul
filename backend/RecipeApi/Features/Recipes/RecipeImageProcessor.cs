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
    Task<RecipeExtractionResult> ExtractRecipeFromImagesAsync(IReadOnlyList<IFormFile> imageFiles, string? categoryListJson = null, CancellationToken cancellationToken = default);
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

    public async Task<RecipeExtractionResult> ExtractRecipeFromImagesAsync(
        IReadOnlyList<IFormFile> imageFiles,
        string? categoryListJson = null,
        CancellationToken cancellationToken = default)
    {
        if (imageFiles == null || imageFiles.Count == 0)
            return RecipeExtractionResult.Failure("No image files provided");

        foreach (var file in imageFiles)
        {
            if (file.Length == 0)
                return RecipeExtractionResult.Failure("One or more image files are empty");
            if (file.Length > MaxFileSizeBytes)
                return RecipeExtractionResult.Failure($"Image '{file.FileName}' exceeds the maximum allowed size of {MaxFileSizeBytes / 1024 / 1024}MB");
            if (!AllowedContentTypes.Contains(file.ContentType.ToLowerInvariant()))
                return RecipeExtractionResult.Failure($"Invalid file type for '{file.FileName}'. Allowed types: {string.Join(", ", AllowedContentTypes)}");
        }

        try
        {
            var imageParts = new List<ChatMessageContentPart>();
            foreach (var file in imageFiles)
            {
                byte[] imageBytes;
                using (var ms = new MemoryStream())
                {
                    await file.CopyToAsync(ms, cancellationToken);
                    imageBytes = ms.ToArray();
                }
                imageBytes = ResizeImageIfNeeded(imageBytes);
                imageParts.Add(ChatMessageContentPart.CreateImagePart(BinaryData.FromBytes(imageBytes), "image/jpeg"));
            }

            _logger.LogInformation("Extracting recipe from {Count} images", imageFiles.Count);

            var systemPrompt = RecipeExtractionPrompt.BuildSystemPrompt(categoryListJson);
            var userParts = new List<ChatMessageContentPart>
            {
                ChatMessageContentPart.CreateTextPart(
                    "The following images are all parts of the same recipe. " +
                    "They may be provided in any order — some may show ingredients, others instructions, others the finished dish. " +
                    "Please extract one complete, coherent recipe by combining information from all images:")
            };
            userParts.AddRange(imageParts);

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(systemPrompt),
                new UserChatMessage(userParts.ToArray())
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
                return RecipeExtractionResult.Failure("The recipe was too complex to extract. Please try fewer or simpler images.");
            if (finishReason == ChatFinishReason.ContentFilter)
                return RecipeExtractionResult.Failure("The images were blocked by the content filter. Please try different images.");

            var content = response.Value.Content[0].Text;
            return RecipeExtractionPrompt.ParseResponseContent(content, _logger);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error extracting recipe from images");
            return RecipeExtractionResult.Failure($"Error processing images: {ex.Message}");
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
