using System.Text.Json;
using System.Text.Json.Serialization;

namespace RecipeApi.Features.Recipes;

/// <summary>
/// Response body from POST /v1/systemone.
/// </summary>
public sealed class JevResponse
{
    [JsonPropertyName("model")]
    public string? Model { get; set; }

    /// <summary>Question key -> answer. Keys match the ones sent in the request.</summary>
    [JsonPropertyName("answers")]
    public Dictionary<string, JevAnswer>? Answers { get; set; }

    [JsonPropertyName("usage")]
    public JevUsage? Usage { get; set; }
}

/// <summary>
/// One question's answer. <see cref="Choice"/> is the selected criterion key.
/// </summary>
public sealed class JevAnswer
{
    [JsonPropertyName("type")]
    public string? Type { get; set; }

    /// <summary>The selected criterion key, e.g. "cat_4". Null when the model selected nothing.</summary>
    [JsonPropertyName("choice")]
    public string? Choice { get; set; }

    [JsonPropertyName("confidence")]
    public double? Confidence { get; set; }

    [JsonPropertyName("probabilities")]
    public Dictionary<string, double>? Probabilities { get; set; }
}

/// <summary>Token accounting. Logged so cost per extraction stays visible.</summary>
public sealed class JevUsage
{
    [JsonPropertyName("input_tokens")]
    public int InputTokens { get; set; }

    [JsonPropertyName("output_tokens")]
    public int OutputTokens { get; set; }
}

/// <summary>
/// Turns a Jev response body into category ids.
/// </summary>
/// <remarks>
/// Every failure mode here degrades to "no suggestions" rather than an exception. Classification
/// is a convenience layered on extraction, so a surprising payload must never cost the user the
/// recipe they were saving.
/// </remarks>
public static class JevResponseParser
{
    /// <summary>
    /// Extracts the accepted category ids from a raw response body.
    /// </summary>
    /// <param name="json">The raw response body.</param>
    /// <param name="confidenceThreshold">
    /// Answers at or above this confidence are kept. An answer with no confidence field is
    /// discarded: an unscored suggestion cannot clear a threshold that exists precisely to keep
    /// weak guesses out of pre-ticked boxes.
    /// </param>
    /// <param name="logger">Optional; records why answers were dropped.</param>
    /// <returns>Accepted ids, in question order. Empty when nothing qualifies or parsing fails.</returns>
    public static IReadOnlyList<int> ParseCategoryIds(
        string? json,
        double confidenceThreshold,
        ILogger? logger = null)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            logger?.LogWarning("Jev returned an empty response body; no category suggestions.");
            return Array.Empty<int>();
        }

        JevResponse? response;
        try
        {
            response = JsonSerializer.Deserialize<JevResponse>(json);
        }
        catch (JsonException ex)
        {
            logger?.LogWarning(ex, "Could not parse the Jev response; no category suggestions.");
            return Array.Empty<int>();
        }

        return ParseCategoryIds(response, confidenceThreshold, logger);
    }

    /// <summary>
    /// Extracts the accepted category ids from an already-deserialized response.
    /// </summary>
    public static IReadOnlyList<int> ParseCategoryIds(
        JevResponse? response,
        double confidenceThreshold,
        ILogger? logger = null)
    {
        if (response?.Answers is not { Count: > 0 } answers)
        {
            logger?.LogInformation("Jev returned no answers; no category suggestions.");
            return Array.Empty<int>();
        }

        var ids = new List<int>(answers.Count);

        foreach (var (questionKey, answer) in answers)
        {
            if (answer is null)
            {
                continue;
            }

            // No choice means the model declined to pick from the group -- a legitimate answer,
            // not a failure, so it is left out quietly.
            if (string.IsNullOrWhiteSpace(answer.Choice))
            {
                continue;
            }

            if (!JevRequestBuilder.TryParseCategoryId(answer.Choice, out var id))
            {
                logger?.LogWarning(
                    "Jev answered question {QuestionKey} with an unrecognized choice {Choice}; ignoring it.",
                    questionKey,
                    answer.Choice);
                continue;
            }

            if (answer.Confidence is not { } confidence)
            {
                logger?.LogWarning(
                    "Jev answered question {QuestionKey} without a confidence score; ignoring it.",
                    questionKey);
                continue;
            }

            if (confidence < confidenceThreshold)
            {
                logger?.LogInformation(
                    "Discarding Jev suggestion for {QuestionKey}: confidence {Confidence} is below the threshold {Threshold}.",
                    questionKey,
                    confidence,
                    confidenceThreshold);
                continue;
            }

            // The same id can only arrive twice if two questions shared a criterion, which the
            // request builder prevents; guard anyway so a server-side surprise cannot produce
            // duplicate suggestions.
            if (!ids.Contains(id))
            {
                ids.Add(id);
            }
        }

        return ids;
    }
}
