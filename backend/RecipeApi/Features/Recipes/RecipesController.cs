using System.Security.Cryptography;
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
    private readonly IConfiguration _configuration;
    private readonly ILogger<RecipesController> _logger;

    public RecipesController(
        RecipeDbContext context,
        IRecipeImageProcessor imageProcessor,
        IRecipeUrlProcessor urlProcessor,
        IBlobStorageService blobStorage,
        IAdminService adminService,
        IConfiguration configuration,
        ILogger<RecipesController> logger)
    {
        _context = context;
        _imageProcessor = imageProcessor;
        _urlProcessor = urlProcessor;
        _blobStorage = blobStorage;
        _adminService = adminService;
        _configuration = configuration;
        _logger = logger;
    }

    private string? GetCallerEmail() =>
        User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
        ?? User.FindFirst("email")?.Value;

    /// <summary>
    /// Fills OwnerDisplayName/OwnerUserId on already-projected recipes.
    ///
    /// Recipes store the owner as an email with no foreign key to Users, so the join
    /// happens here instead of in the projection: one lookup for the whole page rather
    /// than one per recipe. Owners with no Users row (seed data, removed accounts) keep
    /// a null id and fall back to the email as their name.
    /// </summary>
    private async Task PopulateOwnerDisplayAsync(IReadOnlyCollection<RecipeDto> recipes)
    {
        var emails = recipes
            .Select(r => r.OwnerEmail)
            .Where(e => !string.IsNullOrEmpty(e))
            .Select(e => e!)
            .Distinct()
            .ToList();

        if (emails.Count == 0)
            return;

        var owners = await _context.Users
            .AsNoTracking()
            .Where(u => emails.Contains(u.Email))
            .Select(u => new { u.Id, u.Email, u.Nickname, u.Name, u.DisplayName })
            .ToListAsync();

        var byEmail = owners.ToDictionary(u => u.Email, StringComparer.OrdinalIgnoreCase);

        foreach (var recipe in recipes)
        {
            if (string.IsNullOrEmpty(recipe.OwnerEmail))
                continue;

            if (byEmail.TryGetValue(recipe.OwnerEmail, out var owner))
            {
                recipe.OwnerUserId = owner.Id;
                recipe.OwnerDisplayName = UserDisplayName.Resolve(
                    owner.Nickname, owner.Name, owner.DisplayName, owner.Email);
            }
            else
            {
                // No Users row (seed data, removed account) — still route through the
                // resolver so no listing hands out a full address.
                recipe.OwnerDisplayName = UserDisplayName.Resolve(null, null, null, recipe.OwnerEmail);
            }
        }
    }

    /// <summary>
    /// Recipes owned by <paramref name="ownerEmail"/>, newest first, projected to DTOs.
    ///
    /// When <paramref name="viewerEmail"/> is given the result is additionally narrowed to
    /// what that viewer may see; pass null only when the owner is the viewer.
    /// </summary>
    private IQueryable<RecipeDto> OwnedByQuery(string ownerEmail, string? viewerEmail = null)
    {
        IQueryable<Recipe> query = _context.Recipes
            .AsNoTracking()
            .Include(r => r.Categories)
            .Include(r => r.Groups).ThenInclude(rg => rg.Group).ThenInclude(g => g.Members).ThenInclude(m => m.User)
            .Where(r => r.OwnerEmail == ownerEmail);

        if (viewerEmail != null)
            query = ApplyVisibilityFilter(query, viewerEmail);

        return query
            .OrderByDescending(r => r.CreatedAt)
            .ThenByDescending(r => r.Id)
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
            });
    }

    /// <summary>
    /// Marks which recipes the caller has liked. Always keyed on the caller so a profile
    /// page shows the viewer's own hearts, not the profile owner's.
    /// </summary>
    private async Task ApplyLikesAsync(IReadOnlyCollection<RecipeDto> recipes, string callerEmail)
    {
        if (recipes.Count == 0)
            return;

        var ids = recipes.Select(r => r.Id).ToList();
        var likedIds = await _context.RecipeLikes
            .Where(l => l.UserEmail == callerEmail && ids.Contains(l.RecipeId))
            .Select(l => l.RecipeId)
            .ToHashSetAsync();

        foreach (var recipe in recipes)
            recipe.IsLikedByMe = likedIds.Contains(recipe.Id);
    }

    /// <summary>Single-recipe counterpart to <see cref="PopulateOwnerDisplayAsync"/>.</summary>
    private async Task PopulateOwnerDisplayAsync(RecipeDetailDto recipe)
    {
        if (string.IsNullOrEmpty(recipe.OwnerEmail))
            return;

        var owner = await _context.Users
            .AsNoTracking()
            .Where(u => u.Email == recipe.OwnerEmail)
            .Select(u => new { u.Id, u.Email, u.Nickname, u.Name, u.DisplayName })
            .FirstOrDefaultAsync();

        if (owner == null)
        {
            recipe.OwnerDisplayName = UserDisplayName.Resolve(null, null, null, recipe.OwnerEmail);
            return;
        }

        recipe.OwnerUserId = owner.Id;
        recipe.OwnerDisplayName = UserDisplayName.Resolve(
            owner.Nickname, owner.Name, owner.DisplayName, owner.Email);
    }

    private IQueryable<Recipe> ApplyVisibilityFilter(IQueryable<Recipe> query, string? callerEmail) =>
        query.VisibleTo(callerEmail, callerEmail != null && _adminService.IsAdmin(callerEmail));

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

            // Innenfor samme kategorigruppe (f.eks. Måltidstype) er valgene et
            // ELLER-filter, mens ulike grupper kombineres med OG: velger du
            // "Lunsj" + "Middag" + "Enkel" får du enkle lunsj- og middagsretter.
            if (ids.Count > 0)
            {
                var idsByGroup = await _context.Categories
                    .Where(c => ids.Contains(c.Id))
                    .GroupBy(c => c.Group)
                    .Select(g => new { Group = g.Key, Ids = g.Select(c => c.Id).ToList() })
                    .ToListAsync();

                foreach (var group in idsByGroup)
                {
                    var groupIds = group.Ids;
                    query = query.Where(r => r.Categories.Any(c => groupIds.Contains(c.Id)));
                }

                // Ukjente id-er tilhører ingen gruppe; da skal ingenting matche.
                if (idsByGroup.Count == 0)
                    query = query.Where(r => false);
            }
        }

        var likedIds = callerEmail != null
            ? await _context.RecipeLikes
                .Where(l => l.UserEmail == callerEmail)
                .Select(l => l.RecipeId)
                .ToHashSetAsync()
            : new HashSet<int>();

        var recipes = await query
            .OrderByDescending(r => r.CreatedAt)
            .ThenByDescending(r => r.Id)
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

        await PopulateOwnerDisplayAsync(recipes);

        return Ok(recipes);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<RecipeDetailDto>> GetRecipeById(int id)
    {
        var callerEmail = GetCallerEmail();

        var recipe = await _context.Recipes
            .Include(r => r.Categories)
            .Include(r => r.Groups).ThenInclude(rg => rg.Group).ThenInclude(g => g.Members).ThenInclude(m => m.User)
            .Include(r => r.SideDishes).ThenInclude(sd => sd.SideDishRecipe)
            .Include(r => r.UsedAsSideDishIn).ThenInclude(sd => sd.Recipe)
            .AsSplitQuery()
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
            SideDishes = recipe.SideDishes
                .OrderBy(sd => sd.SortOrder)
                .Select(sd => new RecipeRefDto
                {
                    Id = sd.SideDishRecipe.Id,
                    Title = sd.SideDishRecipe.Title,
                    ImageUrl = sd.SideDishRecipe.ImageUrl
                }).ToList(),
            // Reverse lookup is visibility-filtered so a private main dish's title
            // cannot leak through a public tilbehør.
            UsedAsSideDishIn = recipe.UsedAsSideDishIn
                .Where(sd => isAdmin
                    || sd.Recipe.Visibility == "Public"
                    || sd.Recipe.OwnerEmail == callerEmail)
                .OrderBy(sd => sd.Recipe.Title)
                .Select(sd => new RecipeRefDto
                {
                    Id = sd.Recipe.Id,
                    Title = sd.Recipe.Title,
                    ImageUrl = sd.Recipe.ImageUrl
                }).ToList(),
            CreatedAt = recipe.CreatedAt,
            UpdatedAt = recipe.UpdatedAt,
            IsLikedByMe = isLikedByMe
        };

        await PopulateOwnerDisplayAsync(recipeDetail);

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

        var sideDishIds = (request.SideDishIds ?? new List<int>()).Distinct().ToList();
        var sideDishError = await ValidateSideDishesAsync(null, sideDishIds, categories);
        if (sideDishError != null)
            return BadRequest(new { message = sideDishError });

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

        // Attach side dishes after the recipe is saved (need recipe.Id)
        if (sideDishIds.Count > 0)
        {
            var sideDishOrder = 0;
            foreach (var sideDishId in sideDishIds)
            {
                _context.RecipeSideDishes.Add(new RecipeSideDish
                {
                    RecipeId = recipe.Id,
                    SideDishRecipeId = sideDishId,
                    SortOrder = sideDishOrder++
                });
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

        // Alle innloggede brukere kan redigere alle oppskrifter.

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

        await PopulateOwnerDisplayAsync(recipeDetail);

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

        // Alle innloggede brukere kan slette alle oppskrifter.

        // Delete all blobs for this recipe (main image + all step images)
        await _blobStorage.DeleteByPrefixAsync($"recipes/{id}/");

        // Remove meal plan entries referencing this recipe before deleting
        var mealPlanEntries = await _context.MealPlans.Where(mp => mp.RecipeId == id).ToListAsync();
        _context.MealPlans.RemoveRange(mealPlanEntries);

        // Remove side-dish links where this recipe is the tilbehør. That FK is Restrict,
        // so leaving them would fail the delete; the forward direction cascades.
        var sideDishLinks = await _context.RecipeSideDishes
            .Where(sd => sd.SideDishRecipeId == id)
            .ToListAsync();
        _context.RecipeSideDishes.RemoveRange(sideDishLinks);

        _context.Recipes.Remove(recipe);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // ── Share endpoints ─────────────────────────────────────────────────────

    private bool CanManageShare(Recipe recipe, string? callerEmail) =>
        callerEmail != null && (recipe.OwnerEmail == callerEmail || _adminService.IsAdmin(callerEmail));

    private static string GenerateShareToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace("+", "-").Replace("/", "_").TrimEnd('=');

    private string BuildShareUrl(string token)
    {
        var configuredBase = _configuration["Sharing:PublicBaseUrl"];

        // The fallback is already wrong in prod -- it yields the API host, not where /delt/
        // lives -- so it exists only to keep local dev working. Still, honour X-Forwarded-Proto:
        // behind Container Apps ingress TLS terminates at the proxy and the app itself listens
        // on plain http, so Request.Scheme alone would emit an http:// link that browsers and
        // messaging apps then refuse to upgrade.
        var scheme = Request.Headers["X-Forwarded-Proto"].FirstOrDefault()?.Split(',')[0].Trim();
        if (string.IsNullOrWhiteSpace(scheme))
            scheme = Request.Scheme;

        var baseUrl = !string.IsNullOrWhiteSpace(configuredBase)
            ? configuredBase.TrimEnd('/')
            : $"{scheme}://{Request.Host}";

        return $"{baseUrl}/delt/{token}";
    }

    private ShareStatusDto BuildShareStatusDto(RecipeShare? share) =>
        share == null
            ? new ShareStatusDto { IsShared = false }
            : new ShareStatusDto
            {
                IsShared = true,
                Token = share.Token,
                ShareUrl = BuildShareUrl(share.Token),
                CreatedAt = share.CreatedAt
            };

    [HttpGet("{id:int}/share")]
    public async Task<ActionResult<ShareStatusDto>> GetShare(int id)
    {
        var callerEmail = GetCallerEmail();
        var recipe = await _context.Recipes.FindAsync(id);
        if (recipe == null)
            return NotFound(new { message = "Recipe not found" });

        if (!CanManageShare(recipe, callerEmail))
            return StatusCode(403, new { message = "Only the recipe owner can manage sharing" });

        var share = await _context.RecipeShares
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.RecipeId == id && s.RevokedAt == null);

        return Ok(BuildShareStatusDto(share));
    }

    /// <summary>Idempotent: an existing active share is returned as-is rather than minting a second token.</summary>
    [HttpPost("{id:int}/share")]
    public async Task<ActionResult<ShareStatusDto>> CreateShare(int id)
    {
        var callerEmail = GetCallerEmail();
        var recipe = await _context.Recipes.FindAsync(id);
        if (recipe == null)
            return NotFound(new { message = "Recipe not found" });

        if (!CanManageShare(recipe, callerEmail))
            return StatusCode(403, new { message = "Only the recipe owner can manage sharing" });

        var existing = await _context.RecipeShares
            .FirstOrDefaultAsync(s => s.RecipeId == id && s.RevokedAt == null);

        if (existing != null)
            return Ok(BuildShareStatusDto(existing));

        var share = new RecipeShare
        {
            RecipeId = id,
            Token = GenerateShareToken(),
            CreatedByEmail = callerEmail!,
            CreatedAt = DateTime.UtcNow
        };

        _context.RecipeShares.Add(share);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Lost a race: the filtered unique index on (RecipeId) WHERE RevokedAt IS NULL
            // rejected this insert because a concurrent request already created the active
            // share. That is the index doing its job -- the caller still wants the link, and
            // this endpoint is documented as idempotent, so return the winner's share rather
            // than a 500. (Two requests arriving together is the ordinary case: React
            // StrictMode double-invokes effects in development, and a double-click does the
            // same in production.)
            _context.Entry(share).State = EntityState.Detached;

            var winner = await _context.RecipeShares
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.RecipeId == id && s.RevokedAt == null);

            if (winner == null)
                throw;

            return Ok(BuildShareStatusDto(winner));
        }

        return Ok(BuildShareStatusDto(share));
    }

    /// <summary>Revokes the active share, if any. 204 either way — there is nothing to report back.</summary>
    [HttpDelete("{id:int}/share")]
    public async Task<IActionResult> RevokeShare(int id)
    {
        var callerEmail = GetCallerEmail();
        var recipe = await _context.Recipes.FindAsync(id);
        if (recipe == null)
            return NotFound(new { message = "Recipe not found" });

        if (!CanManageShare(recipe, callerEmail))
            return StatusCode(403, new { message = "Only the recipe owner can manage sharing" });

        var active = await _context.RecipeShares
            .Where(s => s.RecipeId == id && s.RevokedAt == null)
            .ToListAsync();

        if (active.Count > 0)
        {
            var revokedAt = DateTime.UtcNow;
            foreach (var share in active)
                share.RevokedAt = revokedAt;
            await _context.SaveChangesAsync();
        }

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

        await PopulateOwnerDisplayAsync(recipes);

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

        await PopulateOwnerDisplayAsync(recipes);

        return Ok(recipes);
    }

    /// <summary>Recipes owned by the caller, newest first.</summary>
    [HttpGet("mine")]
    public async Task<ActionResult<List<RecipeDto>>> GetMyRecipes()
    {
        var callerEmail = GetCallerEmail();
        if (callerEmail == null)
            return Unauthorized(new { message = "Authentication required" });

        // No visibility filter: your own recipes are all yours to see, whether they
        // are Public, Private or shared with a group.
        var recipes = await OwnedByQuery(callerEmail).ToListAsync();

        await ApplyLikesAsync(recipes, callerEmail);
        await PopulateOwnerDisplayAsync(recipes);

        return Ok(recipes);
    }

    /// <summary>
    /// Recipes owned by <paramref name="userId"/> that the caller is allowed to see.
    /// The visibility filter runs against the caller, not the owner, so this cannot be
    /// used to read someone else's private recipes.
    /// </summary>
    [HttpGet("by-user/{userId:int}")]
    public async Task<ActionResult<List<RecipeDto>>> GetRecipesByUser(int userId)
    {
        var callerEmail = GetCallerEmail();
        if (callerEmail == null)
            return Unauthorized(new { message = "Authentication required" });

        var ownerEmail = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.Email)
            .FirstOrDefaultAsync();

        if (ownerEmail == null)
            return NotFound(new { message = "User not found" });

        var recipes = await OwnedByQuery(ownerEmail, callerEmail).ToListAsync();

        await ApplyLikesAsync(recipes, callerEmail);
        await PopulateOwnerDisplayAsync(recipes);

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
        // Tilbehør is withheld from the AI: marking a recipe as a side dish is a
        // deliberate user choice, not something to infer from the recipe text.
        var categories = await _context.Categories
            .Where(c => c.Id != RecipeCategories.TilbehorId)
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
        // Defence in depth: the id is absent from the prompt's list, but the model could still emit it.
        SuggestedCategoryIds = dto.SuggestedCategoryIds.Where(id => id != RecipeCategories.TilbehorId).ToList(),
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
    /// <summary>Owner shown by name rather than email. Null when the recipe has no owner.</summary>
    public string? OwnerDisplayName { get; set; }
    /// <summary>Owner's user id for profile links. Null when the owner has no Users row.</summary>
    public int? OwnerUserId { get; set; }
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
    /// <summary>Owner shown by name rather than email. Null when the recipe has no owner.</summary>
    public string? OwnerDisplayName { get; set; }
    /// <summary>Owner's user id for profile links. Null when the owner has no Users row.</summary>
    public int? OwnerUserId { get; set; }
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

/// <summary>Active-share status for the owner-facing endpoints. <see cref="Token"/> and <see cref="ShareUrl"/> are null when nothing is shared.</summary>
public class ShareStatusDto
{
    public bool IsShared { get; set; }
    public string? Token { get; set; }
    public string? ShareUrl { get; set; }
    public DateTime? CreatedAt { get; set; }
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