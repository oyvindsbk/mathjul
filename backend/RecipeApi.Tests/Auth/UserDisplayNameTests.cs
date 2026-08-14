using RecipeApi.Features.Auth;
using Xunit;

namespace RecipeApi.Tests.Auth;

/// <summary>
/// Covers the fallback order used whenever a user is shown to someone else:
/// Nickname → Name → DisplayName → Email.
/// </summary>
public class UserDisplayNameTests
{
    private const string Email = "owner@example.com";

    [Fact]
    public void Nickname_WinsOverEverythingElse()
    {
        var result = UserDisplayName.Resolve("Nick", "Full Name", "Display", Email);

        Assert.Equal("Nick", result);
    }

    [Fact]
    public void Name_UsedWhenNicknameMissing()
    {
        var result = UserDisplayName.Resolve(null, "Full Name", "Display", Email);

        Assert.Equal("Full Name", result);
    }

    [Fact]
    public void DisplayName_UsedWhenNicknameAndNameMissing()
    {
        var result = UserDisplayName.Resolve(null, null, "Display", Email);

        Assert.Equal("Display", result);
    }

    [Fact]
    public void LastResort_IsTheLocalPartNeverTheFullAddress()
    {
        var result = UserDisplayName.Resolve(null, null, null, Email);

        // These endpoints are readable by any signed-in user, so the fallback must
        // not hand out a usable address.
        Assert.Equal("owner", result);
        Assert.DoesNotContain("@", result);
    }

    [Fact]
    public void MalformedEmailWithNoLocalPart_FallsBackToALabel()
    {
        var result = UserDisplayName.Resolve(null, null, null, "@example.com");

        Assert.Equal("Ukjent bruker", result);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void BlankValues_AreSkippedLikeMissingOnes(string blank)
    {
        // A user who clears their nickname leaves an empty string rather than null,
        // so whitespace must not win over the name behind it.
        var result = UserDisplayName.Resolve(blank, "Full Name", "Display", Email);

        Assert.Equal("Full Name", result);
    }

    [Fact]
    public void SurroundingWhitespace_IsTrimmed()
    {
        var result = UserDisplayName.Resolve("  Nick  ", null, null, Email);

        Assert.Equal("Nick", result);
    }

    [Fact]
    public void UserOverload_FollowsTheSameOrder()
    {
        var user = new User
        {
            Email = Email,
            DisplayName = "Display",
            Name = "Full Name",
            Nickname = null
        };

        Assert.Equal("Full Name", UserDisplayName.Resolve(user));
    }
}
