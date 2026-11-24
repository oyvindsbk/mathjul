namespace NotesApi.Features.Days;

/// <summary>A dated page in the work log. One row per calendar date.</summary>
public class Day
{
    public int Id { get; set; }
    public DateOnly Date { get; set; }
    public DateTime CreatedAt { get; set; }

    public List<Item> Items { get; set; } = [];
}
