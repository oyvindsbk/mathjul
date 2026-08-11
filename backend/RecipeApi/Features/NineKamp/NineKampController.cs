using System.Security.Cryptography;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Infrastructure;

namespace RecipeApi.Features.NineKamp;

/// <summary>
/// Public, unauthenticated API for the 9-kamp scoring app served at /9-kamp.html.
/// The /api/public/ prefix is exempted in EmailWhitelistMiddleware -- anyone with the
/// link can read and write. Limits below bound the blast radius on the shared Basic SQL.
/// </summary>
[ApiController]
[Route("api/public/ninekamp")]
public class NineKampController : ControllerBase
{
    // Caps: storage is shared with the recipe data on a 2 GB Basic tier, so bound the
    // damage an anonymous caller can do. 100 competitions x ~50 KB is ~5 MB worst case.
    private const int MaxCompetitions = 100;
    private const int MaxParticipants = 50;
    private const int MaxEvents = 20;
    private const int MaxNameLength = 60;
    private const int MaxResultLength = 20;

    private readonly RecipeDbContext _db;

    public NineKampController(RecipeDbContext db)
    {
        _db = db;
    }

    // GET /api/public/ninekamp/competitions
    [HttpGet("competitions")]
    public async Task<ActionResult<List<CompetitionSummaryDto>>> GetCompetitions()
    {
        var competitions = await _db.NineKampCompetitions
            .AsNoTracking()
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new CompetitionSummaryDto
            {
                Slug = c.Slug,
                Name = c.Name,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt,
                ParticipantCount = c.State.Participants.Count
            })
            .ToListAsync();

        return Ok(competitions);
    }

    // GET /api/public/ninekamp/competitions/{slug}
    [HttpGet("competitions/{slug}")]
    public async Task<ActionResult<CompetitionDto>> GetCompetition(string slug)
    {
        var competition = await _db.NineKampCompetitions
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Slug == slug);

        if (competition == null)
        {
            return NotFound(new { error = "Fant ikke konkurransen" });
        }

        return Ok(ToDto(competition));
    }

    // POST /api/public/ninekamp/competitions
    [HttpPost("competitions")]
    public async Task<ActionResult<CompetitionDto>> CreateCompetition([FromBody] CreateCompetitionRequest request)
    {
        var name = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(new { error = "Konkurransen må ha et navn" });
        }

        if (name.Length > 100)
        {
            return BadRequest(new { error = "Navnet er for langt" });
        }

        if (await _db.NineKampCompetitions.CountAsync() >= MaxCompetitions)
        {
            return BadRequest(new { error = "Maks antall konkurranser er nådd" });
        }

        var competition = new NineKampCompetition
        {
            Slug = GenerateSlug(),
            Name = name,
            State = new NineKampState()
        };

        _db.NineKampCompetitions.Add(competition);
        await _db.SaveChangesAsync();

        return Ok(ToDto(competition));
    }

    // DELETE /api/public/ninekamp/competitions/{slug}
    [HttpDelete("competitions/{slug}")]
    public async Task<IActionResult> DeleteCompetition(string slug)
    {
        var competition = await _db.NineKampCompetitions.FirstOrDefaultAsync(c => c.Slug == slug);
        if (competition == null)
        {
            return NotFound(new { error = "Fant ikke konkurransen" });
        }

        // Soft delete -- the global query filter hides it from every other endpoint, but the
        // row survives so a misclick by an anonymous caller can be undone in the database.
        competition.DeletedAt = DateTime.UtcNow;
        competition.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // PUT /api/public/ninekamp/competitions/{slug}/state
    [HttpPut("competitions/{slug}/state")]
    [RequestSizeLimit(256_000)]
    public async Task<IActionResult> SaveState(string slug, [FromBody] SaveStateRequest request)
    {
        if (request.State == null)
        {
            return BadRequest(new { error = "Mangler data" });
        }

        var validationError = Validate(request.State);
        if (validationError != null)
        {
            return BadRequest(new { error = validationError });
        }

        var competition = await _db.NineKampCompetitions.FirstOrDefaultAsync(c => c.Slug == slug);
        if (competition == null)
        {
            return NotFound(new { error = "Fant ikke konkurransen" });
        }

        // Optimistic concurrency: tell EF which version the client based its edit on, so a
        // second scorekeeper saving stale state gets a 409 instead of silently overwriting.
        if (!string.IsNullOrEmpty(request.Version))
        {
            try
            {
                _db.Entry(competition).Property(c => c.RowVersion).OriginalValue =
                    Convert.FromBase64String(request.Version);
            }
            catch (FormatException)
            {
                return BadRequest(new { error = "Ugyldig versjon" });
            }
        }

        competition.State = request.State;
        competition.UpdatedAt = DateTime.UtcNow;

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            // Hand back the winning state so the client can show it rather than lose the edit.
            var fresh = await _db.NineKampCompetitions
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Slug == slug);

            if (fresh == null)
            {
                return NotFound(new { error = "Fant ikke konkurransen" });
            }

            return Conflict(ToDto(fresh));
        }

        return Ok(new { version = ToVersion(competition.RowVersion) });
    }

    private static string? Validate(NineKampState state)
    {
        if (state.Participants.Count > MaxParticipants)
        {
            return $"For mange deltakere (maks {MaxParticipants})";
        }

        if (state.Participants.Any(p => string.IsNullOrWhiteSpace(p.Id) || p.Id.Length > 32))
        {
            return "Ugyldig deltaker-id";
        }

        if (state.Participants.Any(p => (p.Name?.Length ?? 0) > MaxNameLength))
        {
            return $"Navn kan være maks {MaxNameLength} tegn";
        }

        if (state.Results.Count > MaxEvents)
        {
            return "Ugyldige data";
        }

        foreach (var eventResults in state.Results.Values)
        {
            if (eventResults.Count > MaxParticipants)
            {
                return "Ugyldige data";
            }

            if (eventResults.Values.Any(v => (v?.Length ?? 0) > MaxResultLength))
            {
                return "Ugyldig resultat";
            }
        }

        return null;
    }

    /// <summary>
    /// 12 lowercase base32 chars. Not authentication -- just stops casual enumeration of
    /// existing competitions by anyone who has not already found the list endpoint.
    /// </summary>
    private static string GenerateSlug()
    {
        const string alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
        var bytes = RandomNumberGenerator.GetBytes(12);
        return string.Concat(bytes.Select(b => alphabet[b % alphabet.Length]));
    }

    private static string ToVersion(byte[]? rowVersion) =>
        rowVersion == null ? string.Empty : Convert.ToBase64String(rowVersion);

    private static CompetitionDto ToDto(NineKampCompetition competition) => new()
    {
        Slug = competition.Slug,
        Name = competition.Name,
        State = competition.State,
        CreatedAt = competition.CreatedAt,
        UpdatedAt = competition.UpdatedAt,
        Version = ToVersion(competition.RowVersion)
    };
}

public class CompetitionSummaryDto
{
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public int ParticipantCount { get; set; }
}

public class CompetitionDto
{
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public NineKampState State { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string Version { get; set; } = string.Empty;
}

public class CreateCompetitionRequest
{
    public string? Name { get; set; }
}

public class SaveStateRequest
{
    public NineKampState? State { get; set; }
    public string? Version { get; set; }
}
