using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
            .FirstOrDefault(c => c.Group == "Måltidstype")
            ?.Name;

    private static List<string> ResolveMealTypeCategories(Recipe recipe) =>
        recipe.Categories
            .Where(c => c.Group == "Måltidstype")
            .Select(c => c.Name)
            .ToList();

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
            .Include(p => p.Recipe).ThenInclude(r => r.Categories)
            .Select(p => new MealPlanDto
            {
                Id = p.Id,
                GroupId = p.GroupId,
                Date = p.Date.ToString("yyyy-MM-dd"),
                RecipeId = p.RecipeId,
                Recipe = new MealPlanRecipeDto
                {
                    Id = p.Recipe.Id,
                    Title = p.Recipe.Title,
                    ImageUrl = p.Recipe.ImageUrl,
                    MealTypeCategory = p.Recipe.Categories
                        .Where(c => c.Group == "Måltidstype")
                        .Select(c => c.Name)
                        .FirstOrDefault(),
                    MealTypeCategories = p.Recipe.Categories
                        .Where(c => c.Group == "Måltidstype")
                        .Select(c => c.Name)
                        .ToList()
                },
                CreatedByEmail = p.CreatedByEmail
            })
            .ToListAsync();

        return Ok(plans);
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

        var recipe = await _db.Recipes
            .Include(r => r.Categories)
            .FirstOrDefaultAsync(r => r.Id == request.RecipeId);
        if (recipe == null) return NotFound(new { error = "Recipe not found" });

        var entry = new MealPlan
        {
            GroupId = groupId,
            Date = parsedDate,
            RecipeId = request.RecipeId,
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
            Recipe = new MealPlanRecipeDto
            {
                Id = recipe.Id,
                Title = recipe.Title,
                ImageUrl = recipe.ImageUrl,
                MealTypeCategory = ResolveMealTypeCategory(recipe),
                MealTypeCategories = ResolveMealTypeCategories(recipe)
            },
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
            .Where(r => r.Visibility == "Public"
                || (r.Visibility == "Group" && r.Groups.Any(rg => rg.GroupId == groupId)))
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
                Recipe = new MealPlanRecipeDto
                {
                    Id = recipe.Id,
                    Title = recipe.Title,
                    ImageUrl = recipe.ImageUrl,
                    MealTypeCategory = ResolveMealTypeCategory(recipe),
                    MealTypeCategories = ResolveMealTypeCategories(recipe)
                },
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
    public int RecipeId { get; set; }
    public MealPlanRecipeDto Recipe { get; set; } = null!;
    public string? CreatedByEmail { get; set; }
}

public class MealPlanRecipeDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public string? MealTypeCategory { get; set; }
    public List<string> MealTypeCategories { get; set; } = new();
}

public class CreateMealPlanRequest
{
    public string Date { get; set; } = string.Empty;
    public int RecipeId { get; set; }
}

public class AiPlanRequest
{
    public string WeekStart { get; set; } = string.Empty;
}
