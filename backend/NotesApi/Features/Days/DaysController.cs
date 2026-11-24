using Microsoft.AspNetCore.Mvc;
using NotesApi.Infrastructure;

namespace NotesApi.Features.Days;

[ApiController]
[Route("api")]
public class DaysController(DayService days, LocalClock clock) : ControllerBase
{
    [HttpGet("today")]
    public TodayDto Today() => new(clock.Today, IsoWeek.Key(clock.Today));

    [HttpGet("weeks/{week}")]
    public async Task<ActionResult<WeekDto>> GetWeek(string week, CancellationToken ct)
    {
        if (!IsoWeek.TryParseMonday(week, out var monday))
            return BadRequest(new { error = "Week must look like 2026-W48" });
        return await days.GetWeekAsync(monday, ct);
    }

    [HttpGet("days/{date}")]
    public Task<DayDto> GetDay(DateOnly date, CancellationToken ct) => days.GetDayAsync(date, ct);

    [HttpPost("days/{date}/items")]
    public Task<ItemDto> AddItem(DateOnly date, AddItemRequest request, CancellationToken ct) =>
        days.AddItemAsync(date, request, ct);

    [HttpPatch("items/{id:int}")]
    public Task<ItemDto> UpdateItem(int id, UpdateItemRequest request, CancellationToken ct) =>
        days.UpdateItemAsync(id, request, ct);

    [HttpPost("items/{id:int}/move")]
    public Task<ItemDto> MoveItem(int id, MoveItemRequest request, CancellationToken ct) =>
        days.MoveItemAsync(id, request, ct);

    [HttpDelete("items/{id:int}")]
    public async Task<IActionResult> DeleteItem(int id, CancellationToken ct)
    {
        await days.DeleteItemAsync(id, ct);
        return NoContent();
    }
}
