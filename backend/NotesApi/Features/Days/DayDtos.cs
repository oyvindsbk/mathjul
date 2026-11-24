using System.ComponentModel.DataAnnotations;

namespace NotesApi.Features.Days;

public record ItemDto(
    int Id,
    ItemKind Kind,
    string Text,
    ItemState State,
    int Indent,
    int SortOrder,
    int? ContextId,
    DateOnly? CarriedFromDate,
    DateTime? CompletedAt);

public record DayDto(DateOnly Date, bool IsToday, IReadOnlyList<ItemDto> Items);

public record DaySummaryDto(DateOnly Date, int Open, int Done, int Carried, int Notes);

public record WeekDto(string Week, DateOnly Monday, DateOnly Today, IReadOnlyList<DaySummaryDto> Days);

public record TodayDto(DateOnly Date, string Week);

public record AddItemRequest(
    ItemKind Kind,
    [MaxLength(Item.MaxTextLength)] string Text,
    int? ContextId,
    [Range(0, Item.MaxIndent)] int Indent = 0,
    int? AfterItemId = null);

public record UpdateItemRequest(
    [MaxLength(Item.MaxTextLength)] string? Text = null,
    ItemKind? Kind = null,
    ItemState? State = null,
    [Range(0, Item.MaxIndent)] int? Indent = null);

/// <summary>Moves an item to a position within a (possibly different) context group.</summary>
public record MoveItemRequest(int? ContextId, [Range(0, int.MaxValue)] int Index);
