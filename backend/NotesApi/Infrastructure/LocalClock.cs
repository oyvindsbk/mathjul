namespace NotesApi.Infrastructure;

/// <summary>"Today" in the user's time zone. The log follows the Oslo calendar, not UTC.</summary>
public class LocalClock(TimeProvider time)
{
    private static readonly TimeZoneInfo Oslo = TimeZoneInfo.FindSystemTimeZoneById("Europe/Oslo");

    public DateOnly Today =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(time.GetUtcNow(), Oslo).DateTime);

    public DateTime UtcNow => time.GetUtcNow().UtcDateTime;
}
