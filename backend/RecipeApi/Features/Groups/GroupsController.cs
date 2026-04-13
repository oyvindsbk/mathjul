using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecipeApi.Infrastructure;

namespace RecipeApi.Features.Groups;

[ApiController]
[Route("api/[controller]")]
public class GroupsController : ControllerBase
{
    private readonly RecipeDbContext _db;
    private readonly ILogger<GroupsController> _logger;

    public GroupsController(RecipeDbContext db, ILogger<GroupsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    private string? GetCallerEmail() =>
        User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
        ?? User.FindFirst("email")?.Value;

    private async Task<Auth.User?> GetCallerUserAsync(string email) =>
        await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

    // GET /api/groups
    [HttpGet]
    public async Task<ActionResult<List<GroupDto>>> GetMyGroups()
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();

        var groups = await _db.GroupMembers
            .Where(m => m.User.Email == email)
            .Include(m => m.Group).ThenInclude(g => g.Owner)
            .Include(m => m.Group).ThenInclude(g => g.Members)
            .Select(m => new GroupDto
            {
                Id = m.Group.Id,
                Name = m.Group.Name,
                OwnerEmail = m.Group.Owner.Email,
                MemberCount = m.Group.Members.Count,
                CreatedAt = m.Group.CreatedAt
            })
            .ToListAsync();

        return Ok(groups);
    }

    // POST /api/groups
    [HttpPost]
    public async Task<ActionResult<GroupDto>> CreateGroup([FromBody] CreateGroupRequest request)
    {
        var email = GetCallerEmail();
        if (email == null) return Unauthorized();

        var owner = await GetCallerUserAsync(email);
        if (owner == null) return BadRequest(new { error = "User not registered. Call /api/auth/ensure-user first." });

        var group = new Group
        {
            Name = request.Name,
            OwnerId = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        _db.Groups.Add(group);
        await _db.SaveChangesAsync();

        _db.GroupMembers.Add(new GroupMember { GroupId = group.Id, UserId = owner.Id, JoinedAt = DateTime.UtcNow });
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetGroup), new { id = group.Id }, new GroupDto
        {
            Id = group.Id,
            Name = group.Name,
            OwnerEmail = email,
            MemberCount = 1,
            CreatedAt = group.CreatedAt
        });
    }

    // GET /api/groups/{id}
    [HttpGet("{id:int}")]
    public async Task<ActionResult<GroupDetailDto>> GetGroup(int id)
    {
        var email = GetCallerEmail();

        var group = await _db.Groups
            .Include(g => g.Owner)
            .Include(g => g.Members).ThenInclude(m => m.User)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (group == null) return NotFound();

        var isMember = group.Members.Any(m => m.User.Email == email);
        if (!isMember) return StatusCode(403, new { error = "You are not a member of this group" });

        var recipes = await _db.RecipeGroups
            .Where(rg => rg.GroupId == id)
            .Include(rg => rg.Recipe)
            .Select(rg => new GroupRecipeDto { Id = rg.RecipeId, Title = rg.Recipe.Title })
            .ToListAsync();

        return Ok(new GroupDetailDto
        {
            Id = group.Id,
            Name = group.Name,
            OwnerEmail = group.Owner.Email,
            CreatedAt = group.CreatedAt,
            Members = group.Members.Select(m => new GroupMemberDto
            {
                UserId = m.UserId,
                Email = m.User.Email,
                DisplayName = m.User.DisplayName,
                JoinedAt = m.JoinedAt
            }).ToList(),
            Recipes = recipes
        });
    }

    // PUT /api/groups/{id}
    [HttpPut("{id:int}")]
    public async Task<ActionResult<GroupDto>> RenameGroup(int id, [FromBody] RenameGroupRequest request)
    {
        var email = GetCallerEmail();

        var group = await _db.Groups.Include(g => g.Owner).Include(g => g.Members).FirstOrDefaultAsync(g => g.Id == id);
        if (group == null) return NotFound();
        if (group.Owner.Email != email) return StatusCode(403, new { error = "Only the owner can rename the group" });

        group.Name = request.Name;
        await _db.SaveChangesAsync();

        return Ok(new GroupDto
        {
            Id = group.Id,
            Name = group.Name,
            OwnerEmail = group.Owner.Email,
            MemberCount = group.Members.Count,
            CreatedAt = group.CreatedAt
        });
    }

    // DELETE /api/groups/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteGroup(int id)
    {
        var email = GetCallerEmail();

        var group = await _db.Groups.Include(g => g.Owner).FirstOrDefaultAsync(g => g.Id == id);
        if (group == null) return NotFound();
        if (group.Owner.Email != email) return StatusCode(403, new { error = "Only the owner can delete the group" });

        _db.Groups.Remove(group);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // POST /api/groups/{id}/members
    [HttpPost("{id:int}/members")]
    public async Task<IActionResult> AddMember(int id, [FromBody] AddMemberRequest request)
    {
        var callerEmail = GetCallerEmail();

        var group = await _db.Groups.Include(g => g.Owner).Include(g => g.Members).FirstOrDefaultAsync(g => g.Id == id);
        if (group == null) return NotFound();
        if (group.Owner.Email != callerEmail) return StatusCode(403, new { error = "Only the owner can invite members" });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        if (user == null) return NotFound(new { error = $"No user found with email '{request.Email}'. They must log in first." });

        if (group.Members.Any(m => m.UserId == user.Id))
            return Conflict(new { error = "User is already a member" });

        _db.GroupMembers.Add(new GroupMember { GroupId = id, UserId = user.Id, JoinedAt = DateTime.UtcNow });
        await _db.SaveChangesAsync();

        return Ok(new GroupMemberDto
        {
            UserId = user.Id,
            Email = user.Email,
            DisplayName = user.DisplayName,
            JoinedAt = DateTime.UtcNow
        });
    }

    // DELETE /api/groups/{id}/members/{userId}
    [HttpDelete("{id:int}/members/{userId:int}")]
    public async Task<IActionResult> RemoveMember(int id, int userId)
    {
        var callerEmail = GetCallerEmail();

        var group = await _db.Groups.Include(g => g.Owner).Include(g => g.Members).ThenInclude(m => m.User)
            .FirstOrDefaultAsync(g => g.Id == id);
        if (group == null) return NotFound();

        var callerIsOwner = group.Owner.Email == callerEmail;
        var callerMember = group.Members.FirstOrDefault(m => m.User.Email == callerEmail);
        var callerIsSelf = callerMember?.UserId == userId;

        if (!callerIsOwner && !callerIsSelf)
            return StatusCode(403, new { error = "Only the owner or the member themselves can remove a member" });

        var member = group.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null) return NotFound(new { error = "Member not found" });

        _db.GroupMembers.Remove(member);
        await _db.SaveChangesAsync();

        return NoContent();
    }
}

// DTOs
public class GroupDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string OwnerEmail { get; set; } = string.Empty;
    public int MemberCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class GroupDetailDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string OwnerEmail { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public List<GroupMemberDto> Members { get; set; } = new();
    public List<GroupRecipeDto> Recipes { get; set; } = new();
}

public class GroupMemberDto
{
    public int UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public DateTime JoinedAt { get; set; }
}

public class GroupRecipeDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
}

public class CreateGroupRequest
{
    public string Name { get; set; } = string.Empty;
}

public class RenameGroupRequest
{
    public string Name { get; set; } = string.Empty;
}

public class AddMemberRequest
{
    public string Email { get; set; } = string.Empty;
}
