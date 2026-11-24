using NotesApi.Features.Contexts;

namespace NotesApi.Features.Days;

public enum ItemKind
{
    Todo,
    Note,
}

public enum ItemState
{
    Open,
    Done,

    /// <summary>Copied forward to a later day; the copy is the live one.</summary>
    Carried,
}

public enum ItemSource
{
    Manual,
    OneNote,
}

/// <summary>A line on a day: a to-do with a checkbox, or a plain note.</summary>
public class Item
{
    public const int MaxIndent = 6;
    public const int MaxTextLength = 20_000;

    public int Id { get; set; }
    public int DayId { get; set; }
    public Day Day { get; set; } = null!;

    /// <summary>Null means the "Dagens TODOs" group.</summary>
    public int? ContextId { get; set; }
    public WorkContext? Context { get; set; }

    public ItemKind Kind { get; set; }
    public string Text { get; set; } = "";

    /// <summary>Only meaningful for to-dos; notes stay <see cref="ItemState.Open"/>.</summary>
    public ItemState State { get; set; }

    public int Indent { get; set; }

    /// <summary>Order within the item's (day, context) group.</summary>
    public int SortOrder { get; set; }

    public int? CarriedFromItemId { get; set; }
    public Item? CarriedFrom { get; set; }

    public DateTime? CompletedAt { get; set; }
    public ItemSource Source { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
