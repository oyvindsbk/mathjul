using RecipeApi.Features.Recipes;
using Xunit;

namespace RecipeApi.Tests.Recipes;

/// <summary>
/// Covers parsing of JSON-LD recipeIngredient strings during URL import, including the
/// Norwegian decimal comma used by sites like matprat.no ("0,5 dl").
/// </summary>
public class RecipeUrlIngredientParsingTests
{
    [Theory]
    [InlineData("0,5 dl hvitvinseddik", 0.5, "dl", "hvitvinseddik")]
    [InlineData("0,25 ts pepper", 0.25, "ts", "pepper")]
    [InlineData("1,5 kg poteter", 1.5, "kg", "poteter")]
    [InlineData("0.5 dl melk", 0.5, "dl", "melk")]
    [InlineData("300 g smør", 300, "g", "smør")]
    [InlineData("1/2 ts salt", 0.5, "ts", "salt")]
    public void ParseIngredientString_ParsesQuantityUnitAndName(
        string raw, double expectedQuantity, string expectedUnit, string expectedName)
    {
        var result = RecipeUrlProcessor.ParseIngredientString(raw);

        Assert.Equal((decimal)expectedQuantity, result.Quantity);
        Assert.Equal(expectedUnit, result.Unit);
        Assert.Equal(expectedName, result.Name);
    }

    [Fact]
    public void ParseIngredientString_TrimsLeadingWhitespace()
    {
        var result = RecipeUrlProcessor.ParseIngredientString(" 0,5 ts salt");

        Assert.Equal(0.5m, result.Quantity);
        Assert.Equal("ts", result.Unit);
        Assert.Equal("salt", result.Name);
    }

    [Fact]
    public void ParseIngredientString_WithoutLeadingQuantity_KeepsWholeStringAsName()
    {
        var result = RecipeUrlProcessor.ParseIngredientString("eventuelt saft av 0,25 stk. sitron");

        Assert.Null(result.Quantity);
        Assert.Null(result.Unit);
        Assert.Equal("eventuelt saft av 0,25 stk. sitron", result.Name);
    }
}
