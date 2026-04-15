using System.ComponentModel.DataAnnotations;
using RecipeApi.Features.Auth;

namespace RecipeApi.Features.Groups;

public class Group
{
    public int Id { get; set; }

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    public int OwnerId { get; set; }
    public User Owner { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public bool MealPlanEnabled { get; set; } = true;

    public List<GroupMember> Members { get; set; } = new();
}

public class GroupMember
{
    public int GroupId { get; set; }
    public Group Group { get; set; } = null!;

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public DateTime JoinedAt { get; set; }
}
