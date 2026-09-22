using RecipeApi.Features.Recipes;
using Xunit;

namespace RecipeApi.Tests.Recipes;

/// <summary>
/// Covers response parsing for Jev classification: decoding choices back to category ids,
/// applying the confidence threshold, and degrading to an empty list for every malformed or
/// surprising payload rather than throwing.
/// </summary>
public class JevResponseParserTests
{
    private const double Threshold = 0.6;

    // ── Happy path ─────────────────────────────────────────────────────────

    [Fact]
    public void ParseCategoryIds_DecodesChoicesIntoCategoryIds()
    {
        const string json = """
        {
          "model": "jev-1.13.0",
          "answers": {
            "gruppe_maaltidstype": {
              "type": "choice", "choice": "cat_4", "confidence": 0.78,
              "probabilities": { "cat_4": 0.85, "cat_3": 0.15 }
            },
            "gruppe_vanskelighetsgrad": {
              "type": "choice", "choice": "cat_9", "confidence": 0.91
            }
          },
          "usage": { "input_tokens": 392, "output_tokens": 65 }
        }
        """;

        var ids = JevResponseParser.ParseCategoryIds(json, Threshold);

        Assert.Equal(2, ids.Count);
        Assert.Contains(4, ids);
        Assert.Contains(9, ids);
    }

    [Fact]
    public void ParseCategoryIds_IgnoresDuplicateIdsAcrossQuestions()
    {
        const string json = """
        {
          "answers": {
            "gruppe_en": { "choice": "cat_4", "confidence": 0.9 },
            "gruppe_to": { "choice": "cat_4", "confidence": 0.9 }
          }
        }
        """;

        Assert.Equal([4], JevResponseParser.ParseCategoryIds(json, Threshold));
    }

    // ── Confidence threshold ───────────────────────────────────────────────

    [Fact]
    public void ParseCategoryIds_KeepsAnswerExactlyAtThreshold()
    {
        const string json = """
        { "answers": { "g": { "choice": "cat_7", "confidence": 0.6 } } }
        """;

        Assert.Equal([7], JevResponseParser.ParseCategoryIds(json, Threshold));
    }

    [Fact]
    public void ParseCategoryIds_DiscardsAnswerJustBelowThreshold()
    {
        const string json = """
        { "answers": { "g": { "choice": "cat_7", "confidence": 0.59 } } }
        """;

        Assert.Empty(JevResponseParser.ParseCategoryIds(json, Threshold));
    }

    [Fact]
    public void ParseCategoryIds_KeepsOnlyAnswersAboveThreshold()
    {
        const string json = """
        {
          "answers": {
            "sikker": { "choice": "cat_4", "confidence": 0.95 },
            "usikker": { "choice": "cat_9", "confidence": 0.2 }
          }
        }
        """;

        Assert.Equal([4], JevResponseParser.ParseCategoryIds(json, Threshold));
    }

    /// <summary>
    /// An unscored suggestion cannot clear a threshold whose whole purpose is keeping weak
    /// guesses out of pre-ticked boxes, so it is dropped rather than treated as certain.
    /// </summary>
    [Fact]
    public void ParseCategoryIds_DiscardsAnswerWithoutConfidence()
    {
        const string json = """
        { "answers": { "g": { "choice": "cat_7" } } }
        """;

        Assert.Empty(JevResponseParser.ParseCategoryIds(json, Threshold));
    }

    // ── Choices that do not map ────────────────────────────────────────────

    [Fact]
    public void ParseCategoryIds_IgnoresUnrecognizedChoiceKey()
    {
        const string json = """
        {
          "answers": {
            "ukjent": { "choice": "something_else", "confidence": 0.99 },
            "gyldig": { "choice": "cat_4", "confidence": 0.8 }
          }
        }
        """;

        Assert.Equal([4], JevResponseParser.ParseCategoryIds(json, Threshold));
    }

    [Theory]
    [InlineData("null")]
    [InlineData("\"\"")]
    public void ParseCategoryIds_IgnoresAnswerWithNoChoice(string choiceJson)
    {
        var json = $$"""
        { "answers": { "g": { "choice": {{choiceJson}}, "confidence": 0.9 } } }
        """;

        Assert.Empty(JevResponseParser.ParseCategoryIds(json, Threshold));
    }

    // ── Malformed and empty payloads ───────────────────────────────────────

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not json at all")]
    [InlineData("{ \"answers\": ")]
    [InlineData("{ \"answers\": \"not an object\" }")]
    [InlineData("{ \"answers\": { \"g\": \"not an answer\" } }")]
    [InlineData("{ \"answers\": { \"g\": { \"confidence\": \"høy\" } } }")]
    [InlineData("null")]
    [InlineData("{}")]
    [InlineData("{ \"answers\": {} }")]
    [InlineData("{ \"answers\": null }")]
    public void ParseCategoryIds_WithUnusableBody_ReturnsEmptyWithoutThrowing(string? json)
    {
        Assert.Empty(JevResponseParser.ParseCategoryIds(json, Threshold));
    }

    [Fact]
    public void ParseCategoryIds_WithNullResponseObject_ReturnsEmpty()
    {
        Assert.Empty(JevResponseParser.ParseCategoryIds((JevResponse?)null, Threshold));
    }
}
