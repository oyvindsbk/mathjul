using System.Globalization;
using System.Text.RegularExpressions;

namespace NotesApi.Features.Days;

/// <summary>ISO-8601 week keys such as "2026-W48", the way the OneNote log was organised.</summary>
public static partial class IsoWeek
{
    public static string Key(DateOnly date)
    {
        var dt = date.ToDateTime(TimeOnly.MinValue);
        return $"{ISOWeek.GetYear(dt)}-W{ISOWeek.GetWeekOfYear(dt):00}";
    }

    public static bool TryParseMonday(string key, out DateOnly monday)
    {
        monday = default;
        var match = KeyPattern().Match(key);
        if (!match.Success)
            return false;

        var year = int.Parse(match.Groups[1].Value);
        var week = int.Parse(match.Groups[2].Value);
        if (year is < 2000 or > 2100 || week < 1 || week > ISOWeek.GetWeeksInYear(year))
            return false;

        monday = DateOnly.FromDateTime(ISOWeek.ToDateTime(year, week, DayOfWeek.Monday));
        return true;
    }

    [GeneratedRegex(@"^(\d{4})-W(\d{1,2})$")]
    private static partial Regex KeyPattern();
}
