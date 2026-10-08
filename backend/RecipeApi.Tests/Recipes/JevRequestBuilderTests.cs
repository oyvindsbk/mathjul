using RecipeApi.Features.Recipes;
using Xunit;

namespace RecipeApi.Tests.Recipes;

/// <summary>
/// Covers the request-building rules for Jev classification: one Choice question per category
/// group, category ids encoded into criteria keys, and question keys reduced to safe
/// identifiers without losing a group to a collision.
/// </summary>
public class JevRequestBuilderTests
{
    private static CategoryOption Option(int id, string name, string group) => new(id, name, group);

    // ── Grouping ───────────────────────────────────────────────────────────

    [Fact]
    public void BuildQuestions_GroupsCategoriesIntoOneQuestionPerGroup()
    {
        var questions = JevRequestBuilder.BuildQuestions(
        [
            Option(3, "Frokost", "Måltidstype"),
            Option(4, "Middag", "Måltidstype"),
            Option(9, "Enkel", "Vanskelighetsgrad"),
            Option(10, "Middels", "Vanskelighetsgrad"),
            Option(11, "Avansert", "Vanskelighetsgrad")
        ]);

        Assert.Equal(2, questions.Count);
        Assert.Equal(2, questions["gruppe_maaltidstype"].Criteria.Count);
        Assert.Equal(3, questions["gruppe_vanskelighetsgrad"].Criteria.Count);
    }

    [Fact]
    public void BuildQuestions_EncodesCategoryIdsAsCriteriaKeys()
    {
        var questions = JevRequestBuilder.BuildQuestions(
        [
            Option(3, "Frokost", "Måltidstype"),
            Option(4, "Middag", "Måltidstype")
        ]);

        var criteria = questions["gruppe_maaltidstype"].Criteria;

        Assert.Equal("Frokost", criteria["cat_3"]);
        Assert.Equal("Middag", criteria["cat_4"]);
    }

    [Fact]
    public void BuildQuestions_DescribesTilbehorInsteadOfSendingBareName()
    {
        var questions = JevRequestBuilder.BuildQuestions(
        [
            Option(3, "Middag", "Måltidstype"),
            Option(RecipeCategories.TilbehorId, RecipeCategories.TilbehorName, "Måltidstype")
        ]);

        var criteria = questions["gruppe_maaltidstype"].Criteria;
        Assert.Equal("Middag", criteria[JevRequestBuilder.CriterionKey(3)]);
        Assert.Equal(
            RecipeCategories.TilbehorClassifierDescription,
            criteria[JevRequestBuilder.CriterionKey(RecipeCategories.TilbehorId)]);
    }

    [Fact]
    public void BuildQuestions_MarksEveryQuestionAsChoice()
    {
        var questions = JevRequestBuilder.BuildQuestions(
        [
            Option(3, "Frokost", "Måltidstype"),
            Option(4, "Middag", "Måltidstype")
        ]);

        Assert.All(questions.Values, q => Assert.Equal("choice", q.Type));
        Assert.All(questions.Values, q => Assert.False(string.IsNullOrWhiteSpace(q.Instructions)));
    }

    /// <summary>
    /// A Choice over one option can only answer with that option, so the "suggestion" would
    /// carry no information from the model at all.
    /// </summary>
    [Fact]
    public void BuildQuestions_SkipsGroupWithSingleOption()
    {
        var questions = JevRequestBuilder.BuildQuestions(
        [
            Option(17, "Kake", "Kaketype"),
            Option(3, "Frokost", "Måltidstype"),
            Option(4, "Middag", "Måltidstype")
        ]);

        Assert.Single(questions);
        Assert.True(questions.ContainsKey("gruppe_maaltidstype"));
    }

    [Fact]
    public void BuildQuestions_DropsDuplicateIdsWithinGroup()
    {
        var questions = JevRequestBuilder.BuildQuestions(
        [
            Option(3, "Frokost", "Måltidstype"),
            Option(3, "Frokost (duplikat)", "Måltidstype"),
            Option(4, "Middag", "Måltidstype")
        ]);

        var criteria = questions["gruppe_maaltidstype"].Criteria;

        Assert.Equal(2, criteria.Count);
        Assert.Equal("Frokost", criteria["cat_3"]);
    }

    [Fact]
    public void BuildQuestions_IgnoresRowsWithMissingNameOrGroup()
    {
        var questions = JevRequestBuilder.BuildQuestions(
        [
            Option(3, "Frokost", "Måltidstype"),
            Option(4, "Middag", "Måltidstype"),
            Option(5, "", "Måltidstype"),
            Option(6, "Uten gruppe", "  ")
        ]);

        Assert.Single(questions);
        Assert.Equal(2, questions["gruppe_maaltidstype"].Criteria.Count);
    }

    // ── Key sanitization ───────────────────────────────────────────────────

    [Theory]
    [InlineData("Måltidstype", "gruppe_maaltidstype")]
    [InlineData("Vanskelighetsgrad", "gruppe_vanskelighetsgrad")]
    [InlineData("Årstid", "gruppe_aarstid")]
    [InlineData("Øl og drikke", "gruppe_ol_og_drikke")]
    [InlineData("Ærlig mat", "gruppe_aerlig_mat")]
    [InlineData("Type/stil", "gruppe_type_stil")]
    public void BuildQuestions_SanitizesGroupNameIntoKey(string group, string expectedKey)
    {
        var questions = JevRequestBuilder.BuildQuestions(
        [
            Option(1, "A", group),
            Option(2, "B", group)
        ]);

        Assert.True(questions.ContainsKey(expectedKey));
    }

    /// <summary>
    /// Sanitizing is lossy, so distinct group names can reduce to the same key. Both questions
    /// must survive -- losing one would silently drop a whole group of suggestions.
    /// </summary>
    [Fact]
    public void BuildQuestions_DisambiguatesGroupsThatSanitizeToSameKey()
    {
        var questions = JevRequestBuilder.BuildQuestions(
        [
            Option(1, "A", "Type-stil"),
            Option(2, "B", "Type-stil"),
            Option(3, "C", "Type/stil"),
            Option(4, "D", "Type/stil")
        ]);

        Assert.Equal(2, questions.Count);
        Assert.True(questions.ContainsKey("gruppe_type_stil"));
        Assert.True(questions.ContainsKey("gruppe_type_stil_2"));
    }

    // ── Empty input ────────────────────────────────────────────────────────

    [Fact]
    public void BuildQuestions_WithNoCategories_ReturnsEmpty()
    {
        Assert.Empty(JevRequestBuilder.BuildQuestions([]));
    }

    // ── Criterion key round-trip ───────────────────────────────────────────

    [Fact]
    public void CriterionKey_RoundTripsThroughTryParseCategoryId()
    {
        Assert.True(JevRequestBuilder.TryParseCategoryId(JevRequestBuilder.CriterionKey(42), out var id));
        Assert.Equal(42, id);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("42")]
    [InlineData("cat_")]
    [InlineData("cat_abc")]
    [InlineData("category_42")]
    [InlineData("Cat_42")]
    public void TryParseCategoryId_WithUnrecognizedKey_ReturnsFalse(string? key)
    {
        Assert.False(JevRequestBuilder.TryParseCategoryId(key, out _));
    }
}
