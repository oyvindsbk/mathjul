namespace NotesApi.Features.Auth;

public class NotesAuthOptions
{
    public const string SectionName = "Notes";

    /// <summary>
    /// Comma-separated emails allowed to sign in. Deliberately separate from the recipe
    /// app's approved-users list. Set via the Notes__AllowedEmails env var in production.
    /// </summary>
    public string AllowedEmails { get; set; } = "";

    /// <summary>The email the dev-token endpoint signs in as (local only).</summary>
    public string DevEmail { get; set; } = "dev@example.com";

    /// <summary>Google OAuth client id; Google id_tokens must be issued for it.</summary>
    public string GoogleClientId { get; set; } = "";

    public bool IsAllowed(string? email) =>
        !string.IsNullOrWhiteSpace(email) &&
        AllowedEmails
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Contains(email.Trim(), StringComparer.OrdinalIgnoreCase);
}

public class JwtOptions
{
    public const string SectionName = "Jwt";
    public const string DefaultIssuer = "NotesApi";
    public const string DefaultAudience = "NotesFrontend";

    public string SecretKey { get; set; } = "";
    public string Issuer { get; set; } = DefaultIssuer;
    public string Audience { get; set; } = DefaultAudience;
}
