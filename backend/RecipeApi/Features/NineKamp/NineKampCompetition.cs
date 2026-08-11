using System.ComponentModel.DataAnnotations;

namespace RecipeApi.Features.NineKamp;

/// <summary>
/// A single 9-kamp competition. Publicly readable and writable by anyone holding the slug --
/// see EmailWhitelistMiddleware's /api/public/ exemption.
/// </summary>
public class NineKampCompetition
{
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
    public NineKampState State { get; set; } = new();

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Optimistic concurrency token -- two scorekeepers on phones is the expected case.</summary>
    public byte[]? RowVersion { get; set; }
}

public class NineKampState
{
    public List<NineKampParticipant> Participants { get; set; } = new();

    /// <summary>results[eventId][participantId] = raw result string, e.g. "12.4" or "1:58,3".</summary>
    public Dictionary<string, Dictionary<string, string>> Results { get; set; } = new();
}

public class NineKampParticipant
{
    /// <summary>Client-generated id (see uid() in 9-kamp.html).</summary>
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
}
