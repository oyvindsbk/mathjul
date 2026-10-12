using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using RecipeApi.Infrastructure;

namespace RecipeApi.Features.Stock;

[ApiController]
[Route("api/groups/{groupId:int}/stock/scan/correct")]
public class StockCorrectionController : GroupScopedController
{
    public const int MaxInstructionLength = 500;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly IStockCorrectionProcessor _processor;
    private readonly ILogger<StockCorrectionController> _logger;

    public StockCorrectionController(
        RecipeDbContext db, IStockCorrectionProcessor processor, ILogger<StockCorrectionController> logger) : base(db)
    {
        _processor = processor;
        _logger = logger;
    }

    // POST /api/groups/{groupId}/stock/scan/correct  (multipart: draft (JSON), instruction, images[] optional)
    // Stateless and saves nothing: the corrected draft goes back to the browser for review.
    [HttpPost]
    [RequestSizeLimit(50 * 1024 * 1024)]
    public async Task<ActionResult<CorrectionResponse>> Correct(
        int groupId,
        [FromForm] string draft,
        [FromForm] string instruction,
        IFormFileCollection images,
        CancellationToken cancellationToken)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();
        if (!await IsGroupMemberAsync(groupId, email)) return NotMember();

        var trimmedInstruction = instruction?.Trim();
        if (string.IsNullOrEmpty(trimmedInstruction))
            return BadRequest(new { error = "Skriv hva som skal rettes" });
        if (trimmedInstruction.Length > MaxInstructionLength)
            return BadRequest(new { error = $"Instruksjonen kan ha maks {MaxInstructionLength} tegn" });

        List<DraftItem>? items;
        try
        {
            items = JsonSerializer.Deserialize<List<DraftItem>>(draft ?? string.Empty, JsonOptions);
        }
        catch (JsonException)
        {
            return BadRequest(new { error = "Ugyldig utkast" });
        }
        if (items == null) return BadRequest(new { error = "Ugyldig utkast" });

        // An empty draft is fine here ("legg til 12 egg"), unlike when saving.
        if (items.Count > 0)
        {
            var draftError = DraftItems.Validate(items);
            if (draftError != null) return BadRequest(new { error = draftError });
        }

        var files = images?.ToList() ?? [];
        if (files.Count > 0)
        {
            var imageError = StockImages.Validate(files);
            if (imageError != null) return BadRequest(new { error = imageError });
        }

        var interpreted = await _processor.InterpretAsync(items, trimmedInstruction, files, cancellationToken);
        if (!interpreted.IsSuccess) return BadRequest(new { error = interpreted.ErrorMessage });

        var result = StockCorrectionApplier.Apply(items, interpreted.Changes);
        _logger.LogInformation("Stock correction: group {GroupId}, {Applied} applied, {Rejected} rejected",
            groupId, result.Applied.Count, result.Rejected.Count);

        return Ok(new CorrectionResponse
        {
            Items = result.Items,
            Applied = result.Applied,
            Rejected = result.Rejected,
        });
    }
}

public class CorrectionResponse
{
    public List<DraftItem> Items { get; set; } = new();

    /// <summary>Norwegian descriptions of the changes that were made.</summary>
    public List<string> Applied { get; set; } = new();

    /// <summary>Changes the model proposed that were refused, with the reason.</summary>
    public List<string> Rejected { get; set; } = new();
}
