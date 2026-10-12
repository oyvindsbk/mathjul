using RecipeApi.Features.Stock;
using Xunit;

namespace RecipeApi.Tests.Stock;

public class IngredientMatcherTests
{
    private static StockItem Item(string name, bool staple = false) => new()
    {
        Name = name,
        NormalizedName = IngredientMatcher.Normalize(name),
        IsStaple = staple,
    };

    // ── Normalize ──────────────────────────────────────────────────────────

    [Theory]
    [InlineData("Løk", "løk")]
    [InlineData("  Melk  ", "melk")]
    [InlineData("Smør (usaltet)", "smør")]
    [InlineData("løk, finhakket", "løk")]
    [InlineData("Revet ost", "ost")]
    [InlineData("fersk basilikum", "basilikum")]
    [InlineData("frossen spinat", "spinat")]
    [InlineData("hvitløk-fedd", "hvitløk fedd")]
    [InlineData("rød   paprika", "rød paprika")]
    [InlineData("Æbleeddik", "æbleeddik")]
    [InlineData("kokt", "kokt")]
    [InlineData("", "")]
    [InlineData(null, "")]
    [InlineData("   ", "")]
    public void Normalize_CleansTheName(string? input, string expected) =>
        Assert.Equal(expected, IngredientMatcher.Normalize(input));

    [Fact]
    public void Normalize_OnlyStripsPreparationWordWhenItIsTheFirstWord() =>
        Assert.Equal("ost revet", IngredientMatcher.Normalize("ost revet"));

    // ── Match: exact ───────────────────────────────────────────────────────

    [Fact]
    public void Match_ExactName_IsHave()
    {
        var milk = Item("Melk");
        var result = IngredientMatcher.Match("melk", [Item("Egg"), milk]);

        Assert.Equal(IngredientMatchStatus.Have, result.Status);
        Assert.Same(milk, result.Item);
    }

    [Fact]
    public void Match_ExactAfterNormalization_IsHave()
    {
        var result = IngredientMatcher.Match("Revet ost (parmesan)", [Item("ost")]);

        Assert.Equal(IngredientMatchStatus.Have, result.Status);
    }

    [Fact]
    public void Match_ExactBeatsEarlierPartial()
    {
        var exact = Item("melk");
        var result = IngredientMatcher.Match("melk", [Item("lettmelk"), exact]);

        Assert.Equal(IngredientMatchStatus.Have, result.Status);
        Assert.Same(exact, result.Item);
    }

    // ── Match: partial ─────────────────────────────────────────────────────

    [Fact]
    public void Match_IngredientHasExtraWord_IsMaybe()
    {
        var result = IngredientMatcher.Match("rød paprika", [Item("paprika")]);

        Assert.Equal(IngredientMatchStatus.Maybe, result.Status);
    }

    [Fact]
    public void Match_StockHasExtraWord_IsMaybe()
    {
        var result = IngredientMatcher.Match("paprika", [Item("rød paprika")]);

        Assert.Equal(IngredientMatchStatus.Maybe, result.Status);
    }

    [Fact]
    public void Match_CompoundWordPrefix_IsMaybe()
    {
        var result = IngredientMatcher.Match("kylling", [Item("kyllingfilet")]);

        Assert.Equal(IngredientMatchStatus.Maybe, result.Status);
    }

    [Fact]
    public void Match_CompoundWordSuffix_IsMaybe()
    {
        var result = IngredientMatcher.Match("melk", [Item("lettmelk")]);

        Assert.Equal(IngredientMatchStatus.Maybe, result.Status);
    }

    [Fact]
    public void Match_CompoundWordInIngredient_IsMaybe()
    {
        var result = IngredientMatcher.Match("kyllingfilet", [Item("kylling")]);

        Assert.Equal(IngredientMatchStatus.Maybe, result.Status);
    }

    [Fact]
    public void Match_ShortNameInsideCompound_IsMissing()
    {
        // "ris" is below the compound length limit, so it must not match "kapris".
        var result = IngredientMatcher.Match("ris", [Item("kapris")]);

        Assert.Equal(IngredientMatchStatus.Missing, result.Status);
        Assert.Null(result.Item);
    }

    [Fact]
    public void Match_ShortWholeWord_StillMatches()
    {
        // The length limit only applies to compounds; "ris" is a whole word here.
        var result = IngredientMatcher.Match("ris", [Item("brun ris")]);

        Assert.Equal(IngredientMatchStatus.Maybe, result.Status);
    }

    [Fact]
    public void Match_CompoundLengthBoundary()
    {
        Assert.Equal(IngredientMatchStatus.Maybe,
            IngredientMatcher.Match("melk", [Item("kokosmelk")]).Status);
        Assert.Equal(IngredientMatchStatus.Missing,
            IngredientMatcher.Match("ost", [Item("kostbar")]).Status);
    }

    [Fact]
    public void Match_UnrelatedNames_IsMissing()
    {
        var result = IngredientMatcher.Match("melk", [Item("egg"), Item("smør")]);

        Assert.Equal(IngredientMatchStatus.Missing, result.Status);
    }

    // ── Match: staples ─────────────────────────────────────────────────────

    [Fact]
    public void Match_StapleExact_IsHave()
    {
        var salt = Item("salt", staple: true);
        var result = IngredientMatcher.Match("salt", [salt]);

        Assert.Equal(IngredientMatchStatus.Have, result.Status);
        Assert.Same(salt, result.Item);
    }

    [Fact]
    public void Match_StaplePartial_IsHaveNotMaybe()
    {
        var result = IngredientMatcher.Match("havsalt", [Item("salt", staple: true)]);

        Assert.Equal(IngredientMatchStatus.Have, result.Status);
    }

    [Fact]
    public void Match_NonStaplePartial_IsMaybe()
    {
        var result = IngredientMatcher.Match("havsalt", [Item("salt")]);

        Assert.Equal(IngredientMatchStatus.Maybe, result.Status);
    }

    [Fact]
    public void Match_StapleWinsOverNonStaplePartial()
    {
        var result = IngredientMatcher.Match("havsalt", [Item("salt"), Item("salt", staple: true)]);

        Assert.Equal(IngredientMatchStatus.Have, result.Status);
        Assert.True(result.Item!.IsStaple);
    }

    // ── Match: edge cases ──────────────────────────────────────────────────

    [Fact]
    public void Match_EmptyStock_IsMissing()
    {
        var result = IngredientMatcher.Match("melk", []);

        Assert.Equal(IngredientMatchStatus.Missing, result.Status);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("(valgfritt)")]
    public void Match_BlankIngredient_IsMissing(string ingredient)
    {
        var result = IngredientMatcher.Match(ingredient, [Item("melk")]);

        Assert.Equal(IngredientMatchStatus.Missing, result.Status);
    }

    [Fact]
    public void Match_StockWithoutNormalizedName_FallsBackToName()
    {
        var item = new StockItem { Name = "Melk" };
        var result = IngredientMatcher.Match("melk", [item]);

        Assert.Equal(IngredientMatchStatus.Have, result.Status);
    }

    [Theory]
    [InlineData(IngredientMatchStatus.Have, "har")]
    [InlineData(IngredientMatchStatus.Maybe, "kanskje")]
    [InlineData(IngredientMatchStatus.Missing, "mangler")]
    public void ToApiString_UsesNorwegianWireValues(IngredientMatchStatus status, string expected) =>
        Assert.Equal(expected, status.ToApiString());
}
