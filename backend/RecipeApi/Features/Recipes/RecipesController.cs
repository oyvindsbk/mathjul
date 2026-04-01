using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Infrastructure;

namespace RecipeApi.Features.Recipes;

[ApiController]
[Route("api/[controller]")]
public class RecipesController : ControllerBase
{
    private static readonly string[] AllowedImageContentTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    private const long MaxImageBytes = 10 * 1024 * 1024; // 10MB

    private readonly RecipeDbContext _context;
    private readonly IRecipeImageProcessor _imageProcessor;
    private readonly IRecipeUrlProcessor _urlProcessor;
    private readonly IBlobStorageService _blobStorage;
    private readonly ILogger<RecipesController> _logger;

    public RecipesController(
        RecipeDbContext context,
        IRecipeImageProcessor imageProcessor,
        IRecipeUrlProcessor urlProcessor,
        IBlobStorageService blobStorage,
        ILogger<RecipesController> logger)
    {
        _context = context;
        _imageProcessor = imageProcessor;
        _urlProcessor = urlProcessor;
        _blobStorage = blobStorage;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<RecipeDto>>> GetAllRecipes([FromQuery] string? categories = null)
    {
        IQueryable<Recipe> query = _context.Recipes.Include(r => r.Categories);

        if (!string.IsNullOrWhiteSpace(categories))
        {
            var ids = categories.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(s => int.TryParse(s.Trim(), out var n) ? n : (int?)null)
                .Where(n => n.HasValue)
                .Select(n => n!.Value)
                .ToList();

            foreach (var categoryId in ids)
            {
                query = query.Where(r => r.Categories.Any(c => c.Id == categoryId));
            }
        }

        var recipes = await query
            .Select(r => new RecipeDto
            {
                Id = r.Id,
                Title = r.Title,
                Description = r.Description,
                CookTime = r.CookTime,
                Difficulty = r.Difficulty,
                ImageUrl = r.ImageUrl,
                Categories = r.Categories.Select(c => new CategoryDto { Id = c.Id, Name = c.Name, Group = c.Group }).ToList()
            })
            .ToListAsync();

        return Ok(recipes);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<RecipeDetailDto>> GetRecipeById(int id)
    {
        var recipe = await _context.Recipes
            .Include(r => r.Categories)
            .FirstOrDefaultAsync(r => r.Id == id);

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
            InstructionSteps = recipe.InstructionSteps.Select(s => new InstructionStepDto { Text = s.Text, ImageUrl = s.ImageUrl }).ToList(),
            Categories = recipe.Categories.Select(c => new CategoryDto { Id = c.Id, Name = c.Name, Group = c.Group }).ToList(),
            CreatedAt = recipe.CreatedAt,
            UpdatedAt = recipe.UpdatedAt
        };

        return Ok(recipeDetail);
    }

    [HttpGet("/api/categories")]
    public async Task<ActionResult<List<CategoryDto>>> GetAllCategories()
    {
        var categories = await _context.Categories
            .OrderBy(c => c.Group)
            .ThenBy(c => c.Id)
            .Select(c => new CategoryDto { Id = c.Id, Name = c.Name, Group = c.Group })
            .ToListAsync();

        return Ok(categories);
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

        var categoryListJson = await BuildCategoryListJsonAsync();
        var result = await _imageProcessor.ExtractRecipeFromImageAsync(image, categoryListJson);

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

        var categoryListJson = await BuildCategoryListJsonAsync();
        var result = await _urlProcessor.ExtractRecipeFromUrlAsync(request.Url, categoryListJson);

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

        var categories = request.CategoryIds?.Count > 0
            ? await _context.Categories.Where(c => request.CategoryIds.Contains(c.Id)).ToListAsync()
            : new List<Category>();

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
            InstructionSteps = (request.InstructionSteps ?? new List<InstructionStepDto>())
                .Select(s => new InstructionStep { Text = s.Text, ImageUrl = s.ImageUrl }).ToList(),
            PrepTime = request.PrepTime,
            CookTimeMinutes = request.CookTime,
            CookTime = request.CookTime.HasValue ? $"{request.CookTime} min" : string.Empty,
            Servings = request.Servings,
            Difficulty = request.Difficulty ?? "Medium",
            ImageUrl = string.Empty,
            Categories = categories,
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
            ImageUrl = recipe.ImageUrl,
            Categories = recipe.Categories.Select(c => new CategoryDto { Id = c.Id, Name = c.Name, Group = c.Group }).ToList()
        };

        return CreatedAtAction(nameof(GetAllRecipes), new { id = recipe.Id }, recipeDto);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<RecipeDetailDto>> UpdateRecipe(int id, [FromBody] UpdateRecipeRequest request)
    {
        var recipe = await _context.Recipes
            .Include(r => r.Categories)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (recipe == null)
        {
            return NotFound(new { message = "Recipe not found" });
        }

        recipe.Title = request.Title;
        recipe.Description = request.Description ?? string.Empty;
        recipe.Ingredients = (request.Ingredients ?? new List<StructuredIngredientDto>())
            .Select(i => new StructuredIngredient
            {
                Quantity = i.Quantity,
                Unit = i.Unit,
                Name = i.Name
            }).ToList();
        recipe.InstructionSteps = (request.InstructionSteps ?? new List<InstructionStepDto>())
            .Select(s => new InstructionStep { Text = s.Text, ImageUrl = s.ImageUrl }).ToList();
        recipe.PrepTime = request.PrepTime;
        recipe.CookTimeMinutes = request.CookTime;
        recipe.CookTime = request.CookTime.HasValue ? $"{request.CookTime} min" : string.Empty;
        recipe.Servings = request.Servings;
        recipe.Difficulty = request.Difficulty ?? "Medium";
        recipe.UpdatedAt = DateTime.UtcNow;

        var newCategories = request.CategoryIds?.Count > 0
            ? await _context.Categories.Where(c => request.CategoryIds.Contains(c.Id)).ToListAsync()
            : new List<Category>();
        recipe.Categories.Clear();
        foreach (var cat in newCategories)
            recipe.Categories.Add(cat);

        await _context.SaveChangesAsync();

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
            InstructionSteps = recipe.InstructionSteps.Select(s => new InstructionStepDto { Text = s.Text, ImageUrl = s.ImageUrl }).ToList(),
            Categories = recipe.Categories.Select(c => new CategoryDto { Id = c.Id, Name = c.Name, Group = c.Group }).ToList(),
            CreatedAt = recipe.CreatedAt,
            UpdatedAt = recipe.UpdatedAt
        };

        return Ok(recipeDetail);
    }

    [HttpPut("{id:int}/main-image")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<RecipeDto>> UploadMainImage(int id, IFormFile image)
    {
        var recipe = await _context.Recipes.FindAsync(id);
        if (recipe == null) return NotFound(new { message = "Recipe not found" });

        var validation = ValidateImageFile(image);
        if (validation != null) return BadRequest(new { message = validation });

        // Delete old blob if present
        if (!string.IsNullOrEmpty(recipe.ImageUrl))
            await _blobStorage.DeleteAsync(BlobPathFromUrl(recipe.ImageUrl));

        var ext = Path.GetExtension(image.FileName).ToLowerInvariant();
        var blobPath = $"recipes/{id}/main/{Guid.NewGuid()}{ext}";

        using var stream = image.OpenReadStream();
        var url = await _blobStorage.UploadAsync(stream, blobPath, image.ContentType);

        recipe.ImageUrl = url;
        recipe.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new RecipeDto
        {
            Id = recipe.Id, Title = recipe.Title, Description = recipe.Description,
            CookTime = recipe.CookTime, Difficulty = recipe.Difficulty, ImageUrl = recipe.ImageUrl
        });
    }

    [HttpDelete("{id:int}/main-image")]
    public async Task<IActionResult> DeleteMainImage(int id)
    {
        var recipe = await _context.Recipes.FindAsync(id);
        if (recipe == null) return NotFound(new { message = "Recipe not found" });

        if (!string.IsNullOrEmpty(recipe.ImageUrl))
        {
            await _blobStorage.DeleteAsync(BlobPathFromUrl(recipe.ImageUrl));
            recipe.ImageUrl = null;
            recipe.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteRecipe(int id)
    {
        var recipe = await _context.Recipes.FindAsync(id);

        if (recipe == null)
        {
            return NotFound(new { message = "Recipe not found" });
        }

        _context.Recipes.Remove(recipe);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private string? ValidateImageFile(IFormFile? file)
    {
        if (file == null || file.Length == 0) return "No image file provided";
        if (file.Length > MaxImageBytes) return $"File size exceeds {MaxImageBytes / 1024 / 1024}MB limit";
        if (!AllowedImageContentTypes.Contains(file.ContentType.ToLowerInvariant())) return "Invalid file type. Allowed: JPEG, PNG, WEBP";
        return null;
    }

    /// <summary>Extracts the blob path from a full blob URL (everything after the container segment).</summary>
    private static string BlobPathFromUrl(string url)
    {
        // e.g. https://account.blob.core.windows.net/recipe-images/recipes/1/main/uuid.jpg
        // -> recipes/1/main/uuid.jpg
        var uri = new Uri(url);
        var segments = uri.AbsolutePath.TrimStart('/').Split('/', 2);
        return segments.Length == 2 ? segments[1] : uri.AbsolutePath.TrimStart('/');
    }

    private async Task<string> BuildCategoryListJsonAsync()
    {
        var categories = await _context.Categories
            .OrderBy(c => c.Group).ThenBy(c => c.Name)
            .Select(c => new { c.Id, c.Name, c.Group })
            .ToListAsync();

        return System.Text.Json.JsonSerializer.Serialize(categories);
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
        InstructionSteps = dto.Instructions.Select(text => new InstructionStepDto { Text = text }).ToList(),
        PrepTime = dto.PrepTime,
        CookTime = dto.CookTime,
        Servings = dto.Servings,
        Difficulty = dto.Difficulty,
        SuggestedCategoryIds = dto.SuggestedCategoryIds
    };
}

public class CategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
}

public class RecipeDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string CookTime { get; set; } = string.Empty;
    public string Difficulty { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public List<CategoryDto> Categories { get; set; } = new();
}

public class InstructionStepDto
{
    public string Text { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
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
    public string? ImageUrl { get; set; }
    public int? Servings { get; set; }
    public List<StructuredIngredientDto> Ingredients { get; set; } = new();
    public List<InstructionStepDto> InstructionSteps { get; set; } = new();
    public List<CategoryDto> Categories { get; set; } = new();
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
    public List<InstructionStepDto> InstructionSteps { get; set; } = new();
    public int? PrepTime { get; set; }
    public int? CookTime { get; set; }
    public int? Servings { get; set; }
    public string? Difficulty { get; set; }
    public List<int> SuggestedCategoryIds { get; set; } = new();
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
    public List<InstructionStepDto>? InstructionSteps { get; set; }
    public int? PrepTime { get; set; }
    public int? CookTime { get; set; }
    public int? Servings { get; set; }
    public string? Difficulty { get; set; }
    public List<int>? CategoryIds { get; set; }
}

public class UpdateRecipeRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<StructuredIngredientDto>? Ingredients { get; set; }
    public List<InstructionStepDto>? InstructionSteps { get; set; }
    public int? PrepTime { get; set; }
    public int? CookTime { get; set; }
    public int? Servings { get; set; }
    public string? Difficulty { get; set; }
    public List<int>? CategoryIds { get; set; }
}