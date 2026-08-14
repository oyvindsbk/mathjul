using System.Security.Cryptography;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Infrastructure;

namespace RecipeApi.Features.HeftyMesterskapet;

/// <summary>
/// Public, unauthenticated READ API for the multi-event scoring app served at /heftymesterskapet.html.
/// The /api/public/ prefix is exempted in EmailWhitelistMiddleware -- anyone with the link can read
/// the scoreboard, which is the point of the page.
///
/// Writes live in <see cref="HeftyMesterskapetEditorController"/> behind the editor list.
/// </summary>
[ApiController]
[Route("api/public/heftymesterskapet")]
public class HeftyMesterskapetController : ControllerBase
{
    private readonly RecipeDbContext _db;

    public HeftyMesterskapetController(RecipeDbContext db)
    {
        _db = db;
    }

    // GET /api/public/heftymesterskapet/competitions
    [HttpGet("competitions")]
    public async Task<ActionResult<List<CompetitionSummaryDto>>> GetCompetitions()
    {
        var competitions = await _db.HeftyMesterskapetCompetitions
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

    // GET /api/public/heftymesterskapet/competitions/{slug}
    [HttpGet("competitions/{slug}")]
    public async Task<ActionResult<CompetitionDto>> GetCompetition(string slug)
    {
        var competition = await _db.HeftyMesterskapetCompetitions
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Slug == slug);

        if (competition == null)
        {
            return NotFound(new { error = "Fant ikke konkurransen" });
        }

        return Ok(HeftyMesterskapetMapping.ToDto(competition));
    }
}

/// <summary>
/// Editor-only WRITE API. Every action here requires an email on the Heftymesterskapet editor list
/// (see <see cref="IHeftyMesterskapetEditorService"/>), which is separate from the recipe app's
/// approved-users whitelist.
///
/// This prefix is exempted from EmailWhitelistMiddleware precisely so that the editor list -- not
/// the recipe whitelist -- decides. Every action must therefore call <see cref="RequireEditorAsync"/>;
/// nothing upstream authorizes these requests.
/// </summary>
[ApiController]
[Route("api/heftymesterskapet")]
public class HeftyMesterskapetEditorController : ControllerBase
{
    // Caps: storage is shared with the recipe data on a 2 GB Basic tier, so bound the
    // damage a caller can do. 100 competitions x ~50 KB is ~5 MB worst case.
    private const int MaxCompetitions = 100;
    private const int MaxParticipants = 50;
    private const int MaxEvents = 20;
    private const int MaxNameLength = 60;
    private const int MaxResultLength = 20;

    private readonly RecipeDbContext _db;
    private readonly IHeftyMesterskapetCallerResolver _callerResolver;

    public HeftyMesterskapetEditorController(
        RecipeDbContext db,
        IHeftyMesterskapetCallerResolver callerResolver)
    {
        _db = db;
        _callerResolver = callerResolver;
    }

    /// <summary>
    /// Returns null when the caller may edit, otherwise the result to return. 401 distinguishes
    /// "not signed in" from 403 "signed in but not an editor" so the page can react differently.
    /// </summary>
    private async Task<ActionResult?> RequireEditorAsync()
    {
        var caller = await _callerResolver.ResolveAsync(HttpContext);

        if (!caller.IsSignedIn)
        {
            return Unauthorized(new { error = "Du må logge inn for å endre konkurransen" });
        }

        if (!caller.IsEditor)
        {
            return StatusCode(403, new { error = "Du har ikke tilgang til å endre denne konkurransen" });
        }

        return null;
    }

    // POST /api/heftymesterskapet/competitions
    [HttpPost("competitions")]
    public async Task<ActionResult<CompetitionDto>> CreateCompetition([FromBody] CreateCompetitionRequest request)
    {
        var denied = await RequireEditorAsync();
        if (denied != null) return denied;

        var name = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(new { error = "Konkurransen må ha et navn" });
        }

        if (name.Length > 100)
        {
            return BadRequest(new { error = "Navnet er for langt" });
        }

        if (await _db.HeftyMesterskapetCompetitions.CountAsync() >= MaxCompetitions)
        {
            return BadRequest(new { error = "Maks antall konkurranser er nådd" });
        }

        var competition = new HeftyMesterskapetCompetition
        {
            Slug = GenerateSlug(),
            Name = name,
            State = new HeftyMesterskapetState()
        };

        _db.HeftyMesterskapetCompetitions.Add(competition);
        await _db.SaveChangesAsync();

        return Ok(HeftyMesterskapetMapping.ToDto(competition));
    }

    // DELETE /api/heftymesterskapet/competitions/{slug}
    [HttpDelete("competitions/{slug}")]
    public async Task<IActionResult> DeleteCompetition(string slug)
    {
        var denied = await RequireEditorAsync();
        if (denied != null) return denied;

        var competition = await _db.HeftyMesterskapetCompetitions.FirstOrDefaultAsync(c => c.Slug == slug);
        if (competition == null)
        {
            return NotFound(new { error = "Fant ikke konkurransen" });
        }

        // Soft delete -- the global query filter hides it from every other endpoint, but the
        // row survives so a misclick is recoverable straight from the database.
        competition.DeletedAt = DateTime.UtcNow;
        competition.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // PUT /api/heftymesterskapet/competitions/{slug}/state
    [HttpPut("competitions/{slug}/state")]
    [RequestSizeLimit(256_000)]
    public async Task<IActionResult> SaveState(string slug, [FromBody] SaveStateRequest request)
    {
        var denied = await RequireEditorAsync();
        if (denied != null) return denied;

        if (request.State == null)
        {
            return BadRequest(new { error = "Mangler data" });
        }

        var validationError = Validate(request.State);
        if (validationError != null)
        {
            return BadRequest(new { error = validationError });
        }

        var competition = await _db.HeftyMesterskapetCompetitions.FirstOrDefaultAsync(c => c.Slug == slug);
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
            var fresh = await _db.HeftyMesterskapetCompetitions
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Slug == slug);

            if (fresh == null)
            {
                return NotFound(new { error = "Fant ikke konkurransen" });
            }

            return Conflict(HeftyMesterskapetMapping.ToDto(fresh));
        }

        return Ok(new { version = HeftyMesterskapetMapping.ToVersion(competition.RowVersion) });
    }

    private static string? Validate(HeftyMesterskapetState state)
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
}

internal static class HeftyMesterskapetMapping
{
    public static string ToVersion(byte[]? rowVersion) =>
        rowVersion == null ? string.Empty : Convert.ToBase64String(rowVersion);

    public static CompetitionDto ToDto(HeftyMesterskapetCompetition competition) => new()
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
    public HeftyMesterskapetState State { get; set; } = new();
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
    public HeftyMesterskapetState? State { get; set; }
    public string? Version { get; set; }
}
