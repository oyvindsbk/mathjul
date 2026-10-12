using ImageMagick;

namespace RecipeApi.Features.Stock;

/// <summary>
/// Validation and preparation of photos before they go to the model. Nothing is stored:
/// the bytes live in memory for the duration of one request.
/// </summary>
public static class StockImages
{
    public const int MaxImages = 4;
    public const long MaxFileSizeBytes = 10 * 1024 * 1024;

    /// <summary>Longest side after scaling. Keeps the vision cost of a phone photo down.</summary>
    public const int MaxDimension = 1536;

    /// <summary>Decoded size cap (about 40 MP); stops a small file with huge dimensions exhausting memory.</summary>
    public const long MaxPixels = 40_000_000;

    private static readonly string[] AllowedContentTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    /// <summary>Null when the files are acceptable, otherwise a Norwegian error message.</summary>
    public static string? Validate(IReadOnlyList<IFormFile> files)
    {
        if (files.Count == 0) return "Ingen bilder ble lastet opp";
        if (files.Count > MaxImages) return $"Maks {MaxImages} bilder er tillatt";

        foreach (var file in files)
        {
            if (file.Length == 0) return "Ett eller flere bilder er tomme";
            if (file.Length > MaxFileSizeBytes) return $"Bildet '{file.FileName}' er for stort (maks 10 MB)";
            if (!AllowedContentTypes.Contains(file.ContentType.ToLowerInvariant()))
                return $"Ugyldig filtype for '{file.FileName}'";
        }
        return null;
    }

    /// <summary>
    /// Straightens the photo (phones store rotation as metadata), scales it down to
    /// <see cref="MaxDimension"/> if larger, and re-encodes it as JPEG, which also drops
    /// EXIF data such as location. Null when the bytes are not a readable image.
    /// </summary>
    public static async Task<byte[]?> PrepareAsync(IFormFile file, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var upload = file.OpenReadStream();
            using var buffer = new MemoryStream();
            await upload.CopyToAsync(buffer, cancellationToken);
            var bytes = buffer.ToArray();

            // Read only the header first: a tiny file can still declare enormous dimensions,
            // and only the formats we advertise are decoded at all.
            var info = new MagickImageInfo(bytes);
            if ((long)info.Width * info.Height > MaxPixels) return null;
            if (info.Format is not (MagickFormat.Jpeg or MagickFormat.Png or MagickFormat.WebP)) return null;

            using var image = new MagickImage(bytes);
            image.AutoOrient();
            if (image.Width > MaxDimension || image.Height > MaxDimension)
                image.Resize(new MagickGeometry(MaxDimension, MaxDimension));

            image.Strip();
            image.Quality = 80;
            image.Format = MagickFormat.Jpeg;
            return image.ToByteArray();
        }
        catch (MagickException)
        {
            return null;
        }
    }
}
