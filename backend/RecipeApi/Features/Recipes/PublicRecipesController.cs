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

    public PublicRecipesController(RecipeDbContext context)
    {
        _context = context;
    }

    [HttpGet("shared/{token}")]
    public async Task<ActionResult<SharedRecipeDto>> GetSharedRecipe(string token)
    {
        var share = await _context.RecipeShares
            .FirstOrDefaultAsync(s => s.Token == token && s.RevokedAt == null);

        if (share == null)
            return NotFound(new { message = "Denne delingen finnes ikke lenger" });

        var recipe = await _context.Recipes
            .AsNoTracking()
            .Include(r => r.SideDishes).ThenInclude(sd => sd.SideDishRecipe)
            .AsSplitQuery()
            .FirstOrDefaultAsync(r => r.Id == share.RecipeId);

        if (recipe == null)
            return NotFound(new { message = "Denne delingen finnes ikke lenger" });

        var dto = new SharedRecipeDto
        {
            Title = recipe.Title,
            Description = recipe.Description,
            CookTime = recipe.CookTime,
            CookTimeMinutes = recipe.CookTimeMinutes,
            PrepTime = recipe.PrepTime,
            ImageUrl = recipe.ImageUrl,
            Servings = recipe.Servings,
            QuantityType = recipe.QuantityType,
            CustomUnit = recipe.CustomUnit,
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
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string CookTime { get; set; } = string.Empty;
    public int? CookTimeMinutes { get; set; }
    public int? PrepTime { get; set; }
    public string? ImageUrl { get; set; }
    public double? Servings { get; set; }
    public string QuantityType { get; set; } = "porsjoner";
    public string? CustomUnit { get; set; }
    public List<StructuredIngredientDto> Ingredients { get; set; } = new();
    public List<InstructionStepDto> InstructionSteps { get; set; } = new();
    public List<IngredientSectionDto> IngredientSections { get; set; } = new();
    public List<InstructionSectionDto> InstructionSections { get; set; } = new();
    public List<string> Tips { get; set; } = new();
    /// <summary>Side-dish titles as plain text -- not links to the side dish recipes.</summary>
    public List<string> SideDishes { get; set; } = new();
    public string OwnerDisplayName { get; set; } = string.Empty;
}
