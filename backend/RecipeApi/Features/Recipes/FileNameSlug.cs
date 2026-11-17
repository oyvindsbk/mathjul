using System.Text;

namespace RecipeApi.Features.Recipes;

/// <summary>Turns a recipe title into an ASCII file-name stem, e.g. "Mormors spesial!" → "mormors-spesial".</summary>
public static class FileNameSlug
{
    private const int MaxLength = 60;
    private const string Fallback = "oppskrift";

    public static string From(string? title)
    {
        var sb = new StringBuilder();
        foreach (var c in (title ?? string.Empty).ToLowerInvariant())
        {
            switch (c)
            {
                case 'æ': sb.Append("ae"); break;
                case 'ø': sb.Append('o'); break;
                case 'å': sb.Append('a'); break;
                case >= 'a' and <= 'z' or >= '0' and <= '9': sb.Append(c); break;
                default:
                    if (sb.Length > 0 && sb[^1] != '-') sb.Append('-');
                    break;
            }
        }

        var slug = sb.ToString();
        if (slug.Length > MaxLength) slug = slug[..MaxLength];
        slug = slug.Trim('-');
        return slug.Length == 0 ? Fallback : slug;
    }
}
