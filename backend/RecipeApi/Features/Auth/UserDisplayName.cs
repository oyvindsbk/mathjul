namespace RecipeApi.Features.Auth;

/// <summary>
/// Resolves how a user is shown to others. Recipes reference their owner by email,
/// but showing a raw address exposes it on recipe pages and profiles, so prefer any
/// name the user has set and fall back to the email only when nothing else exists.
/// </summary>
public static class UserDisplayName
{
    /// <summary>
    /// Nickname, then Name, then DisplayName — first one set wins.
    ///
    /// The last resort is the email's local part, never the full address: this feeds
    /// endpoints readable by any signed-in user, so no branch here may return something
    /// that is a usable email address.
    /// </summary>
    public static string Resolve(string? nickname, string? name, string? displayName, string email)
    {
        if (!string.IsNullOrWhiteSpace(nickname)) return nickname.Trim();
        if (!string.IsNullOrWhiteSpace(name)) return name.Trim();
        if (!string.IsNullOrWhiteSpace(displayName)) return displayName.Trim();

        var localPart = email.Split('@')[0];
        return string.IsNullOrWhiteSpace(localPart) ? "Ukjent bruker" : localPart;
    }

    /// <summary>Convenience overload for a loaded <see cref="User"/>.</summary>
    public static string Resolve(User user) =>
        Resolve(user.Nickname, user.Name, user.DisplayName, user.Email);
}
