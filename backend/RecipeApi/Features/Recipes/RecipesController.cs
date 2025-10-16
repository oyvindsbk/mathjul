using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Infrastructure;

namespace RecipeApi.Features.Recipes;

[ApiController]
[Route("api/[controller]")]
public class RecipesController : ControllerBase
{
    private readonly RecipeDbContext _context;
    private readonly IRecipeImageProcessor _imageProcessor;
    private readonly ILogger<RecipesController> _logger;

    public RecipesController(
        RecipeDbContext context, 
        IRecipeImageProcessor imageProcessor,
        ILogger<RecipesController> logger)
    {
        _context = context;
        _imageProcessor = imageProcessor;
        _logger = logger;
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

    [HttpPost("from-image")]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10MB
    public async Task<ActionResult<RecipeExtractionResponse>> ExtractRecipeFromImage(IFormFile image)
    {
        _logger.LogInformation("Received image upload request");

        if (image == null)
        {
            return BadRequest(new RecipeExtractionResponse
            {
                Success = false,
                ErrorMessage = "No image file provided"
            });
        }

        var result = await _imageProcessor.ExtractRecipeFromImageAsync(image);

        if (!result.IsSuccess)
        {
            return BadRequest(new RecipeExtractionResponse
            {
                Success = false,
                ErrorMessage = result.ErrorMessage
            });
        }

        // Map extracted recipe to response
        var response = new RecipeExtractionResponse
        {
            Success = true,
            ExtractedRecipe = new ExtractedRecipeResponse
            {
                Title = result.Recipe!.Title,
                Description = result.Recipe.Description,
                Ingredients = result.Recipe.Ingredients,
                Instructions = result.Recipe.Instructions,
                PrepTime = result.Recipe.PrepTime,
                CookTime = result.Recipe.CookTime,
                Servings = result.Recipe.Servings
            }
        };

        return Ok(response);
    }

    [HttpPost("save-extracted")]
    public async Task<ActionResult<RecipeDto>> SaveExtractedRecipe([FromBody] SaveExtractedRecipeRequest request)
    {
        _logger.LogInformation("Saving extracted recipe: {Title}", request.Title);

        var recipe = new Recipe
        {
            Title = request.Title,
            Description = request.Description ?? string.Empty,
            Ingredients = string.Join("\n", request.Ingredients ?? new List<string>()),
            Instructions = string.Join("\n", request.Instructions ?? new List<string>()),
            PrepTime = request.PrepTime,
            CookTimeMinutes = request.CookTime,
            CookTime = request.CookTime.HasValue ? $"{request.CookTime} min" : string.Empty,
            Servings = request.Servings,
            Difficulty = request.Difficulty ?? "Medium",
            ImageUrl = string.Empty,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Recipes.Add(recipe);
        await _context.SaveChangesAsync();

        var recipeDto = new RecipeDto
        {
            Id = recipe.Id,
            Title = recipe.Title,
            Description = recipe.Description,
            CookTime = recipe.CookTime,
            Difficulty = recipe.Difficulty,
            ImageUrl = recipe.ImageUrl
        };

        return CreatedAtAction(nameof(GetAllRecipes), new { id = recipe.Id }, recipeDto);
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

public class RecipeExtractionResponse
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public ExtractedRecipeResponse? ExtractedRecipe { get; set; }
}

public class ExtractedRecipeResponse
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<string> Ingredients { get; set; } = new();
    public List<string> Instructions { get; set; } = new();
    public int? PrepTime { get; set; }
    public int? CookTime { get; set; }
    public int? Servings { get; set; }
}

public class SaveExtractedRecipeRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<string>? Ingredients { get; set; }
    public List<string>? Instructions { get; set; }
    public int? PrepTime { get; set; }
    public int? CookTime { get; set; }
    public int? Servings { get; set; }
    public string? Difficulty { get; set; }
}