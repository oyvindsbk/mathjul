using Azure;
using Azure.AI.Inference;
using HtmlAgilityPack;
using System.Text;
using System.Text.Json;

namespace RecipeApi.Features.Recipes;

public interface IRecipeUrlProcessor
{
    Task<RecipeExtractionResult> ExtractRecipeFromUrlAsync(string url, CancellationToken cancellationToken = default);
}

public class RecipeUrlProcessor : IRecipeUrlProcessor
{
    private readonly ChatCompletionsClient _chatClient;
    private readonly string _modelName;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<RecipeUrlProcessor> _logger;
    private const int MaxTextLength = 8000;

    public RecipeUrlProcessor(
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        ILogger<RecipeUrlProcessor> logger)
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
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<RecipeExtractionResult> ExtractRecipeFromUrlAsync(
        string url,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(url))
            return RecipeExtractionResult.Failure("No URL provided");

        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return RecipeExtractionResult.Failure("Invalid URL. Must be an http or https URL.");
        }

        try
        {
            _logger.LogInformation("Fetching recipe page: {Url}", url);

            var httpClient = _httpClientFactory.CreateClient();
            httpClient.DefaultRequestHeaders.UserAgent.ParseAdd(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            httpClient.Timeout = TimeSpan.FromSeconds(15);

            var html = await httpClient.GetStringAsync(uri, cancellationToken);
            var pageText = ExtractText(html);

            if (string.IsNullOrWhiteSpace(pageText))
                return RecipeExtractionResult.Failure("Could not extract readable text from the page");

            _logger.LogInformation("Extracted {Length} chars of text from URL, sending to AI", pageText.Length);

            var options = new ChatCompletionsOptions
            {
                Model = _modelName,
                Temperature = 0.2f,
                MaxTokens = 2000,
                Messages =
                {
                    new ChatRequestSystemMessage(RecipeExtractionPrompt.SystemPrompt),
                    new ChatRequestUserMessage($"Please extract the recipe information from the following webpage content:\n\n{pageText}")
                }
            };

            var response = await _chatClient.CompleteAsync(options, cancellationToken);

            return RecipeExtractionPrompt.ParseResponse(response.Value, _logger);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Failed to fetch URL: {Url}", url);
            return RecipeExtractionResult.Failure($"Could not fetch the page: {ex.Message}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error extracting recipe from URL: {Url}", url);
            return RecipeExtractionResult.Failure($"Error processing URL: {ex.Message}");
        }
    }

    private static string ExtractText(string html)
    {
        var doc = new HtmlDocument();
        doc.LoadHtml(html);

        // Remove script, style, nav, footer, header nodes
        foreach (var node in doc.DocumentNode.SelectNodes("//script|//style|//nav|//footer|//header|//aside") ?? Enumerable.Empty<HtmlNode>())
            node.Remove();

        // Try to find the most content-rich container
        var contentNode =
            doc.DocumentNode.SelectSingleNode("//main") ??
            doc.DocumentNode.SelectSingleNode("//article") ??
            doc.DocumentNode.SelectSingleNode("//body") ??
            doc.DocumentNode;

        var sb = new StringBuilder();

        // Include title
        var titleNode = doc.DocumentNode.SelectSingleNode("//title");
        if (titleNode != null)
            sb.AppendLine(titleNode.InnerText.Trim());

        // Extract inner text, collapse whitespace
        var text = contentNode.InnerText;
        var lines = text.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        foreach (var line in lines)
        {
            var trimmed = line.Trim();
            if (trimmed.Length > 1)
                sb.AppendLine(trimmed);
        }

        var result = sb.ToString();
        return result.Length > MaxTextLength ? result[..MaxTextLength] : result;
    }
}
