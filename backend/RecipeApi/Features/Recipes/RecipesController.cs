using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Infrastructure;

namespace RecipeApi.Features.Recipes;

[ApiController]
[Route("api/[controller]")]
public class RecipesController : ControllerBase
{
    private readonly RecipeDbContext _context;

    public RecipesController(RecipeDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<List<RecipeDto>>> GetAllRecipes()
    {
        var recipes = await _context.Recipes
            .Select(r => new RecipeDto
            {
                Id = r.Id,
                Title = r.Title,
                Description = r.Description,
                CookTime = r.CookTime,
                Difficulty = r.Difficulty,
                ImageUrl = r.ImageUrl
            })
            .ToListAsync();

        return Ok(recipes);
    }
}

public class RecipeDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string CookTime { get; set; } = string.Empty;
    public string Difficulty { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
}