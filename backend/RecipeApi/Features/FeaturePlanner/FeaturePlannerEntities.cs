namespace RecipeApi.Features.FeaturePlanner;

public class FeatureColumn
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public List<FeatureCard> Cards { get; set; } = new();
}

public abstract class FeatureCard
{
    public int Id { get; set; }
    public int ColumnId { get; set; }
    public FeatureColumn Column { get; set; } = null!;

    public string Title { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string Requirements { get; set; } = string.Empty;

    public string? UiSketch { get; set; }

    public int SortOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public class FeatureOnlyCard : FeatureCard
{
    public string Motivation { get; set; } = string.Empty;
    public string? OutOfScope { get; set; }
    public string? OpenQuestions { get; set; }

    public bool StacksFrontend { get; set; }
    public bool StacksBackend { get; set; }
    public bool StacksInfrastructure { get; set; }
    public string? DataModel { get; set; }
    public string? ApiSketch { get; set; }
}

public class BugCard : FeatureCard
{
    public string BugUrl { get; set; } = string.Empty;
}
