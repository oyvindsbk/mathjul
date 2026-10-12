using System.ComponentModel.DataAnnotations;
using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Infrastructure;

namespace RecipeApi.Features.Stock;

[ApiController]
[Route("api/groups/{groupId:int}/stock")]
public class StockController : GroupScopedController
{
    public StockController(RecipeDbContext db) : base(db)
    {
    }

    // GET /api/groups/{groupId}/stock
    [HttpGet]
    public async Task<ActionResult<List<StockItemDto>>> GetStock(int groupId)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();
        if (!await IsGroupMemberAsync(groupId, email)) return NotMember();

        var items = await Db.StockItems
            .AsNoTracking()
            .Where(s => s.GroupId == groupId)
            .ToListAsync();

        // Locations have a natural order (fridge first), which is not alphabetical.
        return Ok(items
            .OrderBy(s => StockLocations.SortIndex(s.Location))
            .ThenBy(s => s.Name, StringComparer.CurrentCultureIgnoreCase)
            .Select(StockItemDto.From)
            .ToList());
    }

    // POST /api/groups/{groupId}/stock
    [HttpPost]
    public async Task<ActionResult<StockItemDto>> CreateStockItem(int groupId, [FromBody] StockItemRequest request)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();
        if (!await IsGroupMemberAsync(groupId, email)) return NotMember();

        var item = new StockItem { GroupId = groupId, CreatedAt = DateTime.UtcNow };
        var error = Apply(item, request, email);
        if (error != null) return BadRequest(new { error });

        Db.StockItems.Add(item);
        await Db.SaveChangesAsync();

        return Ok(StockItemDto.From(item));
    }

    // PUT /api/groups/{groupId}/stock/{id}
    [HttpPut("{id:int}")]
    public async Task<ActionResult<StockItemDto>> UpdateStockItem(int groupId, int id, [FromBody] StockItemRequest request)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();
        if (!await IsGroupMemberAsync(groupId, email)) return NotMember();

        var item = await Db.StockItems.FirstOrDefaultAsync(s => s.Id == id && s.GroupId == groupId);
        if (item == null) return NotFound(new { error = "Varen finnes ikke" });

        var error = Apply(item, request, email);
        if (error != null) return BadRequest(new { error });

        await Db.SaveChangesAsync();

        return Ok(StockItemDto.From(item));
    }

    // DELETE /api/groups/{groupId}/stock/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteStockItem(int groupId, int id)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();
        if (!await IsGroupMemberAsync(groupId, email)) return NotMember();

        var item = await Db.StockItems.FirstOrDefaultAsync(s => s.Id == id && s.GroupId == groupId);
        if (item == null) return NotFound(new { error = "Varen finnes ikke" });

        Db.StockItems.Remove(item);
        await Db.SaveChangesAsync();

        return NoContent();
    }

    /// <summary>
    /// Validates the request and copies it onto the entity. Returns an error message, or
    /// null on success. Nothing is written to <paramref name="item"/> unless it is valid.
    /// </summary>
    private static string? Apply(StockItem item, StockItemRequest request, string email)
    {
        var error = StockFields.Validate(request.Name, request.Quantity, request.Unit);
        if (error != null) return error;

        if (!StockLocations.IsValid(request.Location))
            return $"Ugyldig plassering. Velg en av: {string.Join(", ", StockLocations.All)}";

        DateOnly? bestBefore = null;
        if (!string.IsNullOrWhiteSpace(request.BestBefore))
        {
            if (!DateOnly.TryParseExact(request.BestBefore, "yyyy-MM-dd", CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out var parsed))
                return "Ugyldig dato for best før. Bruk yyyy-MM-dd.";
            bestBefore = parsed;
        }

        var name = request.Name.Trim();
        item.Name = name;
        item.NormalizedName = IngredientMatcher.Normalize(name);
        item.Location = request.Location;
        item.BestBefore = bestBefore;
        item.IsStaple = request.IsStaple;
        // Staples are never tracked by quantity.
        item.Quantity = request.IsStaple ? null : request.Quantity;
        item.Unit = request.IsStaple ? null : StockFields.CleanUnit(request.Unit);
        item.UpdatedByEmail = email;
        item.UpdatedAt = DateTime.UtcNow;
        return null;
    }
}

public class StockItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal? Quantity { get; set; }
    public string? Unit { get; set; }
    public string Location { get; set; } = string.Empty;
    public string? BestBefore { get; set; }
    public bool IsStaple { get; set; }

    public static StockItemDto From(StockItem item) => new()
    {
        Id = item.Id,
        Name = item.Name,
        Quantity = item.Quantity,
        Unit = item.Unit,
        Location = item.Location,
        BestBefore = item.BestBefore?.ToString("yyyy-MM-dd"),
        IsStaple = item.IsStaple,
    };
}

public class StockItemRequest
{
    [Required]
    [StringLength(StockFields.MaxNameLength)]
    public string Name { get; set; } = string.Empty;

    [Range(0, (double)StockFields.MaxQuantity)]
    public decimal? Quantity { get; set; }

    [StringLength(StockFields.MaxUnitLength)]
    public string? Unit { get; set; }

    [Required]
    public string Location { get; set; } = StockLocations.Fridge;

    /// <summary>yyyy-MM-dd</summary>
    public string? BestBefore { get; set; }

    public bool IsStaple { get; set; }
}
