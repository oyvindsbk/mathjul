namespace NotesApi.Features.Projects;

/// <summary>
/// A heading that groups items on a day, such as "Jobb" or "Hobby". Items without
/// a project belong to the "Dagens TODOs" group.
/// </summary>
public class Project
{
    public const int MaxNameLength = 60;

    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int SortOrder { get; set; }

    /// <summary>Archived projects take no new items but keep their history.</summary>
    public bool IsArchived { get; set; }

    /// <summary>A key from <see cref="ProjectColors.All"/>, or null for no color.</summary>
    public string? Color { get; set; }
}
