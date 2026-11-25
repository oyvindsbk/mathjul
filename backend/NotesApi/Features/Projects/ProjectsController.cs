using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotesApi.Infrastructure;

namespace NotesApi.Features.Projects;

public record ProjectDto(int Id, string Name, int SortOrder, bool IsArchived, string? Color);

public record CreateProjectRequest([Required, MaxLength(Project.MaxNameLength)] string Name);

/// <param name="ClearColor">True removes the color; a null <paramref name="Color"/> just means "unchanged".</param>
public record UpdateProjectRequest(
    [MaxLength(Project.MaxNameLength)] string? Name = null,
    bool? IsArchived = null,
    [MaxLength(ProjectColors.MaxKeyLength)] string? Color = null,
    bool ClearColor = false);

public record ReorderProjectsRequest([Required] IReadOnlyList<int> Ids);

[ApiController]
[Route("api/projects")]
public class ProjectsController(NotesDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<ProjectDto>> List(CancellationToken ct) =>
        await db.Projects.OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new ProjectDto(c.Id, c.Name, c.SortOrder, c.IsArchived, c.Color))
            .ToListAsync(ct);

    [HttpPost]
    public async Task<ActionResult<ProjectDto>> Create(CreateProjectRequest request, CancellationToken ct)
    {
        var name = request.Name.Trim();
        if (name.Length == 0)
            return BadRequest(new { error = "Name is required" });
        if (await NameTakenAsync(name, null, ct))
            return Conflict(new { error = $"A project named '{name}' already exists" });

        var next = await db.Projects.Select(c => (int?)c.SortOrder).MaxAsync(ct) ?? -1;
        var used = await db.Projects.Where(c => !c.IsArchived).Select(c => c.Color).ToListAsync(ct);
        var project = new Project { Name = name, SortOrder = next + 1, Color = ProjectColors.NextUnused(used) };
        db.Projects.Add(project);
        await db.SaveChangesAsync(ct);
        return ToDto(project);
    }

    [HttpPatch("{id:int}")]
    public async Task<ActionResult<ProjectDto>> Update(int id, UpdateProjectRequest request, CancellationToken ct)
    {
        var project = await db.Projects.FindAsync([id], ct);
        if (project is null)
            return NotFound();
        if (request.Color is not null && !ProjectColors.IsValid(request.Color))
            return BadRequest(new { error = $"Unknown color '{request.Color}'" });

        if (request.Name is not null)
        {
            var name = request.Name.Trim();
            if (name.Length == 0)
                return BadRequest(new { error = "Name is required" });
            if (await NameTakenAsync(name, id, ct))
                return Conflict(new { error = $"A project named '{name}' already exists" });
            project.Name = name;
        }
        if (request.IsArchived is { } archived)
            project.IsArchived = archived;
        if (request.ClearColor)
            project.Color = null;
        else if (request.Color is not null)
            project.Color = request.Color;

        await db.SaveChangesAsync(ct);
        return ToDto(project);
    }

    /// <summary>Sets the order of projects to the given ids; projects not listed keep their relative order after them.</summary>
    [HttpPost("reorder")]
    public async Task<IReadOnlyList<ProjectDto>> Reorder(ReorderProjectsRequest request, CancellationToken ct)
    {
        var all = await db.Projects.OrderBy(c => c.SortOrder).ThenBy(c => c.Name).ToListAsync(ct);
        var ordered = request.Ids.Distinct()
            .Select(id => all.FirstOrDefault(c => c.Id == id))
            .OfType<Project>()
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
        return db.Projects.AnyAsync(c => c.Id != exceptId && c.Name.ToLower() == lower, ct);
    }

    private static ProjectDto ToDto(Project c) => new(c.Id, c.Name, c.SortOrder, c.IsArchived, c.Color);
}
