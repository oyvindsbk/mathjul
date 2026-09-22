using RecipeApi.Features.Recipes;
using Xunit;

namespace RecipeApi.Tests.Recipes;

/// <summary>
/// Covers the adapters between the extraction pipeline and the Jev classifier: reading the
/// controller's category list JSON, and flattening an extracted recipe into classifiable text.
/// </summary>
public class JevClassificationInputTests
{
    // ── Category list parsing ──────────────────────────────────────────────

    /// <summary>
    /// The shape here mirrors what RecipesController.BuildCategoryListJsonAsync serializes.
    /// </summary>
    [Fact]
    public void ParseCategoryList_ReadsTheControllersJsonShape()
    {
        const string json = """
        [
          { "Id": 3, "Name": "Frokost", "Group": "Måltidstype" },
          { "Id": 9, "Name": "Enkel", "Group": "Vanskelighetsgrad" }
        ]
        """;

        var options = JevClassificationInput.ParseCategoryList(json);

        Assert.Equal(2, options.Count);
        Assert.Equal(new CategoryOption(3, "Frokost", "Måltidstype"), options[0]);
        Assert.Equal(new CategoryOption(9, "Enkel", "Vanskelighetsgrad"), options[1]);
    }

    [Fact]
    public void ParseCategoryList_AcceptsCamelCaseProperties()
    {
        const string json = """[{ "id": 4, "name": "Middag", "group": "Måltidstype" }]""";

        var option = Assert.Single(JevClassificationInput.ParseCategoryList(json));

        Assert.Equal(new CategoryOption(4, "Middag", "Måltidstype"), option);
    }

    [Fact]
    public void ParseCategoryList_SkipsRowsMissingNameOrGroup()
    {
        const string json = """
        [
          { "Id": 3, "Name": "Frokost", "Group": "Måltidstype" },
          { "Id": 4, "Group": "Måltidstype" },
          { "Id": 5, "Name": "Uten gruppe" }
        ]
        """;

        Assert.Single(JevClassificationInput.ParseCategoryList(json));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("[]")]
    [InlineData("null")]
    [InlineData("not json")]
    [InlineData("{ \"not\": \"an array\" }")]
    public void ParseCategoryList_WithUnusableJson_ReturnsEmpty(string? json)
    {
        Assert.Empty(JevClassificationInput.ParseCategoryList(json));
    }

    // ── Recipe text ────────────────────────────────────────────────────────

    [Fact]
    public void BuildRecipeText_IncludesTitleDescriptionIngredientsAndSteps()
    {
        var recipe = new ExtractedRecipeDto
        {
            Title = "Pannekaker",
            Description = "Tynne og myke",
            Ingredients =
            [
                new StructuredIngredient { Name = "hvetemel" },
                new StructuredIngredient { Name = "egg" }
            ],
            Instructions = ["Bland alt.", "Stek i panne."]
        };

        var text = JevClassificationInput.BuildRecipeText(recipe);

        Assert.Contains("Pannekaker", text);
        Assert.Contains("Tynne og myke", text);
        Assert.Contains("hvetemel", text);
        Assert.Contains("egg", text);
        Assert.Contains("Stek i panne.", text);
    }

    /// <summary>
    /// A sectioned recipe keeps its ingredients and steps in the section lists rather than the
    /// flat ones, so both sources have to be read or the signal disappears entirely.
    /// </summary>
    [Fact]
    public void BuildRecipeText_IncludesSectionedIngredientsAndSteps()
    {
        var recipe = new ExtractedRecipeDto
        {
            Title = "Lasagne",
            IngredientSections =
            [
                new ExtractedIngredientSectionDto
                {
                    Heading = "Saus",
                    Ingredients = [new StructuredIngredient { Name = "tomat" }]
                }
            ],
            InstructionSections =
            [
                new ExtractedInstructionSectionDto
                {
                    Heading = "Steking",
                    Steps = ["Stek i ovn."]
                }
            ]
        };

        var text = JevClassificationInput.BuildRecipeText(recipe);

        Assert.Contains("tomat", text);
        Assert.Contains("Stek i ovn.", text);
    }

    [Fact]
    public void BuildRecipeText_TruncatesVeryLongRecipes()
    {
        var recipe = new ExtractedRecipeDto
        {
            Title = "Lang oppskrift",
            Instructions = [new string('a', 10_000)]
        };

        Assert.Equal(4000, JevClassificationInput.BuildRecipeText(recipe).Length);
    }

    [Fact]
    public void BuildRecipeText_WithOnlyTitle_ReturnsTitle()
    {
        var recipe = new ExtractedRecipeDto { Title = "Bare tittel" };

        Assert.Equal("Bare tittel", JevClassificationInput.BuildRecipeText(recipe));
    }
}
