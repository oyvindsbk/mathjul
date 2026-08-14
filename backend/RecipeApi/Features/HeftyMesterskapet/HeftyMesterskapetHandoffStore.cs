using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace RecipeApi.Features.HeftyMesterskapet;

public interface IHeftyMesterskapetHandoffStore
{
    /// <summary>Issues a single-use code that can be exchanged for <paramref name="token"/>.</summary>
    string Issue(string token);

    /// <summary>
    /// Redeems a code, returning the token once and only once. Returns null for an unknown,
    /// expired, or already-redeemed code.
    /// </summary>
    string? Redeem(string code);
}

/// <summary>
/// Short-lived, single-use codes that carry a JWT from the frontend login back to the
/// backend-origin scoring page.
///
/// The page and the OAuth flow live on different origins, and the frontend obtains the JWT
/// server-to-server, so the token cannot simply arrive as a cookie. It has to travel through a
/// redirect -- and a redirect URL ends up in browser history, server logs, and Referer headers,
/// which is no place for a week-long JWT. A code that dies on first use and expires in a minute
/// bounds that exposure to the round trip it is needed for.
///
/// In-memory by design: these live for seconds, and a lost code on restart just means logging in
/// again. A restart during the redirect is not worth a database table.
/// </summary>
public sealed class HeftyMesterskapetHandoffStore : IHeftyMesterskapetHandoffStore
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(1);

    private readonly ConcurrentDictionary<string, Entry> _codes = new();
    private readonly TimeProvider _timeProvider;

    public HeftyMesterskapetHandoffStore(TimeProvider? timeProvider = null)
    {
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    private sealed record Entry(string Token, DateTimeOffset ExpiresAt);

    public string Issue(string token)
    {
        PurgeExpired();

        var code = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace("+", "-").Replace("/", "_").TrimEnd('=');

        _codes[code] = new Entry(token, _timeProvider.GetUtcNow().Add(Lifetime));
        return code;
    }

    public string? Redeem(string code)
    {
        PurgeExpired();

        if (string.IsNullOrEmpty(code) || !_codes.TryRemove(code, out var entry))
        {
            return null;   // unknown, or already redeemed -- removal is what makes it single-use
        }

        return entry.ExpiresAt > _timeProvider.GetUtcNow() ? entry.Token : null;
    }

    /// <summary>
    /// Keeps abandoned codes from accumulating. Cheap: the dictionary holds at most one entry per
    /// login in the last minute.
    /// </summary>
    private void PurgeExpired()
    {
        var now = _timeProvider.GetUtcNow();
        foreach (var (code, entry) in _codes)
        {
            if (entry.ExpiresAt <= now)
            {
                _codes.TryRemove(code, out _);
            }
        }
    }
}
