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

        FeatureCard card = request.CardType == "Bug"
            ? new BugCard
            {
                ColumnId = columnId,
                Title = request.Title.Trim(),
                Summary = request.Summary ?? string.Empty,
                Requirements = request.Requirements ?? string.Empty,
                UiSketch = request.UiSketch,
                BugUrl = request.BugUrl ?? string.Empty,
                SortOrder = maxOrder + 1,
                CreatedAt = now,
                UpdatedAt = now
            }
            : new FeatureOnlyCard
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
        if (request.Requirements != null) card.Requirements = request.Requirements;
        if (request.UiSketch != null) card.UiSketch = request.UiSketch;

        if (card is FeatureOnlyCard feature && request is UpdateFeatureCardRequest featureReq)
        {
            if (featureReq.Motivation != null) feature.Motivation = featureReq.Motivation;
            if (featureReq.OutOfScope != null) feature.OutOfScope = featureReq.OutOfScope;
            if (featureReq.OpenQuestions != null) feature.OpenQuestions = featureReq.OpenQuestions;
            if (featureReq.StacksFrontend.HasValue) feature.StacksFrontend = featureReq.StacksFrontend.Value;
            if (featureReq.StacksBackend.HasValue) feature.StacksBackend = featureReq.StacksBackend.Value;
            if (featureReq.StacksInfrastructure.HasValue) feature.StacksInfrastructure = featureReq.StacksInfrastructure.Value;
            if (featureReq.DataModel != null) feature.DataModel = featureReq.DataModel;
            if (featureReq.ApiSketch != null) feature.ApiSketch = featureReq.ApiSketch;
        }

        if (card is BugCard bug && request is UpdateBugCardRequest bugReq)
        {
            if (bugReq.BugUrl != null) bug.BugUrl = bugReq.BugUrl;
        }

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

    private static FeatureCardDto MapCardToDto(FeatureCard card) => card switch
    {
        BugCard bug => new BugCardDto
        {
            Id = bug.Id,
            ColumnId = bug.ColumnId,
            Title = bug.Title,
            Summary = bug.Summary,
            Requirements = bug.Requirements,
            UiSketch = bug.UiSketch,
            BugUrl = bug.BugUrl,
            CardType = "Bug",
            SortOrder = bug.SortOrder,
            CreatedAt = bug.CreatedAt,
            UpdatedAt = bug.UpdatedAt
        },
        FeatureOnlyCard feature => new FeatureCardDto
        {
            Id = feature.Id,
            ColumnId = feature.ColumnId,
            Title = feature.Title,
            Summary = feature.Summary,
            Motivation = feature.Motivation,
            Requirements = feature.Requirements,
            OutOfScope = feature.OutOfScope,
            OpenQuestions = feature.OpenQuestions,
            StacksFrontend = feature.StacksFrontend,
            StacksBackend = feature.StacksBackend,
            StacksInfrastructure = feature.StacksInfrastructure,
            DataModel = feature.DataModel,
            ApiSketch = feature.ApiSketch,
            UiSketch = feature.UiSketch,
            CardType = "Feature",
            SortOrder = feature.SortOrder,
            CreatedAt = feature.CreatedAt,
            UpdatedAt = feature.UpdatedAt
        },
        _ => throw new InvalidOperationException($"Unknown card type: {card.GetType().Name}")
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
    public string CardType { get; set; } = "Feature";
    public int SortOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public class BugCardDto : FeatureCardDto
{
    public string BugUrl { get; set; } = string.Empty;
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
    public string CardType { get; set; } = "Feature";
    public string? BugUrl { get; set; }
}

public class UpdateCardRequest
{
    public string? Title { get; set; }
    public string? Summary { get; set; }
    public string? Requirements { get; set; }
    public string? UiSketch { get; set; }
}

public class UpdateFeatureCardRequest : UpdateCardRequest
{
    public string? Motivation { get; set; }
    public string? OutOfScope { get; set; }
    public string? OpenQuestions { get; set; }
    public bool? StacksFrontend { get; set; }
    public bool? StacksBackend { get; set; }
    public bool? StacksInfrastructure { get; set; }
    public string? DataModel { get; set; }
    public string? ApiSketch { get; set; }
}

public class UpdateBugCardRequest : UpdateCardRequest
{
    public string? BugUrl { get; set; }
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
