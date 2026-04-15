using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Infrastructure;

namespace RecipeApi.Features.FeaturePlanner;

[ApiController]
[Route("api/feature-board")]
public class FeaturePlannerController : ControllerBase
{
    private readonly RecipeDbContext _db;
    private readonly IPrdGenerationService _prdService;
    private readonly ILogger<FeaturePlannerController> _logger;

    public FeaturePlannerController(RecipeDbContext db, IPrdGenerationService prdService, ILogger<FeaturePlannerController> logger)
    {
        _db = db;
        _prdService = prdService;
        _logger = logger;
    }

    // GET /api/feature-board
    [HttpGet]
    public async Task<ActionResult<FeatureBoardDto>> GetBoard()
    {
        var columns = await _db.FeatureColumns
            .Include(c => c.Cards)
            .OrderBy(c => c.SortOrder)
            .ToListAsync();

        return Ok(new FeatureBoardDto
        {
            Columns = columns.Select(c => new FeatureColumnDto
            {
                Id = c.Id,
                Name = c.Name,
                SortOrder = c.SortOrder,
                Cards = c.Cards
                    .OrderBy(card => card.SortOrder)
                    .Select(MapCardToDto)
                    .ToList()
            }).ToList()
        });
    }

    // POST /api/feature-board/columns
    [HttpPost("columns")]
    public async Task<ActionResult<FeatureColumnDto>> AddColumn([FromBody] AddColumnRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Column name is required" });

        var maxOrder = await _db.FeatureColumns.MaxAsync(c => (int?)c.SortOrder) ?? -1;
        var column = new FeatureColumn
        {
            Name = request.Name.Trim(),
            SortOrder = maxOrder + 1
        };
        _db.FeatureColumns.Add(column);
        await _db.SaveChangesAsync();

        return Ok(new FeatureColumnDto
        {
            Id = column.Id,
            Name = column.Name,
            SortOrder = column.SortOrder,
            Cards = new List<FeatureCardDto>()
        });
    }

    // PUT /api/feature-board/columns/{id}
    [HttpPut("columns/{id:int}")]
    public async Task<ActionResult<FeatureColumnDto>> UpdateColumn(int id, [FromBody] UpdateColumnRequest request)
    {
        var column = await _db.FeatureColumns.FindAsync(id);
        if (column == null) return NotFound();

        if (!string.IsNullOrWhiteSpace(request.Name))
            column.Name = request.Name.Trim();

        if (request.SortOrder.HasValue)
            column.SortOrder = request.SortOrder.Value;

        await _db.SaveChangesAsync();

        return Ok(new FeatureColumnDto
        {
            Id = column.Id,
            Name = column.Name,
            SortOrder = column.SortOrder,
            Cards = new List<FeatureCardDto>()
        });
    }

    // DELETE /api/feature-board/columns/{id}
    [HttpDelete("columns/{id:int}")]
    public async Task<IActionResult> DeleteColumn(int id)
    {
        var column = await _db.FeatureColumns
            .Include(c => c.Cards)
            .FirstOrDefaultAsync(c => c.Id == id);
        if (column == null) return NotFound();

        // Move cards to the first remaining column
        var firstColumn = await _db.FeatureColumns
            .Where(c => c.Id != id)
            .OrderBy(c => c.SortOrder)
            .FirstOrDefaultAsync();

        if (firstColumn != null && column.Cards.Count > 0)
        {
            var maxOrder = firstColumn.Cards.Count > 0
                ? firstColumn.Cards.Max(c => c.SortOrder)
                : -1;

            foreach (var card in column.Cards)
            {
                card.ColumnId = firstColumn.Id;
                card.SortOrder = ++maxOrder;
            }
        }

        _db.FeatureColumns.Remove(column);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/feature-board/cards
    [HttpPost("cards")]
    public async Task<ActionResult<FeatureCardDto>> CreateCard([FromBody] CreateCardRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(new { error = "Title is required" });

        // Default to the first column (lowest SortOrder) if columnId not specified
        int columnId = request.ColumnId;
        if (columnId == 0)
        {
            var first = await _db.FeatureColumns.OrderBy(c => c.SortOrder).FirstOrDefaultAsync();
            if (first == null) return BadRequest(new { error = "No columns exist" });
            columnId = first.Id;
        }
        else
        {
            if (!await _db.FeatureColumns.AnyAsync(c => c.Id == columnId))
                return NotFound(new { error = "Column not found" });
        }

        var maxOrder = await _db.FeatureCards
            .Where(c => c.ColumnId == columnId)
            .MaxAsync(c => (int?)c.SortOrder) ?? -1;

        var now = DateTimeOffset.UtcNow;
        var card = new FeatureCard
        {
            ColumnId = columnId,
            Title = request.Title.Trim(),
            Summary = request.Summary ?? string.Empty,
            Motivation = request.Motivation ?? string.Empty,
            Requirements = request.Requirements ?? string.Empty,
            OutOfScope = request.OutOfScope,
            OpenQuestions = request.OpenQuestions,
            StacksFrontend = request.StacksFrontend,
            StacksBackend = request.StacksBackend,
            StacksInfrastructure = request.StacksInfrastructure,
            DataModel = request.DataModel,
            ApiSketch = request.ApiSketch,
            UiSketch = request.UiSketch,
            SortOrder = maxOrder + 1,
            CreatedAt = now,
            UpdatedAt = now
        };
        _db.FeatureCards.Add(card);
        await _db.SaveChangesAsync();

        return Ok(MapCardToDto(card));
    }

    // PUT /api/feature-board/cards/{id}
    [HttpPut("cards/{id:int}")]
    public async Task<ActionResult<FeatureCardDto>> UpdateCard(int id, [FromBody] UpdateCardRequest request)
    {
        var card = await _db.FeatureCards.FindAsync(id);
        if (card == null) return NotFound();

        if (request.Title != null) card.Title = request.Title.Trim();
        if (request.Summary != null) card.Summary = request.Summary;
        if (request.Motivation != null) card.Motivation = request.Motivation;
        if (request.Requirements != null) card.Requirements = request.Requirements;
        if (request.OutOfScope != null) card.OutOfScope = request.OutOfScope;
        if (request.OpenQuestions != null) card.OpenQuestions = request.OpenQuestions;
        if (request.StacksFrontend.HasValue) card.StacksFrontend = request.StacksFrontend.Value;
        if (request.StacksBackend.HasValue) card.StacksBackend = request.StacksBackend.Value;
        if (request.StacksInfrastructure.HasValue) card.StacksInfrastructure = request.StacksInfrastructure.Value;
        if (request.DataModel != null) card.DataModel = request.DataModel;
        if (request.ApiSketch != null) card.ApiSketch = request.ApiSketch;
        if (request.UiSketch != null) card.UiSketch = request.UiSketch;
        card.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(MapCardToDto(card));
    }

    // DELETE /api/feature-board/cards/{id}
    [HttpDelete("cards/{id:int}")]
    public async Task<IActionResult> DeleteCard(int id)
    {
        var card = await _db.FeatureCards.FindAsync(id);
        if (card == null) return NotFound();
        _db.FeatureCards.Remove(card);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/feature-board/cards/{id}/move
    [HttpPost("cards/{id:int}/move")]
    public async Task<ActionResult<FeatureCardDto>> MoveCard(int id, [FromBody] MoveCardRequest request)
    {
        var card = await _db.FeatureCards.FindAsync(id);
        if (card == null) return NotFound();

        if (!await _db.FeatureColumns.AnyAsync(c => c.Id == request.ColumnId))
            return NotFound(new { error = "Target column not found" });

        card.ColumnId = request.ColumnId;
        if (request.SortOrder.HasValue)
            card.SortOrder = request.SortOrder.Value;
        card.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(MapCardToDto(card));
    }

    // POST /api/feature-board/ai/generate
    [HttpPost("ai/generate")]
    public async Task<ActionResult<GeneratedPrdDto>> GeneratePrd([FromBody] GeneratePrdRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Prompt))
            return BadRequest(new { error = "Prompt is required" });

        var result = await _prdService.GenerateAsync(request.Prompt, cancellationToken);
        if (!result.IsSuccess)
            return StatusCode(500, new { error = result.ErrorMessage });

        return Ok(result.Prd);
    }

    private static FeatureCardDto MapCardToDto(FeatureCard card) => new()
    {
        Id = card.Id,
        ColumnId = card.ColumnId,
        Title = card.Title,
        Summary = card.Summary,
        Motivation = card.Motivation,
        Requirements = card.Requirements,
        OutOfScope = card.OutOfScope,
        OpenQuestions = card.OpenQuestions,
        StacksFrontend = card.StacksFrontend,
        StacksBackend = card.StacksBackend,
        StacksInfrastructure = card.StacksInfrastructure,
        DataModel = card.DataModel,
        ApiSketch = card.ApiSketch,
        UiSketch = card.UiSketch,
        SortOrder = card.SortOrder,
        CreatedAt = card.CreatedAt,
        UpdatedAt = card.UpdatedAt
    };
}

// DTOs
public class FeatureBoardDto
{
    public List<FeatureColumnDto> Columns { get; set; } = new();
}

public class FeatureColumnDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public List<FeatureCardDto> Cards { get; set; } = new();
}

public class FeatureCardDto
{
    public int Id { get; set; }
    public int ColumnId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string Motivation { get; set; } = string.Empty;
    public string Requirements { get; set; } = string.Empty;
    public string? OutOfScope { get; set; }
    public string? OpenQuestions { get; set; }
    public bool StacksFrontend { get; set; }
    public bool StacksBackend { get; set; }
    public bool StacksInfrastructure { get; set; }
    public string? DataModel { get; set; }
    public string? ApiSketch { get; set; }
    public string? UiSketch { get; set; }
    public int SortOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

// Request models
public class AddColumnRequest
{
    public string Name { get; set; } = string.Empty;
}

public class UpdateColumnRequest
{
    public string? Name { get; set; }
    public int? SortOrder { get; set; }
}

public class CreateCardRequest
{
    public int ColumnId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string? Motivation { get; set; }
    public string? Requirements { get; set; }
    public string? OutOfScope { get; set; }
    public string? OpenQuestions { get; set; }
    public bool StacksFrontend { get; set; }
    public bool StacksBackend { get; set; }
    public bool StacksInfrastructure { get; set; }
    public string? DataModel { get; set; }
    public string? ApiSketch { get; set; }
    public string? UiSketch { get; set; }
}

public class UpdateCardRequest
{
    public string? Title { get; set; }
    public string? Summary { get; set; }
    public string? Motivation { get; set; }
    public string? Requirements { get; set; }
    public string? OutOfScope { get; set; }
    public string? OpenQuestions { get; set; }
    public bool? StacksFrontend { get; set; }
    public bool? StacksBackend { get; set; }
    public bool? StacksInfrastructure { get; set; }
    public string? DataModel { get; set; }
    public string? ApiSketch { get; set; }
    public string? UiSketch { get; set; }
}

public class MoveCardRequest
{
    public int ColumnId { get; set; }
    public int? SortOrder { get; set; }
}

public class GeneratePrdRequest
{
    public string Prompt { get; set; } = string.Empty;
}
