using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Infrastructure;

namespace RecipeApi.Features.Stock;

[ApiController]
[Route("api/groups/{groupId:int}/shopping-list")]
public class ShoppingListController : GroupScopedController
{
    private const int MaxItemsPerRequest = 100;

    public ShoppingListController(RecipeDbContext db) : base(db)
    {
    }

    // GET /api/groups/{groupId}/shopping-list?status=aapen
    [HttpGet]
    public async Task<ActionResult<List<ShoppingListItemDto>>> GetShoppingList(int groupId, [FromQuery] string? status = null)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();
        if (!await IsGroupMemberAsync(groupId, email)) return NotMember();

        if (status != null && !ShoppingListStatuses.IsValid(status))
            return BadRequest(new { error = $"Ugyldig status. Velg en av: {string.Join(", ", ShoppingListStatuses.All)}" });

        var query = Db.ShoppingListItems.AsNoTracking().Where(i => i.GroupId == groupId);
        if (status != null) query = query.Where(i => i.Status == status);

        var items = await query.OrderBy(i => i.Name).ToListAsync();

        // Open items before bought ones.
        return Ok(items
            .OrderBy(i => i.Status == ShoppingListStatuses.Open ? 0 : 1)
            .Select(ShoppingListItemDto.From)
            .ToList());
    }

    // POST /api/groups/{groupId}/shopping-list
    [HttpPost]
    public async Task<ActionResult<List<ShoppingListItemDto>>> AddItems(int groupId, [FromBody] AddShoppingListItemsRequest request)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();
        if (!await IsGroupMemberAsync(groupId, email)) return NotMember();

        if (request.Items == null || request.Items.Count == 0)
            return BadRequest(new { error = "Ingen varer å legge til" });
        if (request.Items.Count > MaxItemsPerRequest)
            return BadRequest(new { error = $"Maks {MaxItemsPerRequest} varer om gangen" });

        // Validate everything first so a bad row never leaves the list half-updated.
        foreach (var item in request.Items)
        {
            var error = StockFields.Validate(item.Name, item.Quantity, item.Unit);
            if (error != null) return BadRequest(new { error });
            if (item.Note?.Length > StockFields.MaxNoteLength)
                return BadRequest(new { error = $"Notat kan ha maks {StockFields.MaxNoteLength} tegn" });
            if (item.Source != null && !ShoppingListSources.IsValid(item.Source))
                return BadRequest(new { error = $"Ugyldig kilde. Velg en av: {string.Join(", ", ShoppingListSources.All)}" });
        }

        var open = await Db.ShoppingListItems
            .Where(i => i.GroupId == groupId && i.Status == ShoppingListStatuses.Open)
            .ToListAsync();

        var now = DateTime.UtcNow;
        var touched = new List<ShoppingListItem>();
        foreach (var requested in request.Items)
        {
            var name = requested.Name.Trim();
            var incoming = new ShoppingListItem
            {
                GroupId = groupId,
                Name = name,
                NormalizedName = IngredientMatcher.Normalize(name),
                Quantity = requested.Quantity,
                Unit = StockFields.CleanUnit(requested.Unit),
                Note = string.IsNullOrWhiteSpace(requested.Note) ? null : requested.Note.Trim(),
                Source = requested.Source ?? ShoppingListSources.Manual,
                Status = ShoppingListStatuses.Open,
                CreatedByEmail = email,
                CreatedAt = now,
            };

            var target = ItemMerger.MergeIntoShoppingList(open, incoming);
            if (ReferenceEquals(target, incoming)) Db.ShoppingListItems.Add(incoming);
            if (!touched.Contains(target)) touched.Add(target);
        }

        await Db.SaveChangesAsync();

        return Ok(touched.Select(ShoppingListItemDto.From).ToList());
    }

    // PATCH /api/groups/{groupId}/shopping-list/{id}
    [HttpPatch("{id:int}")]
    public async Task<ActionResult<ShoppingListItemDto>> UpdateItem(int groupId, int id, [FromBody] UpdateShoppingListItemRequest request)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();
        if (!await IsGroupMemberAsync(groupId, email)) return NotMember();

        var item = await Db.ShoppingListItems.FirstOrDefaultAsync(i => i.Id == id && i.GroupId == groupId);
        if (item == null) return NotFound(new { error = "Varen finnes ikke" });

        if (request.Name != null || request.Quantity != null || request.Unit != null)
        {
            var error = StockFields.Validate(request.Name ?? item.Name, request.Quantity ?? item.Quantity, request.Unit ?? item.Unit);
            if (error != null) return BadRequest(new { error });
        }
        if (request.Note?.Length > StockFields.MaxNoteLength)
            return BadRequest(new { error = $"Notat kan ha maks {StockFields.MaxNoteLength} tegn" });
        if (request.Status != null && !ShoppingListStatuses.IsValid(request.Status))
            return BadRequest(new { error = $"Ugyldig status. Velg en av: {string.Join(", ", ShoppingListStatuses.All)}" });

        if (request.Name != null)
        {
            item.Name = request.Name.Trim();
            item.NormalizedName = IngredientMatcher.Normalize(item.Name);
        }
        if (request.Quantity != null) item.Quantity = request.Quantity;
        if (request.Unit != null) item.Unit = StockFields.CleanUnit(request.Unit);
        if (request.Note != null) item.Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();

        if (request.Status != null && request.Status != item.Status)
        {
            item.Status = request.Status;
            item.BoughtAt = request.Status == ShoppingListStatuses.Bought ? DateTime.UtcNow : null;
        }

        await Db.SaveChangesAsync();

        return Ok(ShoppingListItemDto.From(item));
    }

    // DELETE /api/groups/{groupId}/shopping-list/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteItem(int groupId, int id)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();
        if (!await IsGroupMemberAsync(groupId, email)) return NotMember();

        var item = await Db.ShoppingListItems.FirstOrDefaultAsync(i => i.Id == id && i.GroupId == groupId);
        if (item == null) return NotFound(new { error = "Varen finnes ikke" });

        Db.ShoppingListItems.Remove(item);
        await Db.SaveChangesAsync();

        return NoContent();
    }

    // DELETE /api/groups/{groupId}/shopping-list?status=kjopt  -- clears the bought items
    [HttpDelete]
    public async Task<IActionResult> ClearBought(int groupId, [FromQuery] string? status = null)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();
        if (!await IsGroupMemberAsync(groupId, email)) return NotMember();

        // Only bought items may be cleared in bulk; wiping the open list in one call is too easy to do by mistake.
        if (status != ShoppingListStatuses.Bought)
            return BadRequest(new { error = $"Kun status '{ShoppingListStatuses.Bought}' kan tømmes" });

        var bought = await Db.ShoppingListItems
            .Where(i => i.GroupId == groupId && i.Status == ShoppingListStatuses.Bought)
            .ToListAsync();
        Db.ShoppingListItems.RemoveRange(bought);
        await Db.SaveChangesAsync();

        return Ok(new { removed = bought.Count });
    }

    // POST /api/groups/{groupId}/shopping-list/move-to-stock
    [HttpPost("move-to-stock")]
    public async Task<IActionResult> MoveBoughtToStock(int groupId, [FromBody] MoveToStockRequest request)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();
        if (!await IsGroupMemberAsync(groupId, email)) return NotMember();

        if (!StockLocations.IsValid(request.Location))
            return BadRequest(new { error = $"Ugyldig plassering. Velg en av: {string.Join(", ", StockLocations.All)}" });

        var bought = await Db.ShoppingListItems
            .Where(i => i.GroupId == groupId && i.Status == ShoppingListStatuses.Bought)
            .ToListAsync();
        if (bought.Count == 0) return Ok(new { moved = 0 });

        var stockAtLocation = await Db.StockItems
            .Where(s => s.GroupId == groupId && s.Location == request.Location)
            .ToListAsync();

        var now = DateTime.UtcNow;
        foreach (var item in bought)
        {
            var incoming = new StockItem
            {
                GroupId = groupId,
                Name = item.Name,
                NormalizedName = item.NormalizedName,
                Quantity = item.Quantity,
                Unit = item.Unit,
                Location = request.Location,
                UpdatedByEmail = email,
                CreatedAt = now,
                UpdatedAt = now,
            };

            var target = ItemMerger.MergeIntoStock(stockAtLocation, incoming);
            if (ReferenceEquals(target, incoming)) Db.StockItems.Add(incoming);
        }

        Db.ShoppingListItems.RemoveRange(bought);
        await Db.SaveChangesAsync();

        return Ok(new { moved = bought.Count });
    }
}

public class ShoppingListItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal? Quantity { get; set; }
    public string? Unit { get; set; }
    public string? Note { get; set; }
    public string Source { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;

    public static ShoppingListItemDto From(ShoppingListItem item) => new()
    {
        Id = item.Id,
        Name = item.Name,
        Quantity = item.Quantity,
        Unit = item.Unit,
        Note = item.Note,
        Source = item.Source,
        Status = item.Status,
    };
}

public class ShoppingListItemRequest
{
    [Required]
    [StringLength(StockFields.MaxNameLength)]
    public string Name { get; set; } = string.Empty;

    [Range(0, (double)StockFields.MaxQuantity)]
    public decimal? Quantity { get; set; }

    [StringLength(StockFields.MaxUnitLength)]
    public string? Unit { get; set; }

    [StringLength(StockFields.MaxNoteLength)]
    public string? Note { get; set; }

    /// <summary>"manuell" (default) or "ukeplan".</summary>
    public string? Source { get; set; }
}

public class AddShoppingListItemsRequest
{
    [Required]
    public List<ShoppingListItemRequest> Items { get; set; } = new();
}

/// <summary>
/// Partial update: a null field is left untouched, so a quantity or unit cannot be cleared
/// through this endpoint (delete and re-add the row instead). A blank note does clear it.
/// </summary>
public class UpdateShoppingListItemRequest
{
    [StringLength(StockFields.MaxNameLength)]
    public string? Name { get; set; }

    [Range(0, (double)StockFields.MaxQuantity)]
    public decimal? Quantity { get; set; }

    [StringLength(StockFields.MaxUnitLength)]
    public string? Unit { get; set; }

    [StringLength(StockFields.MaxNoteLength)]
    public string? Note { get; set; }

    public string? Status { get; set; }
}

public class MoveToStockRequest
{
    [Required]
    public string Location { get; set; } = string.Empty;
}
