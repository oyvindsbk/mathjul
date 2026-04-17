using Azure;
using Azure.AI.Inference;
using HtmlAgilityPack;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;

namespace RecipeApi.Features.Recipes;

public interface IRecipeUrlProcessor
{
    Task<RecipeExtractionResult> ExtractRecipeFromUrlAsync(string url, string? categoryListJson = null, CancellationToken cancellationToken = default);
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
            ?? "Phi-4-multimodal-instruct";

        _chatClient = new ChatCompletionsClient(
            new Uri(endpoint),
            new AzureKeyCredential(apiKey));
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<RecipeExtractionResult> ExtractRecipeFromUrlAsync(
        string url,
        string? categoryListJson = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(url))
            return RecipeExtractionResult.Failure("No URL provided");

        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return RecipeExtractionResult.Failure("Invalid URL. Must be an http or https URL.");
        }

        if (IsPrivateOrReservedHost(uri))
            return RecipeExtractionResult.Failure("Access to private or reserved network addresses is not allowed.");

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

            var systemPrompt = RecipeExtractionPrompt.BuildSystemPrompt(categoryListJson);
            var options = new ChatCompletionsOptions
            {
                Model = _modelName,
                Temperature = 0.2f,
                MaxTokens = 4096,
                Messages =
                {
                    new ChatRequestSystemMessage(systemPrompt),
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

    private static bool IsPrivateOrReservedHost(Uri uri)
    {
        var host = uri.Host;

        if (host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
            host.Equals("0.0.0.0", StringComparison.OrdinalIgnoreCase))
            return true;

        if (IPAddress.TryParse(host, out var ip))
            return IsPrivateIpAddress(ip);

        return false;
    }

    private static bool IsPrivateIpAddress(IPAddress ip)
    {
        if (IPAddress.IsLoopback(ip)) return true;

        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            var b = ip.GetAddressBytes();
            return b[0] == 10                                       // 10.0.0.0/8
                || (b[0] == 172 && b[1] >= 16 && b[1] <= 31)       // 172.16.0.0/12
                || (b[0] == 192 && b[1] == 168)                     // 192.168.0.0/16
                || (b[0] == 169 && b[1] == 254)                     // 169.254.0.0/16 (link-local / Azure IMDS)
                || b[0] == 0;                                        // 0.0.0.0/8
        }

        if (ip.AddressFamily == AddressFamily.InterNetworkV6)
        {
            var b = ip.GetAddressBytes();
            // ::1 already covered by IsLoopback; also block fc00::/7 (ULA) and fe80::/10 (link-local)
            return (b[0] & 0xFE) == 0xFC                            // fc00::/7 unique local
                || (b[0] == 0xFE && (b[1] & 0xC0) == 0x80);        // fe80::/10 link-local
        }

        return false;
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
