using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Features.Auth;
using RecipeApi.Infrastructure;

namespace RecipeApi.Features.Recipes;

/// <summary>
/// Public, unauthenticated read of a single recipe via its share token. The /api/public/
/// prefix is exempted in EmailWhitelistMiddleware -- anyone holding the link can read the
/// recipe, which is the point of the feature.
///
/// Deliberately overrides the recipe's own visibility: an active token is the owner's
/// explicit act of sharing, so a Private recipe is readable here on purpose. The response is
/// a dedicated <see cref="SharedRecipeDto"/> rather than <see cref="RecipeDetailDto"/> so a
/// field added to the authenticated DTO later does not silently start leaking here.
/// </summary>
[ApiController]
[Route("api/public/recipes")]
public class PublicRecipesController : ControllerBase
{
    /// <summary>How stale <see cref="RecipeShare.LastAccessedAt"/> may get before a read refreshes it.</summary>
    private static readonly TimeSpan LastAccessedThrottle = TimeSpan.FromMinutes(15);

    private readonly RecipeDbContext _context;
    private readonly ILogger<PublicRecipesController> _logger;

    public PublicRecipesController(RecipeDbContext context, ILogger<PublicRecipesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet("shared/{token}")]
    public async Task<ActionResult<SharedRecipeDto>> GetSharedRecipe(string token)
    {
        var share = await _context.RecipeShares
            .FirstOrDefaultAsync(s => s.Token == token && s.RevokedAt == null);

        if (share == null)
            return NotFound(new { message = "Denne delingen finnes ikke lenger" });

        // Tracked deliberately: a recipe written before mentions existed needs its
        // ingredient ids backfilled and persisted below, so the shared page and the
        // full recipe bind mentions to the same identities.
        var recipe = await _context.Recipes
            .Include(r => r.SideDishes).ThenInclude(sd => sd.SideDishRecipe)
            .AsSplitQuery()
            .FirstOrDefaultAsync(r => r.Id == share.RecipeId);

        if (recipe == null)
            return NotFound(new { message = "Denne delingen finnes ikke lenger" });

        if (RecipeIngredientIds.EnsureIds(recipe))
        {
            // JSON columns — EF cannot see the in-place mutation without the signal.
            // Best-effort: a failed write must not turn a valid share into a 500, and
            // the payload below is correct either way.
            try
            {
                _context.Entry(recipe).Property(r => r.Ingredients).IsModified = true;
                _context.Entry(recipe).Property(r => r.IngredientSections).IsModified = true;
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // Logged rather than swallowed silently: if this keeps failing, the
                // recipe is retried on every view forever, and that needs to be visible.
                _logger.LogWarning(
                    ex,
                    "Could not persist backfilled ingredient ids for shared recipe {RecipeId}",
                    recipe.Id);
            }
        }

        var dto = new SharedRecipeDto
        {
            RecipeId = recipe.Id,
            Title = recipe.Title,
            Description = recipe.Description,
            CookTime = recipe.CookTime,
            CookTimeMinutes = recipe.CookTimeMinutes,
            PrepTime = recipe.PrepTime,
            ImageUrl = recipe.ImageUrl,
            Servings = recipe.Servings,
            QuantityType = recipe.QuantityType,
            CustomUnit = recipe.CustomUnit,
            PanShape = recipe.PanShape,
            PanDiameter = recipe.PanDiameter,
            PanLength = recipe.PanLength,
            PanWidth = recipe.PanWidth,
            PanHeight = recipe.PanHeight,
            UpdatedAt = recipe.UpdatedAt,
            Ingredients = recipe.Ingredients.Select(i => i.ToDto()).ToList(),
            InstructionSteps = recipe.InstructionSteps.Select(s => s.ToDto()).ToList(),
            IngredientSections = recipe.IngredientSections.Select(s => new IngredientSectionDto
            {
                Heading = s.Heading,
                Ingredients = s.Ingredients.Select(i => i.ToDto()).ToList()
            }).ToList(),
            InstructionSections = recipe.InstructionSections.Select(s => new InstructionSectionDto
            {
                Heading = s.Heading,
                Steps = s.Steps.Select(st => st.ToDto()).ToList()
            }).ToList(),
            Tips = recipe.Tips,
            // Plain text, not links: a link would hand the recipient a second recipe.
            SideDishes = recipe.SideDishes
                .OrderBy(sd => sd.SortOrder)
                .Select(sd => sd.SideDishRecipe.Title)
                .ToList(),
            OwnerDisplayName = await ResolveOwnerDisplayNameAsync(recipe.OwnerEmail)
        };

        // Best-effort, and throttled: only the owner ever sees this timestamp, and
        // they do not need per-view precision. Writing on every read would put an
        // UPDATE on a public, uncacheable path that a single popular link could
        // hammer, so a view within the throttle window costs no write at all.
        var now = DateTime.UtcNow;
        if (share.LastAccessedAt == null || now - share.LastAccessedAt.Value >= LastAccessedThrottle)
        {
            // A failed write here must not turn a valid share into a 500.
            try
            {
                share.LastAccessedAt = now;
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // Ignored -- the read already succeeded.
            }
        }

        return Ok(dto);
    }

    private async Task<string> ResolveOwnerDisplayNameAsync(string? ownerEmail)
    {
        if (string.IsNullOrEmpty(ownerEmail))
            return "Ukjent bruker";

        var owner = await _context.Users
            .AsNoTracking()
            .Where(u => u.Email == ownerEmail)
            .Select(u => new { u.Nickname, u.Name, u.DisplayName })
            .FirstOrDefaultAsync();

        return owner == null
            ? UserDisplayName.Resolve(null, null, null, ownerEmail)
            : UserDisplayName.Resolve(owner.Nickname, owner.Name, owner.DisplayName, ownerEmail);
    }
}

/// <summary>
/// Public share payload. Deliberately excludes email, likes, groups, and visibility --
/// see the class doc on <see cref="PublicRecipesController"/> for why this is a separate type
/// rather than a reuse of <see cref="RecipeDetailDto"/>.
/// </summary>
public class SharedRecipeDto
{
    /// <summary>
    /// The underlying recipe id, so the share page can offer a way into the full
    /// recipe. Reaching it still requires logging in — the id alone grants nothing.
    /// </summary>
    public int RecipeId { get; set; }

    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string CookTime { get; set; } = string.Empty;
    public int? CookTimeMinutes { get; set; }
    public int? PrepTime { get; set; }
    public string? ImageUrl { get; set; }
    public double? Servings { get; set; }
    public string QuantityType { get; set; } = "porsjoner";
    public string? CustomUnit { get; set; }

    /// <summary>
    /// The baking tin the recipe was authored for -- cake recipes
    /// (QuantityType "form") only. Without it the share page can show the pan
    /// picker but cannot mark the original tin or warn about a conversion.
    /// Dimensions only, so nothing here identifies the owner.
    /// </summary>
    public string? PanShape { get; set; }
    public decimal? PanDiameter { get; set; }
    public decimal? PanLength { get; set; }
    public decimal? PanWidth { get; set; }
    public decimal? PanHeight { get; set; }
    public List<StructuredIngredientDto> Ingredients { get; set; } = new();
    public List<InstructionStepDto> InstructionSteps { get; set; } = new();
    public List<IngredientSectionDto> IngredientSections { get; set; } = new();
    public List<InstructionSectionDto> InstructionSections { get; set; } = new();
    public List<string> Tips { get; set; } = new();
    /// <summary>Side-dish titles as plain text -- not links to the side dish recipes.</summary>
    public List<string> SideDishes { get; set; } = new();
    public string OwnerDisplayName { get; set; } = string.Empty;

    /// <summary>
    /// Drives the "Sist oppdatert" line in RecipeBody. Not sensitive -- the authenticated
    /// detail view already shows it, and it says nothing about who edited the recipe.
    /// </summary>
    public DateTime UpdatedAt { get; set; }
}
