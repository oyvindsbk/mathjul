using Azure;
using Azure.AI.OpenAI;
using HtmlAgilityPack;
using OpenAI.Chat;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;

namespace RecipeApi.Features.Recipes;

public interface IRecipeUrlProcessor
{
    Task<RecipeExtractionResult> ExtractRecipeFromUrlAsync(string url, string? categoryListJson = null, Func<string, Task>? reportStage = null, CancellationToken cancellationToken = default);
}

public class RecipeUrlProcessor : IRecipeUrlProcessor
{
    private readonly ChatClient _chatClient;
    private readonly ILogger<RecipeUrlProcessor> _logger;
    private readonly IBlobStorageService _blobStorage;
    private readonly string _modelName;
    private const int MaxTextLength = 8000;

    public RecipeUrlProcessor(
        IConfiguration configuration,
        IBlobStorageService blobStorage,
        ILogger<RecipeUrlProcessor> logger)
    {
        var endpoint = configuration["AiFoundry:Endpoint"]
            ?? throw new InvalidOperationException("A required configuration value is missing: AiFoundry:Endpoint");
        var apiKey = configuration["AiFoundry:ApiKey"]
            ?? throw new InvalidOperationException("A required configuration value is missing: AiFoundry:ApiKey");
        _modelName = configuration["AiFoundry:TextModelName"] ?? "gpt-4o-mini";

        _chatClient = new AzureOpenAIClient(new Uri(endpoint), new AzureKeyCredential(apiKey))
            .GetChatClient(_modelName);
        _blobStorage = blobStorage;
        _logger = logger;
    }

    public async Task<RecipeExtractionResult> ExtractRecipeFromUrlAsync(
        string url,
        string? categoryListJson = null,
        Func<string, Task>? reportStage = null,
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

            if (reportStage != null) await reportStage("fetching_url");
            var cookieContainer = new CookieContainer();
            using var handler = new HttpClientHandler
            {
                CookieContainer = cookieContainer,
                AllowAutoRedirect = true,
                AutomaticDecompression = System.Net.DecompressionMethods.All
            };
            using var httpClient = new HttpClient(handler);
            httpClient.DefaultRequestHeaders.UserAgent.ParseAdd(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            httpClient.DefaultRequestHeaders.Accept.ParseAdd(
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8");
            httpClient.DefaultRequestHeaders.AcceptLanguage.ParseAdd("nb,no;q=0.9,en;q=0.8");
            httpClient.Timeout = TimeSpan.FromSeconds(15);

            var html = await httpClient.GetStringAsync(uri, cancellationToken);

            // Try JSON-LD first — it's structured and accurate, no AI needed
            var jsonLdResult = TryExtractFromJsonLd(html);
            ExtractedRecipeDto? extractedDto;
            if (jsonLdResult != null)
            {
                _logger.LogInformation("Successfully extracted recipe from JSON-LD structured data");
                extractedDto = jsonLdResult;
            }
            else
            {
                var pageText = ExtractText(html);

                if (string.IsNullOrWhiteSpace(pageText))
                    return RecipeExtractionResult.Failure("Could not extract readable text from the page");

                var htmlImageUrl = ExtractMainImageUrl(html, uri);

                _logger.LogInformation("No JSON-LD found, sending {Length} chars of text to AI model {Model}", pageText.Length, _modelName);

                if (reportStage != null) await reportStage("ai_processing");
                var systemPrompt = RecipeExtractionPrompt.BuildSystemPrompt(categoryListJson);
                var messages = new List<ChatMessage>
                {
                    new SystemChatMessage(systemPrompt),
                    new UserChatMessage($"Please extract the recipe information from the following webpage content:\n\n{pageText}")
                };
                var options = new ChatCompletionOptions { Temperature = 0.2f, MaxOutputTokenCount = 4096 };

                var response = await _chatClient.CompleteChatAsync(messages, options, cancellationToken);

                var aiResult = RecipeExtractionPrompt.ParseResponseContent(response.Value.Content[0].Text, _logger);
                if (!aiResult.IsSuccess) return aiResult;
                extractedDto = aiResult.Recipe!;

                if (string.IsNullOrWhiteSpace(extractedDto.ImageUrl) && htmlImageUrl != null)
                    extractedDto.ImageUrl = htmlImageUrl;
            }

            if (reportStage != null) await reportStage("downloading_image");
            var mainImageUrl = await TryDownloadImageAsync(extractedDto.ImageUrl, cancellationToken);
            return RecipeExtractionResult.Success(extractedDto, mainImageUrl);
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

    private ExtractedRecipeDto? TryExtractFromJsonLd(string html)
    {
        var doc = new HtmlDocument();
        doc.LoadHtml(html);

        var scriptNodes = doc.DocumentNode.SelectNodes("//script[@type='application/ld+json']");
        if (scriptNodes == null) return null;

        foreach (var node in scriptNodes)
        {
            try
            {
                var jsonText = node.InnerText.Trim();
                if (string.IsNullOrWhiteSpace(jsonText)) continue;

                using var doc2 = JsonDocument.Parse(jsonText);
                var root = doc2.RootElement;

                // Handle both single object and @graph array
                JsonElement? recipeElement = null;
                if (root.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in root.EnumerateArray())
                    {
                        if (IsRecipeType(item)) { recipeElement = item; break; }
                    }
                }
                else if (root.ValueKind == JsonValueKind.Object)
                {
                    if (IsRecipeType(root))
                        recipeElement = root;
                    else if (root.TryGetProperty("@graph", out var graph) && graph.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in graph.EnumerateArray())
                        {
                            if (IsRecipeType(item)) { recipeElement = item; break; }
                        }
                    }
                }

                if (recipeElement == null) continue;

                var recipe = MapJsonLdToDto(recipeElement.Value);
                if (recipe != null) return recipe;
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Failed to parse JSON-LD block, trying next");
            }
        }

        return null;
    }

    private static bool IsRecipeType(JsonElement element)
    {
        if (!element.TryGetProperty("@type", out var typeProp)) return false;
        if (typeProp.ValueKind == JsonValueKind.String)
            return typeProp.GetString()?.Equals("Recipe", StringComparison.OrdinalIgnoreCase) == true;
        if (typeProp.ValueKind == JsonValueKind.Array)
        {
            foreach (var t in typeProp.EnumerateArray())
                if (t.GetString()?.Equals("Recipe", StringComparison.OrdinalIgnoreCase) == true) return true;
        }
        return false;
    }

    private static ExtractedRecipeDto? MapJsonLdToDto(JsonElement r)
    {
        var title = GetString(r, "name");
        if (string.IsNullOrWhiteSpace(title)) return null;

        var dto = new ExtractedRecipeDto
        {
            Title = title,
            Description = GetString(r, "description"),
            ImageUrl = ExtractJsonLdImageUrl(r),
            PrepTime = ParseIsoDuration(GetString(r, "prepTime")),
            CookTime = ParseIsoDuration(GetString(r, "cookTime")) ?? ParseIsoDuration(GetString(r, "totalTime")),
        };

        // Servings from recipeYield
        if (r.TryGetProperty("recipeYield", out var yieldProp))
        {
            var yieldStr = yieldProp.ValueKind == JsonValueKind.Array
                ? yieldProp.EnumerateArray().FirstOrDefault().GetString()
                : yieldProp.ValueKind == JsonValueKind.String ? yieldProp.GetString()
                : yieldProp.ValueKind == JsonValueKind.Number ? yieldProp.GetRawText()
                : null;

            if (yieldStr != null)
            {
                // Extract leading number from strings like "6 porsjoner" or "6"
                var digits = new string(yieldStr.TakeWhile(c => char.IsDigit(c) || c == '.').ToArray());
                if (digits.Length > 0 && double.TryParse(digits, System.Globalization.NumberStyles.Any,
                        System.Globalization.CultureInfo.InvariantCulture, out var servings))
                    dto.Servings = servings;
            }
        }

        // Ingredients
        if (r.TryGetProperty("recipeIngredient", out var ingProp) && ingProp.ValueKind == JsonValueKind.Array)
        {
            foreach (var ing in ingProp.EnumerateArray())
            {
                var raw = ing.GetString();
                if (!string.IsNullOrWhiteSpace(raw))
                    dto.Ingredients.Add(ParseIngredientString(raw));
            }
        }

        // Instructions — handle HowToStep, HowToSection, or plain string
        if (r.TryGetProperty("recipeInstructions", out var instrProp))
        {
            if (instrProp.ValueKind == JsonValueKind.String)
            {
                var text = instrProp.GetString();
                if (!string.IsNullOrWhiteSpace(text)) dto.Instructions.Add(text);
            }
            else if (instrProp.ValueKind == JsonValueKind.Array)
            {
                var sections = new List<ExtractedIngredientSectionDto>();
                var instrSections = new List<ExtractedInstructionSectionDto>();

                foreach (var item in instrProp.EnumerateArray())
                {
                    var itemType = item.TryGetProperty("@type", out var tp) ? tp.GetString() : null;

                    if (itemType?.Equals("HowToSection", StringComparison.OrdinalIgnoreCase) == true)
                    {
                        var heading = GetString(item, "name") ?? "";
                        var steps = new List<string>();
                        if (item.TryGetProperty("itemListElement", out var listEl) && listEl.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var step in listEl.EnumerateArray())
                                steps.Add(GetString(step, "text") ?? GetString(step, "name") ?? "");
                        }
                        instrSections.Add(new ExtractedInstructionSectionDto { Heading = heading, Steps = steps });
                    }
                    else if (itemType?.Equals("HowToStep", StringComparison.OrdinalIgnoreCase) == true)
                    {
                        var text = GetString(item, "text") ?? GetString(item, "name") ?? "";
                        if (!string.IsNullOrWhiteSpace(text)) dto.Instructions.Add(text);
                    }
                    else if (item.ValueKind == JsonValueKind.String)
                    {
                        var text = item.GetString();
                        if (!string.IsNullOrWhiteSpace(text)) dto.Instructions.Add(text);
                    }
                }

                if (instrSections.Count > 0)
                {
                    dto.InstructionSections = instrSections;
                    dto.Instructions = [];
                }
            }
        }

        // Tips from "comment" or "review"
        if (r.TryGetProperty("comment", out var commentProp) && commentProp.ValueKind == JsonValueKind.Array)
        {
            foreach (var c in commentProp.EnumerateArray())
            {
                var text = GetString(c, "text");
                if (!string.IsNullOrWhiteSpace(text)) dto.Tips.Add(text);
            }
        }

        return dto;
    }

    private static string? ExtractJsonLdImageUrl(JsonElement r)
    {
        if (!r.TryGetProperty("image", out var img)) return null;
        if (img.ValueKind == JsonValueKind.String) return img.GetString();
        if (img.ValueKind == JsonValueKind.Array)
        {
            var first = img.EnumerateArray().FirstOrDefault();
            if (first.ValueKind == JsonValueKind.String) return first.GetString();
            if (first.ValueKind == JsonValueKind.Object) return GetString(first, "url");
        }
        if (img.ValueKind == JsonValueKind.Object) return GetString(img, "url");
        return null;
    }

    private async Task<string?> TryDownloadImageAsync(string? imageUrl, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(imageUrl)) return null;
        try
        {
            using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
            var imageBytes = await httpClient.GetByteArrayAsync(imageUrl, cancellationToken);
            var blobPath = $"recipes/pending/{Guid.NewGuid()}.jpg";
            using var stream = new MemoryStream(imageBytes);
            return await _blobStorage.UploadAsync(stream, blobPath, "image/jpeg", cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch image from {ImageUrl}, continuing without image", imageUrl);
            return null;
        }
    }

    private static string? GetString(JsonElement el, string prop)
    {
        if (el.TryGetProperty(prop, out var val) && val.ValueKind == JsonValueKind.String)
            return val.GetString();
        return null;
    }

    private static int? ParseIsoDuration(string? iso)
    {
        // Parse ISO 8601 duration like PT30M, PT1H30M, P0D
        if (string.IsNullOrWhiteSpace(iso)) return null;
        iso = iso.ToUpperInvariant();
        if (!iso.StartsWith("PT") && !iso.StartsWith('P')) return null;

        int total = 0;
        var s = iso.TrimStart('P');
        // Skip 'T' separator
        s = s.Replace("T", "");
        int num = 0;
        foreach (var c in s)
        {
            if (char.IsDigit(c)) { num = num * 10 + (c - '0'); }
            else if (c == 'H') { total += num * 60; num = 0; }
            else if (c == 'M') { total += num; num = 0; }
            else if (c == 'S') { num = 0; } // ignore seconds
        }
        return total > 0 ? total : null;
    }

    /// <summary>
    /// Parses a raw ingredient string like "100 gram mel" into a StructuredIngredient.
    /// </summary>
    private static StructuredIngredient ParseIngredientString(string raw)
    {
        raw = raw.Trim();
        var parts = raw.Split(' ', 3, StringSplitOptions.RemoveEmptyEntries);

        if (parts.Length >= 2)
        {
            // Try to parse first token as a number (including fractions like "1/2")
            decimal? qty = TryParseQuantity(parts[0]);
            if (qty.HasValue)
            {
                if (parts.Length == 2)
                    return new StructuredIngredient { Quantity = qty, Unit = null, Name = parts[1] };

                // parts[1] might be unit, rest is name
                return new StructuredIngredient { Quantity = qty, Unit = parts[1], Name = parts[2] };
            }
        }

        return new StructuredIngredient { Quantity = null, Unit = null, Name = raw };
    }

    private static decimal? TryParseQuantity(string s)
    {
        if (decimal.TryParse(s, System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var d))
            return d;

        // Handle fractions like "1/2"
        var slash = s.IndexOf('/');
        if (slash > 0 && slash < s.Length - 1)
        {
            if (decimal.TryParse(s[..slash], out var num) && decimal.TryParse(s[(slash + 1)..], out var den) && den != 0)
                return num / den;
        }

        return null;
    }

    private static string? ExtractMainImageUrl(string html, Uri pageUri)
    {
        var doc = new HtmlDocument();
        doc.LoadHtml(html);

        // og:image is the most reliable signal for a page's primary image
        var ogImage = doc.DocumentNode.SelectSingleNode("//meta[@property='og:image']")
            ?? doc.DocumentNode.SelectSingleNode("//meta[@name='og:image']");
        if (ogImage != null)
        {
            var content = ogImage.GetAttributeValue("content", null);
            if (!string.IsNullOrWhiteSpace(content))
                return ToAbsoluteUrl(content, pageUri);
        }

        // twitter:image as fallback
        var twitterImage = doc.DocumentNode.SelectSingleNode("//meta[@name='twitter:image']")
            ?? doc.DocumentNode.SelectSingleNode("//meta[@property='twitter:image']");
        if (twitterImage != null)
        {
            var content = twitterImage.GetAttributeValue("content", null);
            if (!string.IsNullOrWhiteSpace(content))
                return ToAbsoluteUrl(content, pageUri);
        }

        return null;
    }

    private static string? ToAbsoluteUrl(string url, Uri baseUri)
    {
        if (Uri.TryCreate(url, UriKind.Absolute, out var abs)) return abs.ToString();
        if (Uri.TryCreate(baseUri, url, out var rel)) return rel.ToString();
        return null;
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
            if (trimmed.Length > 0)
                sb.AppendLine(trimmed);
        }

        var result = sb.ToString();
        return result.Length > MaxTextLength ? result[..MaxTextLength] : result;
    }
}
