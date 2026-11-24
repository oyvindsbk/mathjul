namespace NotesApi.Features.Days;

/// <summary>A dated page in the work log. One row per calendar date.</summary>
public class Day
{
    public int Id { get; set; }
    public DateOnly Date { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// When open to-dos were carried into this day. Separate from the row's existence: a day
    /// planned ahead (items added on a future date) still needs carry-over when it arrives.
    /// A concurrency token, so two first-opens can't both carry.
    /// </summary>
    public DateTime? CarriedOverAt { get; set; }

    public List<Item> Items { get; set; } = [];
}
