using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace RecipeApi.Features.Recipes;

/// <summary>
/// Classifies recipes with TypeSafe AI's Jev model over plain HTTP.
/// </summary>
/// <remarks>
/// Hand-rolled because TypeSafe ships no .NET SDK. Every failure path -- transport, timeout,
/// non-success status, malformed body -- is logged and converted to an empty result, so a recipe
/// stays savable when Jev is unreachable.
/// </remarks>
public class JevClassifier : IJevClassifier
{
    /// <summary>Named client, so the timeout and base configuration live in one place.</summary>
    public const string HttpClientName = "Jev";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly JevOptions _options;
    private readonly ILogger<JevClassifier> _logger;

    public JevClassifier(
        IHttpClientFactory httpClientFactory,
        IOptions<JevOptions> options,
        ILogger<JevClassifier> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<IReadOnlyList<int>> SuggestCategoryIdsAsync(
        string recipeText,
        IReadOnlyList<CategoryOption> categories,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(recipeText) || categories.Count == 0)
        {
            return Array.Empty<int>();
        }

        var questions = JevRequestBuilder.BuildQuestions(categories);
        if (questions.Count == 0)
        {
            _logger.LogInformation("No category group qualified for Jev classification.");
            return Array.Empty<int>();
        }

        var request = new JevRequest
        {
            State = recipeText,
            Model = _options.ModelName,
            Questions = questions
        };

        try
        {
            var client = _httpClientFactory.CreateClient(HttpClientName);
            client.Timeout = TimeSpan.FromSeconds(_options.TimeoutSeconds);

            using var httpRequest = new HttpRequestMessage(HttpMethod.Post, _options.Endpoint)
            {
                Content = JsonContent.Create(request)
            };
            httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);

            _logger.LogInformation(
                "Asking Jev to classify a recipe across {QuestionCount} category groups.",
                questions.Count);

            using var httpResponse = await client.SendAsync(httpRequest, cancellationToken);

            if (!httpResponse.IsSuccessStatusCode)
            {
                // The body often explains a rejection (state too long, too many criteria), and
                // it carries no secret, so it is worth logging in full.
                var error = await SafeReadBodyAsync(httpResponse, cancellationToken);
                _logger.LogWarning(
                    "Jev returned {StatusCode}; continuing without category suggestions. Body: {Body}",
                    (int)httpResponse.StatusCode,
                    error);
                return Array.Empty<int>();
            }

            var body = await httpResponse.Content.ReadAsStringAsync(cancellationToken);
            var ids = JevResponseParser.ParseCategoryIds(body, _options.ConfidenceThreshold, _logger);

            _logger.LogInformation(
                "Jev suggested {SuggestionCount} of {QuestionCount} categories at or above confidence {Threshold}.",
                ids.Count,
                questions.Count,
                _options.ConfidenceThreshold);

            return ids;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // The caller gave up, not Jev. Let the extraction pipeline handle it.
            throw;
        }
        catch (OperationCanceledException ex)
        {
            // HttpClient surfaces its own timeout as a cancellation with no token set.
            _logger.LogWarning(
                ex,
                "Jev did not answer within {Timeout}s; continuing without category suggestions.",
                _options.TimeoutSeconds);
            return Array.Empty<int>();
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Could not reach Jev; continuing without category suggestions.");
            return Array.Empty<int>();
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Could not serialize the Jev request; continuing without category suggestions.");
            return Array.Empty<int>();
        }
    }

    /// <summary>
    /// Reads an error body without letting a second failure mask the first.
    /// </summary>
    private static async Task<string> SafeReadBodyAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        try
        {
            return await response.Content.ReadAsStringAsync(cancellationToken);
        }
        catch (Exception)
        {
            return "<unreadable>";
        }
    }
}
