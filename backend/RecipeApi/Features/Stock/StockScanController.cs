using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Infrastructure;

namespace RecipeApi.Features.Stock;

[ApiController]
[Route("api/groups/{groupId:int}/stock/scan")]
public class StockScanController : GroupScopedController
{
    private readonly IStockScanProcessor _scanProcessor;
    private readonly ILogger<StockScanController> _logger;

    public StockScanController(
        RecipeDbContext db, IStockScanProcessor scanProcessor, ILogger<StockScanController> logger) : base(db)
    {
        _scanProcessor = scanProcessor;
        _logger = logger;
    }

    // POST /api/groups/{groupId}/stock/scan  (multipart: location, images[])
    // Returns a draft only; nothing is saved until /apply.
    [HttpPost]
    [RequestSizeLimit(50 * 1024 * 1024)]
    public async Task<ActionResult<StockDraftResponse>> Scan(
        int groupId, [FromForm] string location, IFormFileCollection images, CancellationToken cancellationToken)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();
        if (!await IsGroupMemberAsync(groupId, email)) return NotMember();

        if (!StockLocations.IsValid(location))
            return BadRequest(new { error = $"Ugyldig plassering. Velg en av: {string.Join(", ", StockLocations.All)}" });

        var files = images?.ToList() ?? [];
        var imageError = StockImages.Validate(files);
        if (imageError != null) return BadRequest(new { error = imageError });

        _logger.LogInformation("Stock scan: group {GroupId}, {Count} images, {Location}", groupId, files.Count, location);

        var result = await _scanProcessor.ScanAsync(files, location, cancellationToken);
        if (!result.IsSuccess) return BadRequest(new { error = result.ErrorMessage });

        return Ok(new StockDraftResponse { Items = result.Items });
    }

    // POST /api/groups/{groupId}/stock/scan/apply
    [HttpPost("apply")]
    public async Task<ActionResult<ApplyScanResponse>> Apply(int groupId, [FromBody] ApplyScanRequest request)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();
        if (!await IsGroupMemberAsync(groupId, email)) return NotMember();

        if (!StockLocations.IsValid(request.Location))
            return BadRequest(new { error = $"Ugyldig plassering. Velg en av: {string.Join(", ", StockLocations.All)}" });
        if (!ScanApplyModes.IsValid(request.Mode))
            return BadRequest(new { error = $"Ugyldig modus. Velg en av: {ScanApplyModes.Add}, {ScanApplyModes.Replace}" });

        // An empty draft in replace mode would wipe the location, so empty is always refused.
        var draftError = DraftItems.Validate(request.Items);
        if (draftError != null) return BadRequest(new { error = draftError });

        var existing = await Db.StockItems
            .Where(s => s.GroupId == groupId && s.Location == request.Location)
            .ToListAsync();

        var result = StockScanApplier.Apply(
            groupId, request.Location, request.Mode, request.Items, existing,
            request.KeepIds ?? [], email, DateTime.UtcNow);

        Db.StockItems.AddRange(result.Added);
        Db.StockItems.RemoveRange(result.Removed);
        await Db.SaveChangesAsync();

        return Ok(new ApplyScanResponse
        {
            Added = result.Added.Count,
            Updated = result.Updated.Count,
            Removed = result.Removed.Count,
        });
    }
}

public class StockDraftResponse
{
    public List<DraftItem> Items { get; set; } = new();
}

public class ApplyScanRequest
{
    [Required]
    public string Location { get; set; } = string.Empty;

    /// <summary>"legg-til" or "erstatt".</summary>
    [Required]
    public string Mode { get; set; } = ScanApplyModes.Add;

    [Required]
    public List<DraftItem> Items { get; set; } = new();

    /// <summary>In replace mode: ids of existing items to keep even though the draft lacks them.</summary>
    public List<int>? KeepIds { get; set; }
}

public class ApplyScanResponse
{
    public int Added { get; set; }
    public int Updated { get; set; }
    public int Removed { get; set; }
}
