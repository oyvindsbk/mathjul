namespace NotesApi.Features.Projects;

/// <summary>
/// The fixed palette a project can be colored with, modelled on OneNote's section colors.
/// Only the keys live here; the frontend owns the light and dark values.
/// </summary>
public static class ProjectColors
{
    public const int MaxKeyLength = 20;

    public static readonly IReadOnlyList<string> All =
        ["blue", "yellow", "green", "red", "purple", "cyan", "orange", "magenta", "teal", "gray"];

    public static bool IsValid(string key) => All.Contains(key);

    /// <summary>The first palette color no active project uses; when all are taken, cycles by count.</summary>
    public static string NextUnused(IReadOnlyCollection<string?> usedByActive) =>
        All.FirstOrDefault(c => !usedByActive.Contains(c)) ?? All[usedByActive.Count % All.Count];
}
