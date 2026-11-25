using Microsoft.AspNetCore.Mvc;
using NotesApi.Features.Projects;

namespace NotesApi.Tests;

public class ProjectTests
{
    private static ProjectDto Ok(ActionResult<ProjectDto> result) =>
        result.Value ?? throw new Xunit.Sdk.XunitException($"Expected a project, got {result.Result}");

    [Fact]
    public async Task New_projects_get_the_next_unused_color()
    {
        using var t = new NotesTestContext();
        var projects = new ProjectsController(t.Db);

        var first = Ok(await projects.Create(new CreateProjectRequest("A"), default));
        var second = Ok(await projects.Create(new CreateProjectRequest("B"), default));
        await projects.Update(first.Id, new UpdateProjectRequest(Color: "green"), default);
        var third = Ok(await projects.Create(new CreateProjectRequest("C"), default));

        Assert.Equal("blue", first.Color);
        Assert.Equal("yellow", second.Color);
        Assert.Equal("blue", third.Color); // freed when A became green
    }

    [Fact]
    public async Task Archived_projects_do_not_hold_on_to_their_color()
    {
        using var t = new NotesTestContext();
        var projects = new ProjectsController(t.Db);
        var old = Ok(await projects.Create(new CreateProjectRequest("Old"), default));
        await projects.Update(old.Id, new UpdateProjectRequest(IsArchived: true), default);

        var fresh = Ok(await projects.Create(new CreateProjectRequest("New"), default));

        Assert.Equal(old.Color, fresh.Color);
    }

    [Fact]
    public async Task Colors_cycle_when_the_palette_is_used_up()
    {
        using var t = new NotesTestContext();
        var projects = new ProjectsController(t.Db);
        for (var i = 0; i < ProjectColors.All.Count; i++)
            await projects.Create(new CreateProjectRequest($"P{i}"), default);

        var extra = Ok(await projects.Create(new CreateProjectRequest("Extra"), default));

        Assert.Equal(ProjectColors.All[0], extra.Color);
    }

    [Fact]
    public async Task Color_can_be_changed_and_cleared()
    {
        using var t = new NotesTestContext();
        var projects = new ProjectsController(t.Db);
        var p = Ok(await projects.Create(new CreateProjectRequest("P"), default));

        var purple = Ok(await projects.Update(p.Id, new UpdateProjectRequest(Color: "purple"), default));
        var renamed = Ok(await projects.Update(p.Id, new UpdateProjectRequest(Name: "Q"), default));
        var cleared = Ok(await projects.Update(p.Id, new UpdateProjectRequest(ClearColor: true), default));

        Assert.Equal("purple", purple.Color);
        Assert.Equal("purple", renamed.Color);
        Assert.Null(cleared.Color);
    }

    [Fact]
    public async Task Unknown_colors_are_rejected()
    {
        using var t = new NotesTestContext();
        var projects = new ProjectsController(t.Db);
        var p = Ok(await projects.Create(new CreateProjectRequest("P"), default));

        var result = await projects.Update(p.Id, new UpdateProjectRequest(Color: "#ff0000"), default);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal("blue", t.Db.Projects.Single().Color);
    }
}
