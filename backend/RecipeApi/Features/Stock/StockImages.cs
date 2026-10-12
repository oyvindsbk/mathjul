using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

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
            // Read only the header first: a tiny file can still declare enormous dimensions.
            await using (var probe = file.OpenReadStream())
            {
                var info = await Image.IdentifyAsync(probe, cancellationToken);
                if (info == null || (long)info.Width * info.Height > MaxPixels) return null;
            }

            await using var input = file.OpenReadStream();
            using var image = await Image.LoadAsync(input, cancellationToken);

            image.Mutate(x => x.AutoOrient());
            if (image.Width > MaxDimension || image.Height > MaxDimension)
            {
                image.Mutate(x => x.Resize(new ResizeOptions
                {
                    Size = new Size(MaxDimension, MaxDimension),
                    Mode = ResizeMode.Max,
                }));
            }

            using var output = new MemoryStream();
            await image.SaveAsJpegAsync(output, new JpegEncoder { Quality = 80 }, cancellationToken);
            return output.ToArray();
        }
        catch (Exception ex) when (ex is UnknownImageFormatException or InvalidImageContentException or NotSupportedException)
        {
            return null;
        }
    }
}
