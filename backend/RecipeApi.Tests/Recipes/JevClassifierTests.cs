using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;
using RecipeApi.Features.Recipes;
using Xunit;

namespace RecipeApi.Tests.Recipes;

/// <summary>
/// Covers the HTTP layer of Jev classification: request shape, and the rule that every failure
/// degrades to "no suggestions" instead of breaking an extraction that would otherwise succeed.
/// </summary>
public class JevClassifierTests
{
    private const string RecipeText = "Pannekaker med mel, egg og melk. Stek i panne.";

    private static readonly CategoryOption[] Categories =
    [
        new(3, "Frokost", "Måltidstype"),
        new(4, "Middag", "Måltidstype"),
        new(9, "Enkel", "Vanskelighetsgrad"),
        new(10, "Avansert", "Vanskelighetsgrad")
    ];

    /// <summary>
    /// Builds a classifier whose HTTP calls are served by <paramref name="respond"/>, capturing
    /// the outgoing request for assertions.
    /// </summary>
    private static (JevClassifier Classifier, List<HttpRequestMessage> Requests, List<string> Bodies) CreateClassifier(
        Func<HttpRequestMessage, HttpResponseMessage> respond,
        JevOptions? options = null)
    {
        var requests = new List<HttpRequestMessage>();
        var bodies = new List<string>();

        var handler = new Mock<HttpMessageHandler>(MockBehavior.Strict);
        handler.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .Returns(async (HttpRequestMessage request, CancellationToken _) =>
            {
                requests.Add(request);
                bodies.Add(request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync());
                return respond(request);
            });

        var factory = new Mock<IHttpClientFactory>();
        factory.Setup(f => f.CreateClient(It.IsAny<string>()))
            .Returns(() => new HttpClient(handler.Object));

        options ??= new JevOptions { ApiKey = "test-key" };

        var classifier = new JevClassifier(
            factory.Object,
            Options.Create(options),
            NullLogger<JevClassifier>.Instance);

        return (classifier, requests, bodies);
    }

    private static HttpResponseMessage Json(HttpStatusCode status, string body) =>
        new(status) { Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json") };

    // ── Happy path ─────────────────────────────────────────────────────────

    [Fact]
    public async Task SuggestCategoryIdsAsync_ReturnsIdsFromResponse()
    {
        const string body = """
        {
          "answers": {
            "gruppe_maaltidstype": { "choice": "cat_4", "confidence": 0.9 },
            "gruppe_vanskelighetsgrad": { "choice": "cat_9", "confidence": 0.8 }
          }
        }
        """;

        var (classifier, _, _) = CreateClassifier(_ => Json(HttpStatusCode.OK, body));

        var ids = await classifier.SuggestCategoryIdsAsync(RecipeText, Categories);

        Assert.Equal(2, ids.Count);
        Assert.Contains(4, ids);
        Assert.Contains(9, ids);
    }

    [Fact]
    public async Task SuggestCategoryIdsAsync_SendsBearerTokenAndRecipeText()
    {
        var (classifier, requests, bodies) = CreateClassifier(
            _ => Json(HttpStatusCode.OK, """{ "answers": {} }"""));

        await classifier.SuggestCategoryIdsAsync(RecipeText, Categories);

        var request = Assert.Single(requests);
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal("Bearer", request.Headers.Authorization?.Scheme);
        Assert.Equal("test-key", request.Headers.Authorization?.Parameter);

        var body = Assert.Single(bodies);
        Assert.Contains("Pannekaker", body);
        Assert.Contains("cat_4", body);
        Assert.Contains("\"choice\"", body);
    }

    [Fact]
    public async Task SuggestCategoryIdsAsync_PostsToConfiguredEndpoint()
    {
        var options = new JevOptions { ApiKey = "k", Endpoint = "https://example.test/v1/systemone" };
        var (classifier, requests, _) = CreateClassifier(
            _ => Json(HttpStatusCode.OK, """{ "answers": {} }"""), options);

        await classifier.SuggestCategoryIdsAsync(RecipeText, Categories);

        Assert.Equal("https://example.test/v1/systemone", requests[0].RequestUri?.ToString());
    }

    // ── Nothing worth asking ───────────────────────────────────────────────

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task SuggestCategoryIdsAsync_WithoutRecipeText_MakesNoCall(string text)
    {
        var (classifier, requests, _) = CreateClassifier(
            _ => throw new InvalidOperationException("should not be called"));

        Assert.Empty(await classifier.SuggestCategoryIdsAsync(text, Categories));
        Assert.Empty(requests);
    }

    [Fact]
    public async Task SuggestCategoryIdsAsync_WithNoCategories_MakesNoCall()
    {
        var (classifier, requests, _) = CreateClassifier(
            _ => throw new InvalidOperationException("should not be called"));

        Assert.Empty(await classifier.SuggestCategoryIdsAsync(RecipeText, []));
        Assert.Empty(requests);
    }

    /// <summary>
    /// Every group has a single option, so no question survives the builder and there is
    /// nothing to ask Jev about.
    /// </summary>
    [Fact]
    public async Task SuggestCategoryIdsAsync_WithNoQualifyingGroup_MakesNoCall()
    {
        var (classifier, requests, _) = CreateClassifier(
            _ => throw new InvalidOperationException("should not be called"));

        var ids = await classifier.SuggestCategoryIdsAsync(
            RecipeText,
            [new CategoryOption(17, "Kake", "Kaketype")]);

        Assert.Empty(ids);
        Assert.Empty(requests);
    }

    // ── Failure degrades, never throws ─────────────────────────────────────

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.TooManyRequests)]
    [InlineData(HttpStatusCode.BadRequest)]
    [InlineData(HttpStatusCode.InternalServerError)]
    public async Task SuggestCategoryIdsAsync_WithErrorStatus_ReturnsEmpty(HttpStatusCode status)
    {
        var (classifier, _, _) = CreateClassifier(_ => Json(status, """{ "error": "nope" }"""));

        Assert.Empty(await classifier.SuggestCategoryIdsAsync(RecipeText, Categories));
    }

    [Fact]
    public async Task SuggestCategoryIdsAsync_WhenUnreachable_ReturnsEmpty()
    {
        var (classifier, _, _) = CreateClassifier(
            _ => throw new HttpRequestException("connection refused"));

        Assert.Empty(await classifier.SuggestCategoryIdsAsync(RecipeText, Categories));
    }

    /// <summary>
    /// HttpClient reports its own timeout as a cancellation with no caller token set. That must
    /// degrade like any other Jev failure rather than surfacing to the user.
    /// </summary>
    [Fact]
    public async Task SuggestCategoryIdsAsync_OnTimeout_ReturnsEmpty()
    {
        var (classifier, _, _) = CreateClassifier(
            _ => throw new TaskCanceledException("timed out"));

        Assert.Empty(await classifier.SuggestCategoryIdsAsync(RecipeText, Categories));
    }

    [Fact]
    public async Task SuggestCategoryIdsAsync_WithMalformedBody_ReturnsEmpty()
    {
        var (classifier, _, _) = CreateClassifier(
            _ => Json(HttpStatusCode.OK, "not json at all"));

        Assert.Empty(await classifier.SuggestCategoryIdsAsync(RecipeText, Categories));
    }

    /// <summary>
    /// A caller who cancels is not a Jev failure, so the cancellation propagates instead of
    /// being swallowed into an empty result.
    /// </summary>
    [Fact]
    public async Task SuggestCategoryIdsAsync_WhenCallerCancels_Throws()
    {
        using var cts = new CancellationTokenSource();
        var (classifier, _, _) = CreateClassifier(_ =>
        {
            cts.Cancel();
            throw new TaskCanceledException("cancelled");
        });

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => classifier.SuggestCategoryIdsAsync(RecipeText, Categories, cts.Token));
    }

    // ── Enabled flag ───────────────────────────────────────────────────────

    /// <summary>
    /// Drives whether the text model is still asked to classify. If this ever reported true
    /// without a usable key, the category list would be dropped from the prompt and nothing
    /// would fill the gap.
    /// </summary>
    [Theory]
    [InlineData("a-key", true)]
    [InlineData(null, false)]
    [InlineData("", false)]
    [InlineData("   ", false)]
    public void IsEnabled_ReflectsWhetherAnApiKeyIsConfigured(string? apiKey, bool expected)
    {
        var (classifier, _, _) = CreateClassifier(
            _ => throw new InvalidOperationException("should not be called"),
            new JevOptions { ApiKey = apiKey });

        Assert.Equal(expected, classifier.IsEnabled);
    }

    // ── Threshold plumbing ─────────────────────────────────────────────────

    [Fact]
    public async Task SuggestCategoryIdsAsync_AppliesConfiguredThreshold()
    {
        const string body = """
        { "answers": { "g": { "choice": "cat_4", "confidence": 0.5 } } }
        """;

        var strict = new JevOptions { ApiKey = "k", ConfidenceThreshold = 0.9 };
        var (strictClassifier, _, _) = CreateClassifier(_ => Json(HttpStatusCode.OK, body), strict);
        Assert.Empty(await strictClassifier.SuggestCategoryIdsAsync(RecipeText, Categories));

        var lenient = new JevOptions { ApiKey = "k", ConfidenceThreshold = 0.4 };
        var (lenientClassifier, _, _) = CreateClassifier(_ => Json(HttpStatusCode.OK, body), lenient);
        Assert.Equal([4], await lenientClassifier.SuggestCategoryIdsAsync(RecipeText, Categories));
    }
}
