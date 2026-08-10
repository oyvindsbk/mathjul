using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Features.Auth;
using RecipeApi.Features.Groups;
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
    private readonly IAdminService _adminService;
    private readonly ILogger<RecipesController> _logger;

    public RecipesController(
        RecipeDbContext context,
        IRecipeImageProcessor imageProcessor,
        IRecipeUrlProcessor urlProcessor,
        IBlobStorageService blobStorage,
        IAdminService adminService,
        ILogger<RecipesController> logger)
    {
        _context = context;
        _imageProcessor = imageProcessor;
        _urlProcessor = urlProcessor;
        _blobStorage = blobStorage;
        _adminService = adminService;
        _logger = logger;
    }

    private string? GetCallerEmail() =>
        User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
        ?? User.FindFirst("email")?.Value;

    private IQueryable<Recipe> ApplyVisibilityFilter(IQueryable<Recipe> query, string? callerEmail)
    {
        if (callerEmail != null && _adminService.IsAdmin(callerEmail))
            return query;

        return query.Where(r =>
            r.Visibility == "Public" ||
            (r.Visibility == "Private" && r.OwnerEmail == callerEmail) ||
            (r.Visibility == "Group" && r.Groups.Any(rg =>
                rg.Group.Members.Any(m => m.User.Email == callerEmail))));
    }

    [HttpGet]
    public async Task<ActionResult<List<RecipeDto>>> GetAllRecipes(
        [FromQuery] string? categories = null,
        [FromQuery] int? groupId = null)
    {
        var callerEmail = GetCallerEmail();

        IQueryable<Recipe> query = _context.Recipes
            .Include(r => r.Categories)
            .Include(r => r.Groups).ThenInclude(rg => rg.Group).ThenInclude(g => g.Members).ThenInclude(m => m.User);

        query = ApplyVisibilityFilter(query, callerEmail);

        if (groupId.HasValue)
            query = query.Where(r => r.Groups.Any(rg => rg.GroupId == groupId.Value));

        if (!string.IsNullOrWhiteSpace(categories))
        {
            var ids = categories.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(s => int.TryParse(s.Trim(), out var n) ? n : (int?)null)
                .Where(n => n.HasValue)
                .Select(n => n!.Value)
                .ToList();

            foreach (var categoryId in ids)
                query = query.Where(r => r.Categories.Any(c => c.Id == categoryId));
        }

        var likedIds = callerEmail != null
            ? await _context.RecipeLikes
                .Where(l => l.UserEmail == callerEmail)
                .Select(l => l.RecipeId)
                .ToHashSetAsync()
            : new HashSet<int>();

        var recipes = await query
            .Select(r => new RecipeDto
            {
                Id = r.Id,
                Title = r.Title,
                Description = r.Description,
                CookTime = r.CookTime,

                ImageUrl = r.ImageUrl,
                Visibility = r.Visibility,
                OwnerEmail = r.OwnerEmail,
                Categories = r.Categories.Select(c => new CategoryDto { Id = c.Id, Name = c.Name, Group = c.Group }).ToList(),
                Groups = r.Groups.Select(rg => new GroupRefDto { Id = rg.GroupId, Name = rg.Group.Name }).ToList()
            })
            .ToListAsync();

        foreach (var r in recipes)
            r.IsLikedByMe = likedIds.Contains(r.Id);

        return Ok(recipes);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<RecipeDetailDto>> GetRecipeById(int id)
    {
        var callerEmail = GetCallerEmail();

        var recipe = await _context.Recipes
            .Include(r => r.Categories)
            .Include(r => r.Groups).ThenInclude(rg => rg.Group).ThenInclude(g => g.Members).ThenInclude(m => m.User)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (recipe == null)
            return NotFound(new { message = "Recipe not found" });

        // Visibility check
        var isAdmin = callerEmail != null && _adminService.IsAdmin(callerEmail);
        var canView = isAdmin
            || recipe.Visibility == "Public"
            || (recipe.Visibility == "Private" && recipe.OwnerEmail == callerEmail)
            || (recipe.Visibility == "Group" && recipe.Groups.Any(rg =>
                rg.Group.Members.Any(m => m.User.Email == callerEmail)));

        if (!canView)
            return StatusCode(403, new { message = "You do not have access to this recipe" });

        var isLikedByMe = callerEmail != null
            && await _context.RecipeLikes.AnyAsync(l => l.RecipeId == id && l.UserEmail == callerEmail);

        var recipeDetail = new RecipeDetailDto
        {
            Id = recipe.Id,
            Title = recipe.Title,
            Description = recipe.Description,
            CookTime = recipe.CookTime,
            CookTimeMinutes = recipe.CookTimeMinutes,
            PrepTime = recipe.PrepTime,

            ImageUrl = recipe.ImageUrl,
            Servings = recipe.Servings,
            QuantityType = recipe.QuantityType,
            CustomUnit = recipe.CustomUnit,
            Visibility = recipe.Visibility,
            OwnerEmail = recipe.OwnerEmail,
            SourceUrl = recipe.SourceUrl,
            Ingredients = recipe.Ingredients.Select(i => new StructuredIngredientDto
            {
                Quantity = i.Quantity,
                Unit = i.Unit,
                Name = i.Name
            }).ToList(),
            InstructionSteps = recipe.InstructionSteps.Select(s => new InstructionStepDto { Text = s.Text, ImageUrl = s.ImageUrl }).ToList(),
            IngredientSections = recipe.IngredientSections.Select(s => new IngredientSectionDto
            {
                Heading = s.Heading,
                Ingredients = s.Ingredients.Select(i => new StructuredIngredientDto { Quantity = i.Quantity, Unit = i.Unit, Name = i.Name }).ToList()
            }).ToList(),
            InstructionSections = recipe.InstructionSections.Select(s => new InstructionSectionDto
            {
                Heading = s.Heading,
                Steps = s.Steps.Select(st => new InstructionStepDto { Text = st.Text, ImageUrl = st.ImageUrl }).ToList()
            }).ToList(),
            Categories = recipe.Categories.Select(c => new CategoryDto { Id = c.Id, Name = c.Name, Group = c.Group }).ToList(),
            Groups = recipe.Groups.Select(rg => new GroupRefDto { Id = rg.GroupId, Name = rg.Group.Name }).ToList(),
            Tips = recipe.Tips,
            CreatedAt = recipe.CreatedAt,
            UpdatedAt = recipe.UpdatedAt,
            IsLikedByMe = isLikedByMe
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

        // Attempt to extract/crop a dish photo from the image and store it in blob storage
        string? mainImageUrl = null;
        try
        {
            using var photoStream = new MemoryStream();
            await image.CopyToAsync(photoStream);
            var dishBytes = await _imageProcessor.TryExtractDishPhotoAsync(photoStream.ToArray());
            if (dishBytes != null)
            {
                var blobPath = $"recipes/pending/{Guid.NewGuid()}.jpg";
                using var dishStream = new MemoryStream(dishBytes);
                mainImageUrl = await _blobStorage.UploadAsync(dishStream, blobPath, "image/jpeg");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Dish photo extraction failed, continuing without main image");
        }

        // Upload original source image to blob storage for provenance
        string? sourceImageUrl = null;
        try
        {
            var ext = Path.GetExtension(image.FileName).ToLowerInvariant();
            if (string.IsNullOrEmpty(ext)) ext = ".jpg";
            var sourceBlobPath = $"recipes/pending/source-{Guid.NewGuid()}{ext}";
            using var sourceStream = image.OpenReadStream();
            sourceImageUrl = await _blobStorage.UploadAsync(sourceStream, sourceBlobPath, image.ContentType);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Source image upload failed, continuing without sourceImageUrl");
        }

        var extracted = MapToExtractedResponse(result.Recipe!);
        extracted.MainImageUrl = mainImageUrl;
        extracted.SourceImageUrl = sourceImageUrl;

        return Ok(new RecipeExtractionResponse { Success = true, ExtractedRecipe = extracted });
    }

    [HttpPost("from-images")]
    [RequestSizeLimit(50 * 1024 * 1024)] // 50MB for up to 5 images
    public async Task<ActionResult<RecipeExtractionResponse>> ExtractRecipeFromImages(IFormFileCollection images)
    {
        _logger.LogInformation("Received multi-image upload request: {Count} files", images?.Count ?? 0);

        if (images == null || images.Count == 0)
        {
            return BadRequest(new RecipeExtractionResponse { Success = false, ErrorMessage = "No image files provided" });
        }

        if (images.Count > 5)
        {
            return BadRequest(new RecipeExtractionResponse { Success = false, ErrorMessage = "Maximum 5 images allowed" });
        }

        var categoryListJson = await BuildCategoryListJsonAsync();
        var result = await _imageProcessor.ExtractRecipeFromImagesAsync(images.ToList().AsReadOnly(), categoryListJson);

        if (!result.IsSuccess)
        {
            return BadRequest(new RecipeExtractionResponse { Success = false, ErrorMessage = result.ErrorMessage });
        }

        // Dish photo: iterate images, use first positive detection
        string? mainImageUrl = null;
        try
        {
            foreach (var imageFile in images)
            {
                using var ms = new MemoryStream();
                await imageFile.CopyToAsync(ms);
                var dishBytes = await _imageProcessor.TryExtractDishPhotoAsync(ms.ToArray());
                if (dishBytes != null)
                {
                    var blobPath = $"recipes/pending/{Guid.NewGuid()}.jpg";
                    using var dishStream = new MemoryStream(dishBytes);
                    mainImageUrl = await _blobStorage.UploadAsync(dishStream, blobPath, "image/jpeg");
                    break;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Dish photo extraction failed, continuing without main image");
        }

        // Source provenance: store all source images, keep first URL as primary
        string? sourceImageUrl = null;
        try
        {
            foreach (var imageFile in images)
            {
                var ext = Path.GetExtension(imageFile.FileName).ToLowerInvariant();
                if (string.IsNullOrEmpty(ext)) ext = ".jpg";
                var sourceBlobPath = $"recipes/pending/source-{Guid.NewGuid()}{ext}";
                using var sourceStream = imageFile.OpenReadStream();
                var url = await _blobStorage.UploadAsync(sourceStream, sourceBlobPath, imageFile.ContentType);
                sourceImageUrl ??= url;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Source image upload failed, continuing without sourceImageUrl");
        }

        var extracted = MapToExtractedResponse(result.Recipe!);
        extracted.MainImageUrl = mainImageUrl;
        extracted.SourceImageUrl = sourceImageUrl;

        return Ok(new RecipeExtractionResponse { Success = true, ExtractedRecipe = extracted });
    }

    [HttpPost("from-images/stream")]
    [RequestSizeLimit(50 * 1024 * 1024)]
    public async Task ExtractRecipeFromImagesStream(IFormFileCollection images)
    {
        Response.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache";
        Response.Headers.Append("X-Accel-Buffering", "no");

        async Task SendEventAsync(string data)
        {
            await Response.WriteAsync($"data: {data}\n\n");
            await Response.Body.FlushAsync();
        }

        if (images == null || images.Count == 0)
        {
            await SendEventAsync("{\"stage\":\"error\",\"message\":\"No image files provided\"}");
            return;
        }

        if (images.Count > 5)
        {
            await SendEventAsync("{\"stage\":\"error\",\"message\":\"Maximum 5 images allowed\"}");
            return;
        }

        var categoryListJson = await BuildCategoryListJsonAsync();

        var result = await _imageProcessor.ExtractRecipeFromImagesAsync(
            images.ToList().AsReadOnly(),
            categoryListJson,
            reportStage: stage => SendEventAsync($"{{\"stage\":\"{stage}\"}}"),
            cancellationToken: HttpContext.RequestAborted);

        if (!result.IsSuccess)
        {
            var escaped = System.Text.Json.JsonSerializer.Serialize(result.ErrorMessage);
            await SendEventAsync($"{{\"stage\":\"error\",\"message\":{escaped}}}");
            return;
        }

        await SendEventAsync("{\"stage\":\"uploading_images\"}");

        string? mainImageUrl = null;
        try
        {
            foreach (var imageFile in images)
            {
                using var ms = new MemoryStream();
                await imageFile.CopyToAsync(ms);
                var dishBytes = await _imageProcessor.TryExtractDishPhotoAsync(ms.ToArray());
                if (dishBytes != null)
                {
                    var blobPath = $"recipes/pending/{Guid.NewGuid()}.jpg";
                    using var dishStream = new MemoryStream(dishBytes);
                    mainImageUrl = await _blobStorage.UploadAsync(dishStream, blobPath, "image/jpeg");
                    break;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Dish photo extraction failed, continuing without main image");
        }

        string? sourceImageUrl = null;
        try
        {
            foreach (var imageFile in images)
            {
                var ext = Path.GetExtension(imageFile.FileName).ToLowerInvariant();
                if (string.IsNullOrEmpty(ext)) ext = ".jpg";
                var sourceBlobPath = $"recipes/pending/source-{Guid.NewGuid()}{ext}";
                using var sourceStream = imageFile.OpenReadStream();
                var url = await _blobStorage.UploadAsync(sourceStream, sourceBlobPath, imageFile.ContentType);
                sourceImageUrl ??= url;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Source image upload failed, continuing without sourceImageUrl");
        }

        var extracted = MapToExtractedResponse(result.Recipe!);
        extracted.MainImageUrl = mainImageUrl;
        extracted.SourceImageUrl = sourceImageUrl;

        var payload = System.Text.Json.JsonSerializer.Serialize(new RecipeExtractionResponse { Success = true, ExtractedRecipe = extracted },
            new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase });
        await SendEventAsync($"{{\"stage\":\"done\",\"result\":{payload}}}");
    }

    [HttpPost("from-url/stream")]
    public async Task ExtractRecipeFromUrlStream([FromBody] ExtractFromUrlRequest request)
    {
        Response.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache";
        Response.Headers.Append("X-Accel-Buffering", "no");

        async Task SendEventAsync(string data)
        {
            await Response.WriteAsync($"data: {data}\n\n");
            await Response.Body.FlushAsync();
        }

        if (string.IsNullOrWhiteSpace(request.Url))
        {
            await SendEventAsync("{\"stage\":\"error\",\"message\":\"No URL provided\"}");
            return;
        }

        var categoryListJson = await BuildCategoryListJsonAsync();

        var result = await _urlProcessor.ExtractRecipeFromUrlAsync(
            request.Url,
            categoryListJson,
            reportStage: stage => SendEventAsync($"{{\"stage\":\"{stage}\"}}"),
            cancellationToken: HttpContext.RequestAborted);

        if (!result.IsSuccess)
        {
            var escaped = System.Text.Json.JsonSerializer.Serialize(result.ErrorMessage);
            await SendEventAsync($"{{\"stage\":\"error\",\"message\":{escaped}}}");
            return;
        }

        var extractedFromUrl = MapToExtractedResponse(result.Recipe!);
        extractedFromUrl.SourceUrl = request.Url;
        extractedFromUrl.MainImageUrl = result.MainImageUrl;

        var payload = System.Text.Json.JsonSerializer.Serialize(new RecipeExtractionResponse { Success = true, ExtractedRecipe = extractedFromUrl },
            new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase });
        await SendEventAsync($"{{\"stage\":\"done\",\"result\":{payload}}}");
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

        var extractedFromUrl = MapToExtractedResponse(result.Recipe!);
        extractedFromUrl.SourceUrl = request.Url;
        extractedFromUrl.MainImageUrl = result.MainImageUrl;

        return Ok(new RecipeExtractionResponse
        {
            Success = true,
            ExtractedRecipe = extractedFromUrl
        });
    }

    [HttpPost("save-extracted")]
    public async Task<ActionResult<RecipeDto>> SaveExtractedRecipe([FromBody] SaveExtractedRecipeRequest request)
    {
        _logger.LogInformation("Saving extracted recipe: {Title}", request.Title);

        var callerEmail = GetCallerEmail();

        var categories = request.CategoryIds?.Count > 0
            ? await _context.Categories.Where(c => request.CategoryIds.Contains(c.Id)).ToListAsync()
            : new List<Category>();

        var visibility = request.Visibility ?? "Public";

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
            IngredientSections = (request.IngredientSections ?? new List<IngredientSectionDto>())
                .Select(s => new IngredientSection
                {
                    Heading = s.Heading,
                    Ingredients = s.Ingredients.Select(i => new StructuredIngredient { Quantity = i.Quantity, Unit = i.Unit, Name = i.Name }).ToList()
                }).ToList(),
            InstructionSections = (request.InstructionSections ?? new List<InstructionSectionDto>())
                .Select(s => new InstructionSection
                {
                    Heading = s.Heading,
                    Steps = s.Steps.Select(st => new InstructionStep { Text = st.Text, ImageUrl = st.ImageUrl }).ToList()
                }).ToList(),
            PrepTime = request.PrepTime,
            CookTimeMinutes = request.CookTime,
            CookTime = request.CookTime.HasValue ? $"{request.CookTime} min" : string.Empty,
            Servings = request.Servings,
            QuantityType = request.QuantityType,
            CustomUnit = request.CustomUnit,
            ImageUrl = request.MainImageUrl,
            SourceUrl = request.SourceUrl,
            SourceImageUrl = request.SourceImageUrl,
            Categories = categories,
            Visibility = visibility,
            OwnerEmail = callerEmail,
            Tips = request.Tips ?? new List<string>(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Recipes.Add(recipe);
        await _context.SaveChangesAsync();

        // Associate groups after recipe is saved (need recipe.Id)
        if (visibility == "Group" && request.GroupIds?.Count > 0)
        {
            foreach (var gid in request.GroupIds)
            {
                _context.RecipeGroups.Add(new RecipeGroup { RecipeId = recipe.Id, GroupId = gid });
            }
            await _context.SaveChangesAsync();
        }

        var recipeDto = new RecipeDto
        {
            Id = recipe.Id,
            Title = recipe.Title,
            Description = recipe.Description,
            CookTime = recipe.CookTime,

            ImageUrl = recipe.ImageUrl,
            Visibility = recipe.Visibility,
            OwnerEmail = recipe.OwnerEmail,
            Categories = recipe.Categories.Select(c => new CategoryDto { Id = c.Id, Name = c.Name, Group = c.Group }).ToList()
        };

        return CreatedAtAction(nameof(GetAllRecipes), new { id = recipe.Id }, recipeDto);
    }

    /// <summary>
    /// Validates side-dish ids against the tilbehør rules. Returns an error message, or null if valid.
    /// <paramref name="selfId"/> is null when creating, where no self-reference is possible yet.
    /// <paramref name="newCategories"/> is the incoming category set, not the persisted one, so that
    /// dropping side dishes and marking the recipe as Tilbehør in the same request is accepted.
    /// </summary>
    private async Task<string?> ValidateSideDishesAsync(int? selfId, List<int> sideDishIds, List<Category> newCategories)
    {
        if (sideDishIds.Count == 0)
            return null;

        if (newCategories.Any(c => c.Id == RecipeCategories.TilbehorId))
            return "En oppskrift som er merket Tilbehør kan ikke ha tilbehør selv.";

        if (selfId.HasValue && sideDishIds.Contains(selfId.Value))
            return "En oppskrift kan ikke være tilbehør til seg selv.";

        var distinctIds = sideDishIds.Distinct().ToList();

        var found = await _context.Recipes
            .Where(r => distinctIds.Contains(r.Id))
            .Select(r => new
            {
                r.Id,
                r.Title,
                IsTilbehor = r.Categories.Any(c => c.Id == RecipeCategories.TilbehorId)
            })
            .ToListAsync();

        if (found.Count != distinctIds.Count)
            return "En eller flere av de valgte oppskriftene finnes ikke.";

        var notTilbehor = found.Where(f => !f.IsTilbehor).Select(f => f.Title).ToList();
        if (notTilbehor.Count > 0)
            return $"Følgende oppskrifter er ikke merket Tilbehør: {string.Join(", ", notTilbehor)}.";

        return null;
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<RecipeDetailDto>> UpdateRecipe(int id, [FromBody] UpdateRecipeRequest request)
    {
        var callerEmail = GetCallerEmail();

        var recipe = await _context.Recipes
            .Include(r => r.Categories)
            .Include(r => r.Groups)
            .Include(r => r.SideDishes)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (recipe == null)
            return NotFound(new { message = "Recipe not found" });

        var isAdmin = callerEmail != null && _adminService.IsAdmin(callerEmail);
        if (!isAdmin && recipe.OwnerEmail != callerEmail)
            return StatusCode(403, new { message = "You do not have permission to edit this recipe" });

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
        recipe.IngredientSections = (request.IngredientSections ?? new List<IngredientSectionDto>())
            .Select(s => new IngredientSection
            {
                Heading = s.Heading,
                Ingredients = s.Ingredients.Select(i => new StructuredIngredient { Quantity = i.Quantity, Unit = i.Unit, Name = i.Name }).ToList()
            }).ToList();
        recipe.InstructionSections = (request.InstructionSections ?? new List<InstructionSectionDto>())
            .Select(s => new InstructionSection
            {
                Heading = s.Heading,
                Steps = s.Steps.Select(st => new InstructionStep { Text = st.Text, ImageUrl = st.ImageUrl }).ToList()
            }).ToList();
        recipe.PrepTime = request.PrepTime;
        recipe.CookTimeMinutes = request.CookTime;
        recipe.CookTime = request.CookTime.HasValue ? $"{request.CookTime} min" : string.Empty;
        recipe.Servings = request.Servings;
        recipe.QuantityType = request.QuantityType;
        recipe.CustomUnit = request.CustomUnit;
        recipe.Tips = request.Tips ?? new List<string>();
        recipe.UpdatedAt = DateTime.UtcNow;

        var newCategories = request.CategoryIds?.Count > 0
            ? await _context.Categories.Where(c => request.CategoryIds.Contains(c.Id)).ToListAsync()
            : new List<Category>();

        var sideDishIds = (request.SideDishIds ?? new List<int>()).Distinct().ToList();
        var sideDishError = await ValidateSideDishesAsync(id, sideDishIds, newCategories);
        if (sideDishError != null)
            return BadRequest(new { message = sideDishError });

        var wasTilbehor = recipe.Categories.Any(c => c.Id == RecipeCategories.TilbehorId);
        var isTilbehor = newCategories.Any(c => c.Id == RecipeCategories.TilbehorId);

        recipe.Categories.Clear();
        foreach (var cat in newCategories)
            recipe.Categories.Add(cat);

        // Replace side dishes; list order becomes SortOrder.
        recipe.SideDishes.Clear();
        var sideDishOrder = 0;
        foreach (var sideDishId in sideDishIds)
            recipe.SideDishes.Add(new RecipeSideDish
            {
                RecipeId = recipe.Id,
                SideDishRecipeId = sideDishId,
                SortOrder = sideDishOrder++
            });

        // Dropping the Tilbehør mark detaches this recipe from every main dish using it,
        // so "everything in SideDishes is a Tilbehør" stays true at all times.
        if (wasTilbehor && !isTilbehor)
        {
            var reverseLinks = await _context.RecipeSideDishes
                .Where(sd => sd.SideDishRecipeId == id)
                .ToListAsync();
            _context.RecipeSideDishes.RemoveRange(reverseLinks);
        }

        // Update visibility and groups
        recipe.Visibility = request.Visibility ?? recipe.Visibility;
        recipe.Groups.Clear();
        if (recipe.Visibility == "Group" && request.GroupIds?.Count > 0)
        {
            foreach (var gid in request.GroupIds)
                recipe.Groups.Add(new RecipeGroup { RecipeId = recipe.Id, GroupId = gid });
        }

        await _context.SaveChangesAsync();

        // Reload groups with names for the response
        await _context.Entry(recipe).Collection(r => r.Groups).Query()
            .Include(rg => rg.Group)
            .LoadAsync();

        // Reload side dishes with titles for the response
        await _context.Entry(recipe).Collection(r => r.SideDishes).Query()
            .Include(sd => sd.SideDishRecipe)
            .LoadAsync();

        var recipeDetail = new RecipeDetailDto
        {
            Id = recipe.Id,
            Title = recipe.Title,
            Description = recipe.Description,
            CookTime = recipe.CookTime,
            CookTimeMinutes = recipe.CookTimeMinutes,
            PrepTime = recipe.PrepTime,

            ImageUrl = recipe.ImageUrl,
            Servings = recipe.Servings,
            QuantityType = recipe.QuantityType,
            CustomUnit = recipe.CustomUnit,
            Visibility = recipe.Visibility,
            OwnerEmail = recipe.OwnerEmail,
            SourceUrl = recipe.SourceUrl,
            Ingredients = recipe.Ingredients.Select(i => new StructuredIngredientDto
            {
                Quantity = i.Quantity,
                Unit = i.Unit,
                Name = i.Name
            }).ToList(),
            InstructionSteps = recipe.InstructionSteps.Select(s => new InstructionStepDto { Text = s.Text, ImageUrl = s.ImageUrl }).ToList(),
            IngredientSections = recipe.IngredientSections.Select(s => new IngredientSectionDto
            {
                Heading = s.Heading,
                Ingredients = s.Ingredients.Select(i => new StructuredIngredientDto { Quantity = i.Quantity, Unit = i.Unit, Name = i.Name }).ToList()
            }).ToList(),
            InstructionSections = recipe.InstructionSections.Select(s => new InstructionSectionDto
            {
                Heading = s.Heading,
                Steps = s.Steps.Select(st => new InstructionStepDto { Text = st.Text, ImageUrl = st.ImageUrl }).ToList()
            }).ToList(),
            Categories = recipe.Categories.Select(c => new CategoryDto { Id = c.Id, Name = c.Name, Group = c.Group }).ToList(),
            Groups = recipe.Groups.Select(rg => new GroupRefDto { Id = rg.GroupId, Name = rg.Group.Name }).ToList(),
            Tips = recipe.Tips,
            SideDishes = recipe.SideDishes
                .OrderBy(sd => sd.SortOrder)
                .Select(sd => new RecipeRefDto
                {
                    Id = sd.SideDishRecipe.Id,
                    Title = sd.SideDishRecipe.Title,
                    ImageUrl = sd.SideDishRecipe.ImageUrl
                }).ToList(),
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
            CookTime = recipe.CookTime, ImageUrl = recipe.ImageUrl
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

    [HttpPut("{id:int}/steps/{stepIndex:int}/image")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<InstructionStepDto>> UploadStepImage(int id, int stepIndex, IFormFile image)
    {
        var recipe = await _context.Recipes.FindAsync(id);
        if (recipe == null) return NotFound(new { message = "Recipe not found" });
        if (stepIndex < 0 || stepIndex >= recipe.InstructionSteps.Count)
            return BadRequest(new { message = $"Step index {stepIndex} is out of range" });

        var validation = ValidateImageFile(image);
        if (validation != null) return BadRequest(new { message = validation });

        var step = recipe.InstructionSteps[stepIndex];

        // Delete old step image blob if present
        if (!string.IsNullOrEmpty(step.ImageUrl))
            await _blobStorage.DeleteAsync(BlobPathFromUrl(step.ImageUrl));

        var ext = Path.GetExtension(image.FileName).ToLowerInvariant();
        var blobPath = $"recipes/{id}/steps/{stepIndex}/{Guid.NewGuid()}{ext}";

        using var stream = image.OpenReadStream();
        var url = await _blobStorage.UploadAsync(stream, blobPath, image.ContentType);

        step.ImageUrl = url;
        recipe.UpdatedAt = DateTime.UtcNow;
        // Mark InstructionSteps as modified (JSON column — EF needs explicit signal)
        _context.Entry(recipe).Property(r => r.InstructionSteps).IsModified = true;
        await _context.SaveChangesAsync();

        return Ok(new InstructionStepDto { Text = step.Text, ImageUrl = step.ImageUrl });
    }

    [HttpDelete("{id:int}/steps/{stepIndex:int}/image")]
    public async Task<IActionResult> DeleteStepImage(int id, int stepIndex)
    {
        var recipe = await _context.Recipes.FindAsync(id);
        if (recipe == null) return NotFound(new { message = "Recipe not found" });
        if (stepIndex < 0 || stepIndex >= recipe.InstructionSteps.Count)
            return BadRequest(new { message = $"Step index {stepIndex} is out of range" });

        var step = recipe.InstructionSteps[stepIndex];

        if (!string.IsNullOrEmpty(step.ImageUrl))
        {
            await _blobStorage.DeleteAsync(BlobPathFromUrl(step.ImageUrl));
            step.ImageUrl = null;
            recipe.UpdatedAt = DateTime.UtcNow;
            _context.Entry(recipe).Property(r => r.InstructionSteps).IsModified = true;
            await _context.SaveChangesAsync();
        }

        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteRecipe(int id)
    {
        var callerEmail = GetCallerEmail();
        var recipe = await _context.Recipes.FindAsync(id);

        if (recipe == null)
            return NotFound(new { message = "Recipe not found" });

        var isAdmin = callerEmail != null && _adminService.IsAdmin(callerEmail);
        if (!isAdmin && recipe.OwnerEmail != callerEmail)
            return StatusCode(403, new { message = "You do not have permission to delete this recipe" });

        // Delete all blobs for this recipe (main image + all step images)
        await _blobStorage.DeleteByPrefixAsync($"recipes/{id}/");

        // Remove meal plan entries referencing this recipe before deleting
        var mealPlanEntries = await _context.MealPlans.Where(mp => mp.RecipeId == id).ToListAsync();
        _context.MealPlans.RemoveRange(mealPlanEntries);

        _context.Recipes.Remove(recipe);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // ── Like / Favourite endpoints ─────────────────────────────────────────

    [HttpGet("newest")]
    public async Task<ActionResult<List<RecipeDto>>> GetNewestRecipes([FromQuery] int take = 8)
    {
        var callerEmail = GetCallerEmail();

        IQueryable<Recipe> query = _context.Recipes
            .Include(r => r.Categories)
            .Include(r => r.Groups).ThenInclude(rg => rg.Group).ThenInclude(g => g.Members).ThenInclude(m => m.User);

        query = ApplyVisibilityFilter(query, callerEmail);

        var likedIds = callerEmail != null
            ? await _context.RecipeLikes
                .Where(l => l.UserEmail == callerEmail)
                .Select(l => l.RecipeId)
                .ToHashSetAsync()
            : new HashSet<int>();

        var recipes = await query
            .OrderByDescending(r => r.CreatedAt)
            .Take(take)
            .Select(r => new RecipeDto
            {
                Id = r.Id,
                Title = r.Title,
                Description = r.Description,
                CookTime = r.CookTime,

                ImageUrl = r.ImageUrl,
                Visibility = r.Visibility,
                OwnerEmail = r.OwnerEmail,
                Categories = r.Categories.Select(c => new CategoryDto { Id = c.Id, Name = c.Name, Group = c.Group }).ToList(),
                Groups = r.Groups.Select(rg => new GroupRefDto { Id = rg.GroupId, Name = rg.Group.Name }).ToList()
            })
            .ToListAsync();

        foreach (var r in recipes)
            r.IsLikedByMe = likedIds.Contains(r.Id);

        return Ok(recipes);
    }

    [HttpGet("liked")]
    public async Task<ActionResult<List<RecipeDto>>> GetLikedRecipes()
    {
        var callerEmail = GetCallerEmail();
        if (callerEmail == null)
            return Unauthorized(new { message = "Authentication required" });

        var likedRecipeIds = await _context.RecipeLikes
            .Where(l => l.UserEmail == callerEmail)
            .Select(l => l.RecipeId)
            .ToListAsync();

        IQueryable<Recipe> query = _context.Recipes
            .Include(r => r.Categories)
            .Include(r => r.Groups).ThenInclude(rg => rg.Group).ThenInclude(g => g.Members).ThenInclude(m => m.User)
            .Where(r => likedRecipeIds.Contains(r.Id));

        query = ApplyVisibilityFilter(query, callerEmail);

        var recipes = await query
            .Select(r => new RecipeDto
            {
                Id = r.Id,
                Title = r.Title,
                Description = r.Description,
                CookTime = r.CookTime,

                ImageUrl = r.ImageUrl,
                Visibility = r.Visibility,
                OwnerEmail = r.OwnerEmail,
                Categories = r.Categories.Select(c => new CategoryDto { Id = c.Id, Name = c.Name, Group = c.Group }).ToList(),
                Groups = r.Groups.Select(rg => new GroupRefDto { Id = rg.GroupId, Name = rg.Group.Name }).ToList(),
                IsLikedByMe = true
            })
            .ToListAsync();

        return Ok(recipes);
    }

    [HttpPost("{id:int}/like")]
    public async Task<IActionResult> LikeRecipe(int id)
    {
        var callerEmail = GetCallerEmail();
        if (callerEmail == null)
            return Unauthorized(new { message = "Authentication required" });

        var recipe = await _context.Recipes.FindAsync(id);
        if (recipe == null)
            return NotFound(new { message = "Recipe not found" });

        var existing = await _context.RecipeLikes
            .FirstOrDefaultAsync(l => l.RecipeId == id && l.UserEmail == callerEmail);

        if (existing == null)
        {
            _context.RecipeLikes.Add(new RecipeLike { RecipeId = id, UserEmail = callerEmail, LikedAt = DateTime.UtcNow });
            await _context.SaveChangesAsync();
        }

        return Ok();
    }

    [HttpDelete("{id:int}/like")]
    public async Task<IActionResult> UnlikeRecipe(int id)
    {
        var callerEmail = GetCallerEmail();
        if (callerEmail == null)
            return Unauthorized(new { message = "Authentication required" });

        var existing = await _context.RecipeLikes
            .FirstOrDefaultAsync(l => l.RecipeId == id && l.UserEmail == callerEmail);

        if (existing != null)
        {
            _context.RecipeLikes.Remove(existing);
            await _context.SaveChangesAsync();
        }

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
        IngredientSections = dto.IngredientSections.Select(s => new IngredientSectionDto
        {
            Heading = s.Heading,
            Ingredients = s.Ingredients.Select(i => new StructuredIngredientDto { Quantity = i.Quantity, Unit = i.Unit, Name = i.Name }).ToList()
        }).ToList(),
        InstructionSections = dto.InstructionSections.Select(s => new InstructionSectionDto
        {
            Heading = s.Heading,
            Steps = s.Steps.Select(st => new InstructionStepDto { Text = st }).ToList()
        }).ToList(),
        PrepTime = dto.PrepTime,
        CookTime = dto.CookTime,
        Servings = dto.Servings,
        QuantityType = dto.QuantityType,
        CustomUnit = dto.CustomUnit,
        SuggestedCategoryIds = dto.SuggestedCategoryIds,
        Tips = dto.Tips
    };
}

public class CategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
}

public class GroupRefDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

/// <summary>Lightweight reference to a recipe used in a side-dish (tilbehør) relationship.</summary>
public class RecipeRefDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
}

public class RecipeDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string CookTime { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public string Visibility { get; set; } = "Public";
    public string? OwnerEmail { get; set; }
    public List<CategoryDto> Categories { get; set; } = new();
    public List<GroupRefDto> Groups { get; set; } = new();
    public bool IsLikedByMe { get; set; }
}

public class InstructionStepDto
{
    public string Text { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
}

public class IngredientSectionDto
{
    public string Heading { get; set; } = string.Empty;
    public List<StructuredIngredientDto> Ingredients { get; set; } = new();
}

public class InstructionSectionDto
{
    public string Heading { get; set; } = string.Empty;
    public List<InstructionStepDto> Steps { get; set; } = new();
}

public class RecipeDetailDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string CookTime { get; set; } = string.Empty;
    public int? CookTimeMinutes { get; set; }
    public int? PrepTime { get; set; }
    public string? ImageUrl { get; set; }
    public double? Servings { get; set; }
    public string QuantityType { get; set; } = "porsjoner";
    public string? CustomUnit { get; set; }
    public string Visibility { get; set; } = "Public";
    public string? OwnerEmail { get; set; }
    public List<StructuredIngredientDto> Ingredients { get; set; } = new();
    public List<InstructionStepDto> InstructionSteps { get; set; } = new();
    public List<IngredientSectionDto> IngredientSections { get; set; } = new();
    public List<InstructionSectionDto> InstructionSections { get; set; } = new();
    public List<CategoryDto> Categories { get; set; } = new();
    public List<GroupRefDto> Groups { get; set; } = new();
    public List<string> Tips { get; set; } = new();
    /// <summary>Side dishes attached to this recipe, in SortOrder.</summary>
    public List<RecipeRefDto> SideDishes { get; set; } = new();
    /// <summary>Recipes this one is attached to as a side dish. Read-only.</summary>
    public List<RecipeRefDto> UsedAsSideDishIn { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string? SourceUrl { get; set; }
    public bool IsLikedByMe { get; set; }
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
    public List<IngredientSectionDto> IngredientSections { get; set; } = new();
    public List<InstructionSectionDto> InstructionSections { get; set; } = new();
    public int? PrepTime { get; set; }
    public int? CookTime { get; set; }
    public double? Servings { get; set; }
    public string QuantityType { get; set; } = "porsjoner";
    public string? CustomUnit { get; set; }
    public List<int> SuggestedCategoryIds { get; set; } = new();
    public List<string> Tips { get; set; } = new();
    /// <summary>Blob URL of the AI-extracted dish photo, if detected.</summary>
    public string? MainImageUrl { get; set; }
    /// <summary>Blob URL of the original uploaded source image.</summary>
    public string? SourceImageUrl { get; set; }
    /// <summary>Original URL the recipe was extracted from (URL mode).</summary>
    public string? SourceUrl { get; set; }
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
    public List<IngredientSectionDto>? IngredientSections { get; set; }
    public List<InstructionSectionDto>? InstructionSections { get; set; }
    public int? PrepTime { get; set; }
    public int? CookTime { get; set; }
    public double? Servings { get; set; }
    public string QuantityType { get; set; } = "porsjoner";
    public string? CustomUnit { get; set; }
    public List<int>? CategoryIds { get; set; }
    public List<string>? Tips { get; set; }
    /// <summary>Pre-uploaded blob URL from AI dish extraction (pending blob path will be renamed on save).</summary>
    public string? MainImageUrl { get; set; }
    /// <summary>Original URL the recipe was extracted from (URL mode).</summary>
    public string? SourceUrl { get; set; }
    /// <summary>Blob URL of the original uploaded source image (image mode).</summary>
    public string? SourceImageUrl { get; set; }
    public string? Visibility { get; set; }
    public List<int>? GroupIds { get; set; }
    /// <summary>Ids of Tilbehør-marked recipes to attach. List order becomes SortOrder.</summary>
    public List<int>? SideDishIds { get; set; }
}

public class UpdateRecipeRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<StructuredIngredientDto>? Ingredients { get; set; }
    public List<InstructionStepDto>? InstructionSteps { get; set; }
    public List<IngredientSectionDto>? IngredientSections { get; set; }
    public List<InstructionSectionDto>? InstructionSections { get; set; }
    public int? PrepTime { get; set; }
    public int? CookTime { get; set; }
    public double? Servings { get; set; }
    public string QuantityType { get; set; } = "porsjoner";
    public string? CustomUnit { get; set; }
    public List<int>? CategoryIds { get; set; }
    public List<string>? Tips { get; set; }
    public string? Visibility { get; set; }
    public List<int>? GroupIds { get; set; }
    /// <summary>Ids of Tilbehør-marked recipes to attach. List order becomes SortOrder.</summary>
    public List<int>? SideDishIds { get; set; }
}