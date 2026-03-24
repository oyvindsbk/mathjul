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
    private readonly IRecipeUrlProcessor _urlProcessor;
    private readonly ILogger<RecipesController> _logger;

    public RecipesController(
        RecipeDbContext context,
        IRecipeImageProcessor imageProcessor,
        IRecipeUrlProcessor urlProcessor,
        ILogger<RecipesController> logger)
    {
        _context = context;
        _imageProcessor = imageProcessor;
        _urlProcessor = urlProcessor;
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

    [HttpGet("{id:int}")]
    public async Task<ActionResult<RecipeDetailDto>> GetRecipeById(int id)
    {
        var recipe = await _context.Recipes.FindAsync(id);
        
        if (recipe == null)
        {
            return NotFound(new { message = "Recipe not found" });
        }

        var recipeDetail = new RecipeDetailDto
        {
            Id = recipe.Id,
            Title = recipe.Title,
            Description = recipe.Description,
            CookTime = recipe.CookTime,
            CookTimeMinutes = recipe.CookTimeMinutes,
            PrepTime = recipe.PrepTime,
            Difficulty = recipe.Difficulty,
            ImageUrl = recipe.ImageUrl,
            Servings = recipe.Servings,
            Ingredients = recipe.Ingredients.Select(i => new StructuredIngredientDto
            {
                Quantity = i.Quantity,
                Unit = i.Unit,
                Name = i.Name
            }).ToList(),
            Instructions = recipe.Instructions.Split(new[] { "\n", "\r\n" }, StringSplitOptions.RemoveEmptyEntries).ToList(),
            CreatedAt = recipe.CreatedAt,
            UpdatedAt = recipe.UpdatedAt
        };

        return Ok(recipeDetail);
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
            ExtractedRecipe = MapToExtractedResponse(result.Recipe!)
        };

        return Ok(response);
    }

    [HttpPost("from-url")]
    public async Task<ActionResult<RecipeExtractionResponse>> ExtractRecipeFromUrl([FromBody] ExtractFromUrlRequest request)
    {
        _logger.LogInformation("Received URL extraction request: {Url}", request.Url);

        if (string.IsNullOrWhiteSpace(request.Url))
        {
            return BadRequest(new RecipeExtractionResponse
            {
                Success = false,
                ErrorMessage = "No URL provided"
            });
        }

        var result = await _urlProcessor.ExtractRecipeFromUrlAsync(request.Url);

        if (!result.IsSuccess)
        {
            return BadRequest(new RecipeExtractionResponse
            {
                Success = false,
                ErrorMessage = result.ErrorMessage
            });
        }

        return Ok(new RecipeExtractionResponse
        {
            Success = true,
            ExtractedRecipe = MapToExtractedResponse(result.Recipe!)
        });
    }

    [HttpPost("save-extracted")]
    public async Task<ActionResult<RecipeDto>> SaveExtractedRecipe([FromBody] SaveExtractedRecipeRequest request)
    {
        _logger.LogInformation("Saving extracted recipe: {Title}", request.Title);

        var recipe = new Recipe
        {
            Title = request.Title,
            Description = request.Description ?? string.Empty,
            Ingredients = (request.Ingredients ?? new List<StructuredIngredientDto>())
                .Select(i => new StructuredIngredient
                {
                    Quantity = i.Quantity,
                    Unit = i.Unit,
                    Name = i.Name
                }).ToList(),
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

    private static ExtractedRecipeResponse MapToExtractedResponse(ExtractedRecipeDto dto) => new()
    {
        Title = dto.Title,
        Description = dto.Description,
        Ingredients = dto.Ingredients.Select(i => new StructuredIngredientDto
        {
            Quantity = i.Quantity,
            Unit = i.Unit,
            Name = i.Name
        }).ToList(),
        Instructions = dto.Instructions,
        PrepTime = dto.PrepTime,
        CookTime = dto.CookTime,
        Servings = dto.Servings
    };
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

public class RecipeDetailDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string CookTime { get; set; } = string.Empty;
    public int? CookTimeMinutes { get; set; }
    public int? PrepTime { get; set; }
    public string Difficulty { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public int? Servings { get; set; }
    public List<StructuredIngredientDto> Ingredients { get; set; } = new();
    public List<string> Instructions { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class StructuredIngredientDto
{
    public decimal? Quantity { get; set; }
    public string? Unit { get; set; }
    public string Name { get; set; } = string.Empty;
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
    public List<StructuredIngredientDto> Ingredients { get; set; } = new();
    public List<string> Instructions { get; set; } = new();
    public int? PrepTime { get; set; }
    public int? CookTime { get; set; }
    public int? Servings { get; set; }
}

public class ExtractFromUrlRequest
{
    public string Url { get; set; } = string.Empty;
}

public class SaveExtractedRecipeRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<StructuredIngredientDto>? Ingredients { get; set; }
    public List<string>? Instructions { get; set; }
    public int? PrepTime { get; set; }
    public int? CookTime { get; set; }
    public int? Servings { get; set; }
    public string? Difficulty { get; set; }
}