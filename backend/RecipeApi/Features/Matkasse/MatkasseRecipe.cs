using System.ComponentModel.DataAnnotations;
using RecipeApi.Features.Groups;

namespace RecipeApi.Features.Matkasse;

public class MatkasseRecipe
{
    public int Id { get; set; }

    public int GroupId { get; set; }
    public Group Group { get; set; } = null!;

    [StringLength(50)]
    public string Leverandor { get; set; } = string.Empty;

    public DateOnly UkeStart { get; set; }

    [StringLength(200)]
    public string Tittel { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Beskrivelse { get; set; }

    [StringLength(500)]
    public string? ImageUrl { get; set; }

    [StringLength(200)]
    public string? CreatedByEmail { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
