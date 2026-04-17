using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Infrastructure;

namespace RecipeApi.Features.Matkasse;

[ApiController]
[Route("api/matkasse")]
public class MatkasseController : ControllerBase
{
    private readonly RecipeDbContext _db;
    private readonly IMatkasseImageProcessor _imageProcessor;
    private readonly ILogger<MatkasseController> _logger;

    public MatkasseController(RecipeDbContext db, IMatkasseImageProcessor imageProcessor, ILogger<MatkasseController> logger)
    {
        _db = db;
        _imageProcessor = imageProcessor;
        _logger = logger;
    }

    private string? GetCallerEmail() =>
        User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
        ?? User.FindFirst("email")?.Value;

    private async Task<bool> IsGroupMemberAsync(int groupId, string email) =>
        await _db.GroupMembers.AnyAsync(m => m.GroupId == groupId && m.User.Email == email);

    // GET /api/matkasse?groupId=1&weekStart=2026-04-21
    [HttpGet]
    public async Task<ActionResult<List<MatkasseRecipeDto>>> GetMatkasseRecipes(
        [FromQuery] int groupId,
        [FromQuery] string weekStart)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();

        if (!await IsGroupMemberAsync(groupId, email))
            return StatusCode(403, new { error = "Du er ikke medlem av denne gruppen" });

        if (!DateOnly.TryParse(weekStart, out var weekDate))
            return BadRequest(new { error = "Ugyldig datoformat. Bruk yyyy-MM-dd." });

        var entities = await _db.MatkasseRecipes
            .Where(r => r.GroupId == groupId && r.UkeStart == weekDate)
            .OrderBy(r => r.Leverandor).ThenBy(r => r.Tittel)
            .ToListAsync();

        var dtos = entities.Select(r => new MatkasseRecipeDto
        {
            Id = r.Id,
            Tittel = r.Tittel,
            Beskrivelse = r.Beskrivelse,
            Leverandor = r.Leverandor,
            UkeStart = r.UkeStart.ToString("yyyy-MM-dd"),
            ImageUrl = r.ImageUrl,
        }).ToList();

        return Ok(dtos);
    }

    // POST /api/matkasse/from-images
    [HttpPost("from-images")]
    [RequestSizeLimit(50 * 1024 * 1024)]
    public async Task<ActionResult<MatkasseFromImagesResponse>> ExtractFromImages(
        [FromForm] int groupId,
        [FromForm] string leverandor,
        [FromForm] string weekStart,
        IFormFileCollection images)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();

        if (!await IsGroupMemberAsync(groupId, email))
            return StatusCode(403, new { error = "Du er ikke medlem av denne gruppen" });

        if (images == null || images.Count == 0)
            return BadRequest(new { error = "Ingen bilder ble lastet opp" });

        if (images.Count > 5)
            return BadRequest(new { error = "Maks 5 bilder er tillatt" });

        if (!DateOnly.TryParse(weekStart, out var weekDate))
            return BadRequest(new { error = "Ugyldig datoformat for weekStart. Bruk yyyy-MM-dd." });

        var validLeverandorer = new[] { "Hellofresh", "Kokkeloren", "GodtLevert" };
        if (!validLeverandorer.Contains(leverandor))
            return BadRequest(new { error = $"Ugyldig leverandør. Velg en av: {string.Join(", ", validLeverandorer)}" });

        _logger.LogInformation("Matkasse image extraction: {Count} bilder, {Leverandor}, uke {WeekStart}", images.Count, leverandor, weekStart);

        var result = await _imageProcessor.ExtractOppskrifterAsync(images.ToList().AsReadOnly(), leverandor);

        if (!result.IsSuccess)
            return BadRequest(new { error = result.ErrorMessage });

        var now = DateTime.UtcNow;
        var saved = new List<MatkasseRecipeDto>();

        foreach (var extracted in result.Oppskrifter)
        {
            var entity = new MatkasseRecipe
            {
                GroupId = groupId,
                Leverandor = leverandor,
                UkeStart = weekDate,
                Tittel = extracted.Tittel,
                Beskrivelse = extracted.Beskrivelse,
                CreatedByEmail = email,
                CreatedAt = now
            };
            _db.MatkasseRecipes.Add(entity);
            await _db.SaveChangesAsync();

            saved.Add(new MatkasseRecipeDto
            {
                Id = entity.Id,
                Tittel = entity.Tittel,
                Beskrivelse = entity.Beskrivelse,
                Leverandor = entity.Leverandor,
                UkeStart = entity.UkeStart.ToString("yyyy-MM-dd"),
                ImageUrl = entity.ImageUrl,
            });
        }

        return Ok(new MatkasseFromImagesResponse { Recipes = saved });
    }

    // DELETE /api/matkasse/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteMatkasseRecipe(int id)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();

        var recipe = await _db.MatkasseRecipes.FindAsync(id);
        if (recipe == null) return NotFound();

        if (!await IsGroupMemberAsync(recipe.GroupId, email))
            return StatusCode(403, new { error = "Du er ikke medlem av denne gruppen" });

        await _db.MealPlans
            .Where(mp => mp.MatkasseRecipeId == id)
            .ExecuteUpdateAsync(s => s.SetProperty(mp => mp.MatkasseRecipeId, (int?)null));

        _db.MatkasseRecipes.Remove(recipe);
        await _db.SaveChangesAsync();

        return NoContent();
    }
}

// DTOs
public class MatkasseRecipeDto
{
    public int Id { get; set; }
    public string Tittel { get; set; } = string.Empty;
    public string? Beskrivelse { get; set; }
    public string Leverandor { get; set; } = string.Empty;
    public string UkeStart { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
}

public class MatkasseFromImagesResponse
{
    public List<MatkasseRecipeDto> Recipes { get; set; } = [];
}
