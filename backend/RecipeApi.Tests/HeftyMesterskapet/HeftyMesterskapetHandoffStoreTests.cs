using Microsoft.Extensions.Time.Testing;
using RecipeApi.Features.HeftyMesterskapet;
using Xunit;

namespace RecipeApi.Tests.HeftyMesterskapet;

/// <summary>
/// The handoff code is what keeps a week-long JWT out of redirect URLs, browser history, and
/// Referer headers. Its value depends entirely on two properties: it works once, and it dies fast.
/// </summary>
public sealed class HeftyMesterskapetHandoffStoreTests
{
    [Fact]
    public void A_freshly_issued_code_redeems_to_the_token()
    {
        var store = new HeftyMesterskapetHandoffStore();

        var code = store.Issue("the-jwt");

        Assert.Equal("the-jwt", store.Redeem(code));
    }

    [Fact]
    public void A_code_cannot_be_redeemed_twice()
    {
        // Single use is the point: a replayed code from a log or history must be worthless.
        var store = new HeftyMesterskapetHandoffStore();
        var code = store.Issue("the-jwt");

        Assert.Equal("the-jwt", store.Redeem(code));
        Assert.Null(store.Redeem(code));
    }

    [Fact]
    public void An_unknown_code_redeems_to_nothing()
    {
        var store = new HeftyMesterskapetHandoffStore();
        store.Issue("the-jwt");

        Assert.Null(store.Redeem("not-a-real-code"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void A_blank_code_redeems_to_nothing(string code)
    {
        var store = new HeftyMesterskapetHandoffStore();
        store.Issue("the-jwt");

        Assert.Null(store.Redeem(code));
    }

    [Fact]
    public void A_code_expires()
    {
        var time = new FakeTimeProvider();
        var store = new HeftyMesterskapetHandoffStore(time);
        var code = store.Issue("the-jwt");

        time.Advance(TimeSpan.FromMinutes(2));

        Assert.Null(store.Redeem(code));
    }

    [Fact]
    public void A_code_still_works_just_before_it_expires()
    {
        var time = new FakeTimeProvider();
        var store = new HeftyMesterskapetHandoffStore(time);
        var code = store.Issue("the-jwt");

        time.Advance(TimeSpan.FromSeconds(30));

        Assert.Equal("the-jwt", store.Redeem(code));
    }

    [Fact]
    public void Codes_are_unique_per_issue()
    {
        var store = new HeftyMesterskapetHandoffStore();

        var codes = Enumerable.Range(0, 50).Select(_ => store.Issue("the-jwt")).ToHashSet();

        Assert.Equal(50, codes.Count);
    }

    [Fact]
    public void Issuing_a_second_code_does_not_invalidate_the_first()
    {
        // Two scorekeepers can be mid-login at the same time.
        var store = new HeftyMesterskapetHandoffStore();
        var first = store.Issue("first-jwt");
        var second = store.Issue("second-jwt");

        Assert.Equal("first-jwt", store.Redeem(first));
        Assert.Equal("second-jwt", store.Redeem(second));
    }
}
