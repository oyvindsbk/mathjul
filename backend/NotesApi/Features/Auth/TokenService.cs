using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace NotesApi.Features.Auth;

public interface ITokenService
{
    string GenerateToken(string email);
}

public class TokenService(IOptions<JwtOptions> options, TimeProvider time) : ITokenService
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);

    public string GenerateToken(string email)
    {
        var jwt = options.Value;
        var credentials = new SigningCredentials(SigningKey(jwt), SecurityAlgorithms.HmacSha256);
        var now = time.GetUtcNow().UtcDateTime;

        var token = new JwtSecurityToken(
            issuer: jwt.Issuer,
            audience: jwt.Audience,
            claims:
            [
                new Claim(ClaimTypes.Email, email),
                new Claim(JwtRegisteredClaimNames.Sub, email),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            ],
            notBefore: now,
            expires: now.Add(Lifetime),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public static SymmetricSecurityKey SigningKey(JwtOptions jwt)
    {
        if (Encoding.UTF8.GetByteCount(jwt.SecretKey) < 32)
            throw new InvalidOperationException("Jwt:SecretKey must be at least 32 bytes.");
        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SecretKey));
    }

    public static TokenValidationParameters ValidationParameters(JwtOptions jwt) => new()
    {
        ValidateIssuer = true,
        ValidIssuer = jwt.Issuer,
        ValidateAudience = true,
        ValidAudience = jwt.Audience,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = SigningKey(jwt),
        ClockSkew = TimeSpan.FromMinutes(2),
    };
}
