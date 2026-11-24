namespace NotesApi.Features.Contexts;

/// <summary>
/// A heading that groups items on a day, such as "Jobb" or "Hobby".
/// Named WorkContext to keep it apart from EF's DbContext; the table is "Contexts".
/// </summary>
public class WorkContext
{
    public const int MaxNameLength = 60;

    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int SortOrder { get; set; }

    /// <summary>Archived contexts take no new items but keep their history.</summary>
    public bool IsArchived { get; set; }
}
