using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Infrastructure;

namespace RecipeApi.Features.Stock;

[ApiController]
[Route("api/groups/{groupId:int}/stock")]
public class StockCoverageController : GroupScopedController
{
    private const int DefaultSuggestionLimit = 10;
    private const int MaxSuggestionLimit = 50;

    public StockCoverageController(RecipeDbContext db) : base(db)
    {
    }

    // GET /api/groups/{groupId}/stock/week-coverage?weekStart=2026-10-12
    [HttpGet("week-coverage")]
    public async Task<ActionResult<WeekCoverageDto>> GetWeekCoverage(int groupId, [FromQuery] string? weekStart)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();
        if (!await IsGroupMemberAsync(groupId, email)) return NotMember();

        if (!DateOnly.TryParseExact(weekStart, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var start))
            return BadRequest(new { error = "Ugyldig weekStart. Bruk yyyy-MM-dd." });
        var end = start.AddDays(6);

        var plans = await Db.MealPlans
            .AsNoTracking()
            .Where(p => p.GroupId == groupId && p.Date >= start && p.Date <= end)
            .Include(p => p.Recipe).ThenInclude(r => r!.SideDishes).ThenInclude(sd => sd.SideDishRecipe)
            .Include(p => p.MatkasseRecipe)
            .AsSplitQuery()
            .ToListAsync();

        var stock = await LoadStockAsync(groupId);

        var entries = plans.Select(p =>
        {
            if (p.Recipe == null)
                return new WeekEntryInput(p.Id, p.Date, p.MatkasseRecipe?.Tittel ?? p.CustomTitle ?? "Uten navn", false, []);

            // Side dishes are part of the meal, so their ingredients count too.
            var ingredients = StockCoverage.Flatten(p.Recipe).Select(i => new IngredientSource(i)).ToList();
            foreach (var sideDish in p.Recipe.SideDishes.OrderBy(sd => sd.SortOrder))
                ingredients.AddRange(StockCoverage.Flatten(sideDish.SideDishRecipe)
                    .Select(i => new IngredientSource(i, sideDish.SideDishRecipe.Title)));

            return new WeekEntryInput(p.Id, p.Date, p.Recipe.Title, true, ingredients);
        }).ToList();

        return Ok(StockCoverage.BuildWeek(entries, stock));
    }

    // GET /api/groups/{groupId}/stock/suggestions?limit=10
    [HttpGet("suggestions")]
    public async Task<ActionResult<List<SuggestionDto>>> GetSuggestions(int groupId, [FromQuery] int limit = DefaultSuggestionLimit)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();
        if (!await IsGroupMemberAsync(groupId, email)) return NotMember();

        limit = Math.Clamp(limit, 1, MaxSuggestionLimit);

        // Same visibility rule as the meal plan's recipe picker.
        var recipes = await Db.Recipes
            .AsNoTracking()
            .Where(r => r.Visibility == "Public"
                || (r.Visibility == "Group" && r.Groups.Any(rg => rg.GroupId == groupId)))
            .Select(r => new { r.Id, r.Title, r.ImageUrl, r.Ingredients, r.IngredientSections })
            .ToListAsync();

        var inputs = recipes
            .Select(r => new SuggestionRecipe(r.Id, r.Title, r.ImageUrl,
                [.. r.Ingredients, .. r.IngredientSections.SelectMany(s => s.Ingredients)]))
            .ToList();

        var stock = await LoadStockAsync(groupId);

        return Ok(StockCoverage.Rank(inputs, stock, DateOnly.FromDateTime(DateTime.UtcNow), limit));
    }

    private Task<List<StockItem>> LoadStockAsync(int groupId) =>
        Db.StockItems.AsNoTracking().Where(s => s.GroupId == groupId).ToListAsync();
}
