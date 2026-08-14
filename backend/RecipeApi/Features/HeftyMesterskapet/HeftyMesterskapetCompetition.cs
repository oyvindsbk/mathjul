using System.ComponentModel.DataAnnotations;

namespace RecipeApi.Features.HeftyMesterskapet;

/// <summary>
/// A single Heftymesterskapet competition. Readable by anyone with the link (see
/// EmailWhitelistMiddleware's /api/public/ exemption), but only editable by an email on the
/// Heftymesterskapet editor list -- see IHeftyMesterskapetEditorService.
/// </summary>
public class HeftyMesterskapetCompetition
{
    /// <summary>
    /// Well-known slug for the standing competition the UI opens directly. The page has no
    /// competition picker, so it resolves this instead of a random slug. Seeded on startup.
    /// Must stay in sync with the SLUG constant in wwwroot/heftymesterskapet.html.
    /// </summary>
    public const string DefaultSlug = "heftymesterskapet-2026";

    /// <summary>Display name used when the default competition is seeded.</summary>
    public const string DefaultName = "Heftymesterskapet 2026";

    public int Id { get; set; }

    /// <summary>Hard-to-guess public identifier used in URLs instead of the int id.</summary>
    [StringLength(32)]
    public string Slug { get; set; } = string.Empty;

    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// The whole client state as one blob. The client owns parsing and ranking, and rewrites
    /// this wholesale on every change, so there is nothing to gain from a relational split.
    /// </summary>
    public HeftyMesterskapetState State { get; set; } = new();

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Soft delete marker. Deleting is restricted to editors, but the row is still kept around so
    /// an accidental delete is recoverable straight from the database.
    /// </summary>
    public DateTime? DeletedAt { get; set; }

    /// <summary>Optimistic concurrency token -- two scorekeepers on phones is the expected case.</summary>
    public byte[]? RowVersion { get; set; }
}

public class HeftyMesterskapetState
{
    public List<HeftyMesterskapetParticipant> Participants { get; set; } = new();

    /// <summary>results[eventId][participantId] = raw result string, e.g. "12.4" or "1:58,3".</summary>
    public Dictionary<string, Dictionary<string, string>> Results { get; set; } = new();
}

public class HeftyMesterskapetParticipant
{
    /// <summary>Client-generated id (see uid() in heftymesterskapet.html).</summary>
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
}
