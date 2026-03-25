using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using RecipeApi.Features.Auth;
using Xunit;

namespace RecipeApi.Tests.Auth;

public class TokenServiceTests
{
    private static TokenService CreateService(string secretKey = "test-secret-key-that-is-long-enough-32chars")
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:SecretKey"] = secretKey,
                ["Jwt:Issuer"] = "RecipeApi",
                ["Jwt:Audience"] = "RecipeFrontend",
            })
            .Build();

        return new TokenService(config, NullLogger<TokenService>.Instance);
    }

    [Fact]
    public void GenerateToken_ReturnsNonEmptyString()
    {
        var sut = CreateService();
        var token = sut.GenerateToken("user@example.com");
        Assert.NotEmpty(token);
    }

    [Fact]
    public void ValidateToken_WithValidToken_ReturnsPrincipalWithEmailClaim()
    {
        var sut = CreateService();
        var token = sut.GenerateToken("user@example.com");

        var principal = sut.ValidateToken(token);

        Assert.NotNull(principal);
        Assert.Equal("user@example.com", principal.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value);
    }

    [Fact]
    public void ValidateToken_WithTamperedToken_ReturnsNull()
    {
        var sut = CreateService();
        var principal = sut.ValidateToken("not.a.valid.token");
        Assert.Null(principal);
    }

    [Fact]
    public void ValidateToken_WithWrongKey_ReturnsNull()
    {
        var issuer = CreateService("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        var validator = CreateService("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");

        var token = issuer.GenerateToken("user@example.com");
        var principal = validator.ValidateToken(token);

        Assert.Null(principal);
    }
}
