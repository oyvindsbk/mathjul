using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Features.Matkasse;
using RecipeApi.Features.Recipes;
using RecipeApi.Infrastructure;

namespace RecipeApi.Features.MealPlans;

[ApiController]
[Route("api/groups/{groupId:int}/mealplans")]
public class MealPlansController : ControllerBase
{
    private readonly RecipeDbContext _db;

    public MealPlansController(RecipeDbContext db)
    {
        _db = db;
    }

    private string? GetCallerEmail() =>
        User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
        ?? User.FindFirst("email")?.Value;

    private async Task<bool> IsGroupMemberAsync(int groupId, string email) =>
        await _db.GroupMembers
            .AnyAsync(m => m.GroupId == groupId && m.User.Email == email);

    private static string? ResolveMealTypeCategory(Recipe recipe) =>
        recipe.Categories
            .FirstOrDefault(c => c.Group == RecipeCategories.MealTypeGroup)
            ?.Name;

    private static List<string> ResolveMealTypeCategories(Recipe recipe) =>
        recipe.Categories
            .Where(c => c.Group == RecipeCategories.MealTypeGroup)
            .Select(c => c.Name)
            .ToList();

    private static List<string> ResolveSideDishTitles(Recipe recipe) =>
        recipe.SideDishes
            .OrderBy(sd => sd.SortOrder)
            .Select(sd => sd.SideDishRecipe.Title)
            .ToList();

    /// <summary>
    /// Single construction point for the recipe half of a meal plan entry, so every
    /// endpoint returns the same shape. Requires Categories and SideDishes to be loaded.
    /// </summary>
    private static MealPlanRecipeDto BuildRecipeDto(Recipe recipe) => new()
    {
        Id = recipe.Id,
        Title = recipe.Title,
        ImageUrl = recipe.ImageUrl,
        MealTypeCategory = ResolveMealTypeCategory(recipe),
        MealTypeCategories = ResolveMealTypeCategories(recipe),
        SideDishTitles = ResolveSideDishTitles(recipe)
    };

    // GET /api/groups/{groupId}/mealplans?from=2026-04-14&to=2026-04-20
    [HttpGet]
    public async Task<ActionResult<List<MealPlanDto>>> GetMealPlans(
        int groupId,
        [FromQuery] string from,
        [FromQuery] string to)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();

        if (!await IsGroupMemberAsync(groupId, email))
            return StatusCode(403, new { error = "You are not a member of this group" });

        if (!DateOnly.TryParse(from, out var fromDate) || !DateOnly.TryParse(to, out var toDate))
            return BadRequest(new { error = "Invalid date format. Use yyyy-MM-dd." });

        var plans = await _db.MealPlans
            .Where(p => p.GroupId == groupId && p.Date >= fromDate && p.Date <= toDate)
            .Include(p => p.Recipe).ThenInclude(r => r!.Categories)
            .Include(p => p.Recipe).ThenInclude(r => r!.SideDishes).ThenInclude(sd => sd.SideDishRecipe)
            .Include(p => p.MatkasseRecipe)
            .AsSplitQuery()
            .ToListAsync();

        var planDtos = plans.Select(p => new MealPlanDto
        {
            Id = p.Id,
            GroupId = p.GroupId,
            Date = p.Date.ToString("yyyy-MM-dd"),
            RecipeId = p.RecipeId,
            Recipe = p.Recipe == null ? null : BuildRecipeDto(p.Recipe),
            MatkasseRecipe = p.MatkasseRecipe == null ? null : new MealPlanMatkasseDto
            {
                Id = p.MatkasseRecipe.Id,
                Tittel = p.MatkasseRecipe.Tittel,
                Beskrivelse = p.MatkasseRecipe.Beskrivelse,
                Leverandor = p.MatkasseRecipe.Leverandor,
                ImageUrl = p.MatkasseRecipe.ImageUrl
            },
            CustomTitle = p.CustomTitle,
            CustomNote = p.CustomNote,
            IsCustom = p.CustomTitle != null,
            CreatedByEmail = p.CreatedByEmail
        }).ToList();

        return Ok(planDtos);
    }

    // POST /api/groups/{groupId}/mealplans
    [HttpPost]
    public async Task<ActionResult<MealPlanDto>> CreateMealPlan(int groupId, [FromBody] CreateMealPlanRequest request)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();

        if (!await IsGroupMemberAsync(groupId, email))
            return StatusCode(403, new { error = "You are not a member of this group" });

        if (!DateOnly.TryParse(request.Date, out var parsedDate))
            return BadRequest(new { error = "Invalid date format. Use yyyy-MM-dd." });

        var sourceCount = (request.RecipeId != null ? 1 : 0)
            + (request.MatkasseRecipeId != null ? 1 : 0)
            + (!string.IsNullOrWhiteSpace(request.CustomTitle) ? 1 : 0);
        if (sourceCount == 0)
            return BadRequest(new { error = "One of recipeId, matkasseRecipeId, or customTitle must be provided" });
        if (sourceCount > 1)
            return BadRequest(new { error = "Only one of recipeId, matkasseRecipeId, or customTitle may be provided" });

        Recipe? recipe = null;
        RecipeApi.Features.Matkasse.MatkasseRecipe? matkasseRecipe = null;

        if (request.RecipeId != null)
        {
            recipe = await _db.Recipes
                .Include(r => r.Categories)
                .Include(r => r.SideDishes).ThenInclude(sd => sd.SideDishRecipe)
                .AsSplitQuery()
                .FirstOrDefaultAsync(r => r.Id == request.RecipeId);
            if (recipe == null) return NotFound(new { error = "Recipe not found" });
        }

        if (request.MatkasseRecipeId != null)
        {
            matkasseRecipe = await _db.MatkasseRecipes.FindAsync(request.MatkasseRecipeId);
            if (matkasseRecipe == null) return NotFound(new { error = "Matkasse recipe not found" });
        }

        var entry = new MealPlan
        {
            GroupId = groupId,
            Date = parsedDate,
            RecipeId = request.RecipeId,
            MatkasseRecipeId = request.MatkasseRecipeId,
            CustomTitle = string.IsNullOrWhiteSpace(request.CustomTitle) ? null : request.CustomTitle.Trim(),
            CustomNote = string.IsNullOrWhiteSpace(request.CustomNote) ? null : request.CustomNote.Trim(),
            CreatedByEmail = email,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.MealPlans.Add(entry);
        await _db.SaveChangesAsync();

        return Ok(new MealPlanDto
        {
            Id = entry.Id,
            GroupId = entry.GroupId,
            Date = entry.Date.ToString("yyyy-MM-dd"),
            RecipeId = entry.RecipeId,
            Recipe = recipe == null ? null : BuildRecipeDto(recipe),
            MatkasseRecipeId = entry.MatkasseRecipeId,
            MatkasseRecipe = matkasseRecipe == null ? null : new MealPlanMatkasseDto
            {
                Id = matkasseRecipe.Id,
                Tittel = matkasseRecipe.Tittel,
                Beskrivelse = matkasseRecipe.Beskrivelse,
                Leverandor = matkasseRecipe.Leverandor,
                ImageUrl = matkasseRecipe.ImageUrl
            },
            CustomTitle = entry.CustomTitle,
            CustomNote = entry.CustomNote,
            IsCustom = entry.CustomTitle != null,
            CreatedByEmail = entry.CreatedByEmail
        });
    }

    // PATCH /api/groups/{groupId}/mealplans/{entryId}
    // Partial update: only the fields present on the request are applied.
    [HttpPatch("{entryId:int}")]
    public async Task<ActionResult<MealPlanDto>> MoveMealPlan(int groupId, int entryId, [FromBody] MoveMealPlanRequest request)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();

        if (!await IsGroupMemberAsync(groupId, email))
            return StatusCode(403, new { error = "You are not a member of this group" });

        DateOnly? parsedDate = null;
        if (request.Date != null)
        {
            // Exact + invariant: the contract is yyyy-MM-dd, and a plain TryParse would
            // otherwise accept whatever the server's locale allows (e.g. dd.MM.yyyy on a
            // Norwegian host), making the API's accepted input depend on where it runs.
            if (!DateOnly.TryParseExact(request.Date, "yyyy-MM-dd",
                    CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
                return BadRequest(new { error = "Invalid date format. Use yyyy-MM-dd." });
            parsedDate = date;
        }

        var entry = await _db.MealPlans
            .Include(p => p.Recipe).ThenInclude(r => r!.Categories)
            .Include(p => p.Recipe).ThenInclude(r => r!.SideDishes).ThenInclude(sd => sd.SideDishRecipe)
            .Include(p => p.MatkasseRecipe)
            .AsSplitQuery()
            .FirstOrDefaultAsync(p => p.GroupId == groupId && p.Id == entryId);

        if (entry == null) return NotFound();

        // CustomTitle is the discriminator for a custom card. Letting a recipe or matkasse
        // entry acquire one would break the exactly-one-of-three source invariant that
        // CreateMealPlan enforces, and blanking it on a custom card would orphan the row.
        var touchesCustomFields = request.CustomTitle != null || request.CustomNote != null;
        if (touchesCustomFields && entry.CustomTitle == null)
            return BadRequest(new { error = "Only custom entries can have a title or note." });

        if (request.CustomTitle != null && string.IsNullOrWhiteSpace(request.CustomTitle))
            return BadRequest(new { error = "customTitle cannot be empty." });

        if (parsedDate != null) entry.Date = parsedDate.Value;
        if (request.CustomTitle != null) entry.CustomTitle = request.CustomTitle.Trim();
        if (request.CustomNote != null)
            entry.CustomNote = string.IsNullOrWhiteSpace(request.CustomNote) ? null : request.CustomNote.Trim();

        entry.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new MealPlanDto
        {
            Id = entry.Id,
            GroupId = entry.GroupId,
            Date = entry.Date.ToString("yyyy-MM-dd"),
            RecipeId = entry.RecipeId,
            Recipe = entry.Recipe == null ? null : BuildRecipeDto(entry.Recipe),
            MatkasseRecipeId = entry.MatkasseRecipeId,
            MatkasseRecipe = entry.MatkasseRecipe == null ? null : new MealPlanMatkasseDto
            {
                Id = entry.MatkasseRecipe.Id,
                Tittel = entry.MatkasseRecipe.Tittel,
                Beskrivelse = entry.MatkasseRecipe.Beskrivelse,
                Leverandor = entry.MatkasseRecipe.Leverandor,
                ImageUrl = entry.MatkasseRecipe.ImageUrl
            },
            CustomTitle = entry.CustomTitle,
            CustomNote = entry.CustomNote,
            IsCustom = entry.CustomTitle != null,
            CreatedByEmail = entry.CreatedByEmail
        });
    }

    // DELETE /api/groups/{groupId}/mealplans/{entryId}
    [HttpDelete("{entryId:int}")]
    public async Task<IActionResult> DeleteMealPlan(int groupId, int entryId)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();

        if (!await IsGroupMemberAsync(groupId, email))
            return StatusCode(403, new { error = "You are not a member of this group" });

        var plan = await _db.MealPlans
            .FirstOrDefaultAsync(p => p.GroupId == groupId && p.Id == entryId);

        if (plan == null) return NotFound();

        _db.MealPlans.Remove(plan);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // POST /api/groups/{groupId}/mealplans/ai-plan
    [HttpPost("ai-plan")]
    public async Task<ActionResult<List<MealPlanDto>>> GenerateAiPlan(int groupId, [FromBody] AiPlanRequest request)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();

        if (!await IsGroupMemberAsync(groupId, email))
            return StatusCode(403, new { error = "You are not a member of this group" });

        if (!DateOnly.TryParse(request.WeekStart, out var weekStart))
            return BadRequest(new { error = "Invalid weekStart format. Use yyyy-MM-dd." });

        // Get all recipes visible to this group or public
        var recipes = await _db.Recipes
            .Include(r => r.Categories)
            .Include(r => r.SideDishes).ThenInclude(sd => sd.SideDishRecipe)
            .Where(r => r.Visibility == "Public"
                || (r.Visibility == "Group" && r.Groups.Any(rg => rg.GroupId == groupId)))
            .AsSplitQuery()
            .ToListAsync();

        if (recipes.Count == 0)
            return BadRequest(new { error = "No recipes available to plan with." });

        // Shuffle recipes and cycle if fewer than 7 available
        var shuffled = recipes.OrderBy(_ => Guid.NewGuid()).ToList();

        var result = new List<MealPlanDto>();
        var now = DateTime.UtcNow;

        for (int i = 0; i < 7; i++)
        {
            var day = weekStart.AddDays(i);
            var recipe = shuffled[i % shuffled.Count];

            var entry = new MealPlan
            {
                GroupId = groupId,
                Date = day,
                RecipeId = recipe.Id,
                CreatedByEmail = email,
                CreatedAt = now,
                UpdatedAt = now
            };
            _db.MealPlans.Add(entry);
            await _db.SaveChangesAsync();

            result.Add(new MealPlanDto
            {
                Id = entry.Id,
                GroupId = entry.GroupId,
                Date = entry.Date.ToString("yyyy-MM-dd"),
                RecipeId = recipe.Id,
                Recipe = BuildRecipeDto(recipe),
                MatkasseRecipe = null,
                CreatedByEmail = entry.CreatedByEmail
            });
        }

        return Ok(result);
    }
}

// DTOs
public class MealPlanDto
{
    public int Id { get; set; }
    public int GroupId { get; set; }
    public string Date { get; set; } = string.Empty;
    public int? RecipeId { get; set; }
    public MealPlanRecipeDto? Recipe { get; set; }
    public int? MatkasseRecipeId { get; set; }
    public MealPlanMatkasseDto? MatkasseRecipe { get; set; }
    public string? CustomTitle { get; set; }
    public string? CustomNote { get; set; }
    public bool IsCustom { get; set; }
    public string? CreatedByEmail { get; set; }
}

public class MealPlanMatkasseDto
{
    public int Id { get; set; }
    public string Tittel { get; set; } = string.Empty;
    public string? Beskrivelse { get; set; }
    public string Leverandor { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
}

public class MealPlanRecipeDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public string? MealTypeCategory { get; set; }
    public List<string> MealTypeCategories { get; set; } = new();
    /// <summary>Titles of side dishes attached to this recipe, in SortOrder.</summary>
    public List<string> SideDishTitles { get; set; } = new();
}

public class CreateMealPlanRequest
{
    public string Date { get; set; } = string.Empty;
    public int? RecipeId { get; set; }
    public int? MatkasseRecipeId { get; set; }
    public string? CustomTitle { get; set; }
    public string? CustomNote { get; set; }
}

public class AiPlanRequest
{
    public string WeekStart { get; set; } = string.Empty;
}

/// <summary>
/// Partial update of an existing entry. Every field is optional; a null field is left
/// untouched. CustomTitle/CustomNote are rejected on non-custom entries.
/// </summary>
public class MoveMealPlanRequest
{
    public string? Date { get; set; }
    public string? CustomTitle { get; set; }
    public string? CustomNote { get; set; }
}
