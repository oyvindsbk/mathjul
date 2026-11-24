using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotesApi.Infrastructure;

namespace NotesApi.Features.Contexts;

public record ContextDto(int Id, string Name, int SortOrder, bool IsArchived);

public record CreateContextRequest([Required, MaxLength(WorkContext.MaxNameLength)] string Name);

public record UpdateContextRequest([MaxLength(WorkContext.MaxNameLength)] string? Name = null, bool? IsArchived = null);

public record ReorderContextsRequest([Required] IReadOnlyList<int> Ids);

[ApiController]
[Route("api/contexts")]
public class ContextsController(NotesDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<ContextDto>> List(CancellationToken ct) =>
        await db.Contexts.OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new ContextDto(c.Id, c.Name, c.SortOrder, c.IsArchived))
            .ToListAsync(ct);

    [HttpPost]
    public async Task<ActionResult<ContextDto>> Create(CreateContextRequest request, CancellationToken ct)
    {
        var name = request.Name.Trim();
        if (name.Length == 0)
            return BadRequest(new { error = "Name is required" });
        if (await NameTakenAsync(name, null, ct))
            return Conflict(new { error = $"A context named '{name}' already exists" });

        var next = await db.Contexts.Select(c => (int?)c.SortOrder).MaxAsync(ct) ?? -1;
        var context = new WorkContext { Name = name, SortOrder = next + 1 };
        db.Contexts.Add(context);
        await db.SaveChangesAsync(ct);
        return ToDto(context);
    }

    [HttpPatch("{id:int}")]
    public async Task<ActionResult<ContextDto>> Update(int id, UpdateContextRequest request, CancellationToken ct)
    {
        var context = await db.Contexts.FindAsync([id], ct);
        if (context is null)
            return NotFound();

        if (request.Name is not null)
        {
            var name = request.Name.Trim();
            if (name.Length == 0)
                return BadRequest(new { error = "Name is required" });
            if (await NameTakenAsync(name, id, ct))
                return Conflict(new { error = $"A context named '{name}' already exists" });
            context.Name = name;
        }
        if (request.IsArchived is { } archived)
            context.IsArchived = archived;

        await db.SaveChangesAsync(ct);
        return ToDto(context);
    }

    /// <summary>Sets the order of contexts to the given ids; contexts not listed keep their relative order after them.</summary>
    [HttpPost("reorder")]
    public async Task<IReadOnlyList<ContextDto>> Reorder(ReorderContextsRequest request, CancellationToken ct)
    {
        var all = await db.Contexts.OrderBy(c => c.SortOrder).ThenBy(c => c.Name).ToListAsync(ct);
        var ordered = request.Ids.Distinct()
            .Select(id => all.FirstOrDefault(c => c.Id == id))
            .OfType<WorkContext>()
            .Concat(all.Where(c => !request.Ids.Contains(c.Id)))
            .ToList();
        for (var i = 0; i < ordered.Count; i++)
            ordered[i].SortOrder = i;

        await db.SaveChangesAsync(ct);
        return ordered.Select(ToDto).ToList();
    }

    private Task<bool> NameTakenAsync(string name, int? exceptId, CancellationToken ct)
    {
        var lower = name.ToLower();
        return db.Contexts.AnyAsync(c => c.Id != exceptId && c.Name.ToLower() == lower, ct);
    }

    private static ContextDto ToDto(WorkContext c) => new(c.Id, c.Name, c.SortOrder, c.IsArchived);
}
